#!/usr/bin/env python3
import argparse
import html
import re
import sqlite3
import urllib.request
from datetime import datetime
from html.parser import HTMLParser


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.current_table = []
        self.current_row = []
        self.current_cell = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "table":
            self.in_table = True
            self.current_table = []
        elif self.in_table and tag == "tr":
            self.in_row = True
            self.current_row = []
        elif self.in_row and tag in ("td", "th"):
            self.in_cell = True
            self.current_cell = []

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("td", "th") and self.in_cell:
            text = normalize_text("".join(self.current_cell))
            self.current_row.append(text)
            self.in_cell = False
            self.current_cell = []
        elif tag == "tr" and self.in_row:
            if any(self.current_row):
                self.current_table.append(self.current_row)
            self.in_row = False
            self.current_row = []
        elif tag == "table" and self.in_table:
            if self.current_table:
                self.tables.append(self.current_table)
            self.in_table = False
            self.current_table = []

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell.append(data)


def normalize_text(value):
    text = html.unescape(value or "")
    return re.sub(r"\s+", "", text.replace("\u3000", " ")).strip()


def int_text(value):
    if value is None:
        return None
    text = normalize_text(str(value)).replace(",", "").replace("，", "")
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else None


def score_text(value):
    text = normalize_text(str(value or "")).replace(",", "").replace("，", "")
    if re.search(r"(分数|成绩|位次|人数|累计|排名)", text):
        return None
    match = re.search(r"(\d{1,3})", text)
    if not match:
        return None
    score = int(match.group(1))
    if score == 0 and "0" != text:
        return None
    return score if 0 <= score <= 750 else None


def parse_rows(tables, mode):
    rows = []
    for table in tables:
        for cells in table:
            compact = [cell for cell in cells if cell]
            if not compact:
                continue
            if re.search(r"(分数|成绩)", "".join(compact[:3])):
                continue
            if mode == "pairs":
                chunks = [compact[index:index + 2] for index in range(0, len(compact), 2)]
                offsets = (0, 1, None)
            elif mode == "triples":
                chunks = [compact[index:index + 3] for index in range(0, len(compact), 3)]
                offsets = (0, 2, 1)
            else:
                chunks, offsets = chunks_from_row(cells, compact)
            for chunk in chunks:
                if len(chunk) < 2:
                    continue
                if offsets[1] >= len(chunk):
                    continue
                score = score_text(chunk[offsets[0]])
                rank = int_text(chunk[offsets[1]])
                same_count = int_text(chunk[offsets[2]]) if offsets[2] is not None and offsets[2] < len(chunk) else None
                if score is not None and rank is not None and rank > 0:
                    rows.append((score, rank, same_count))
    return dedupe(fill_same_score_count(rows))


def chunks_from_row(cells, compact):
    if len(cells) >= 7 and cells[3] == "":
        return ([cells[:3], cells[4:7]], (0, 2, 1))
    if len(compact) == 6 and score_text(compact[0]) is not None and score_text(compact[3]) is not None:
        return ([compact[:3], compact[3:6]], (0, 2, 1))
    step = detect_step(compact)
    if step == 3:
        return ([compact[index:index + 3] for index in range(0, len(compact), 3)], (0, 2, 1))
    return ([compact[index:index + 2] for index in range(0, len(compact), 2)], (0, 1, None))


def detect_step(cells):
    joined = "".join(cells[:8])
    if "本段人数" in joined or "同分人数" in joined:
        return 3
    return 2


def fill_same_score_count(rows):
    by_score = {}
    for score, rank, same_count in rows:
        if 1 <= score <= 750:
            by_score[score] = (score, rank, same_count)
    scores = sorted(by_score.keys(), reverse=True)
    previous_rank = 0
    filled = []
    for score in scores:
        _, rank, same_count = by_score[score]
        if same_count is None:
            same_count = rank - previous_rank if rank >= previous_rank else None
        filled.append((score, rank, same_count))
        previous_rank = rank
    return filled


def dedupe(rows):
    by_score = {}
    for score, rank, same_count in rows:
        if 1 <= score <= 750:
            by_score[score] = (score, rank, same_count)
    return [by_score[score] for score in sorted(by_score.keys(), reverse=True)]


def read_text(args):
    if args.file:
        with open(args.file, "r", encoding=args.encoding, errors="ignore") as f:
            return f.read()
    req = urllib.request.Request(args.fetch_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode(args.encoding, errors="ignore")


def import_rows(args, rows):
    conn = sqlite3.connect(args.db)
    now = datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
    try:
        for score, rank, same_count in rows:
            row_id = f"{args.province}-{args.year}-{args.subject_type}-{score}"
            conn.execute(
                """
                insert into score_ranks (
                  id, province, year, subject_type, score, rank, same_score_count,
                  source_name, source_url, source_type, raw_data, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(province, year, subject_type, score) do update set
                  rank=excluded.rank,
                  same_score_count=excluded.same_score_count,
                  source_name=excluded.source_name,
                  source_url=excluded.source_url,
                  source_type=excluded.source_type,
                  raw_data=excluded.raw_data,
                  updated_at=excluded.updated_at
                """,
                (
                    row_id,
                    args.province,
                    args.year,
                    args.subject_type,
                    score,
                    rank,
                    same_count,
                    args.source_name,
                    args.source_url or args.fetch_url or args.file,
                    args.source_type,
                    f'{{"parser":"html-{args.mode}","source":"{args.file or args.fetch_url}"}}',
                    now,
                    now,
                ),
            )
        conn.commit()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="prisma/dev.db")
    parser.add_argument("--file")
    parser.add_argument("--fetch-url")
    parser.add_argument("--encoding", default="utf-8")
    parser.add_argument("--mode", choices=["auto", "pairs", "triples"], default="auto")
    parser.add_argument("--province", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--subject-type", required=True)
    parser.add_argument("--source-name", default="官方发布")
    parser.add_argument("--source-url", default="")
    parser.add_argument("--source-type", default="official_score_rank_html")
    args = parser.parse_args()

    if not args.file and not args.fetch_url:
        raise SystemExit("请提供 --file 或 --fetch-url")

    table_parser = TableParser()
    table_parser.feed(read_text(args))
    rows = parse_rows(table_parser.tables, args.mode)
    if len(rows) < 100:
        raise SystemExit(f"解析结果过少，已停止导入: {len(rows)}")

    import_rows(args, rows)
    print(f"导入完成: {args.province} {args.year} {args.subject_type} {len(rows)} 条，分数 {min(r[0] for r in rows)}-{max(r[0] for r in rows)}")


if __name__ == "__main__":
    main()
