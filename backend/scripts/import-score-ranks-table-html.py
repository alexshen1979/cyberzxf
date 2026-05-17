#!/usr/bin/env python3
import argparse
import html
import re
import sqlite3
from datetime import datetime
from html.parser import HTMLParser


class RowParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = []
        self.cell = []
        self.in_cell = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() in ("td", "th"):
            self.in_cell = True
            self.cell = []

    def handle_data(self, data):
        if self.in_cell:
            self.cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("td", "th") and self.in_cell:
            text = re.sub(r"\s+", " ", html.unescape("".join(self.cell))).strip()
            self.row.append(text)
            self.in_cell = False
            self.cell = []
        elif tag == "tr":
            if any(self.row):
                self.rows.append(self.row)
            self.row = []


def int_text(value):
    match = re.search(r"\d+", value.replace(",", "").replace("，", ""))
    return int(match.group(0)) if match else None


def parse_rows(path):
    parser = RowParser()
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        parser.feed(f.read())
    rows = []
    for cells in parser.rows:
        values = [cell for cell in cells if cell]
        if len(values) < 3:
            continue
        score = int_text(values[0])
        same_count = int_text(values[1])
        rank = int_text(values[2])
        if score is not None and rank is not None and 1 <= score <= 750:
            rows.append((score, rank, same_count))
    by_score = {}
    for score, rank, same_count in rows:
        by_score[score] = (score, rank, same_count)
    return [by_score[score] for score in sorted(by_score.keys(), reverse=True)]


def filter_rows_by_label(path, rows, label):
    if not label:
        return rows
    parser = RowParser()
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        parser.feed(f.read())
    filtered = []
    for cells in parser.rows:
        values = [cell for cell in cells if cell]
        if label not in values:
            continue
        score = int_text(values[0])
        same_count = int_text(values[1]) if len(values) > 1 else None
        rank = int_text(values[2]) if len(values) > 2 else None
        if score is not None and rank is not None and 1 <= score <= 750:
            filtered.append((score, rank, same_count))
    by_score = {}
    for score, rank, same_count in filtered:
        by_score[score] = (score, rank, same_count)
    return [by_score[score] for score in sorted(by_score.keys(), reverse=True)]


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
                    args.source_url,
                    args.source_type,
                    f'{{"parser":"table-html","file":"{args.file}"}}',
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
    parser.add_argument("--file", required=True)
    parser.add_argument("--province", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--subject-type", required=True)
    parser.add_argument("--source-name", default="网页表格")
    parser.add_argument("--source-url", default="")
    parser.add_argument("--source-type", default="score_rank_table_html")
    parser.add_argument("--label", default="")
    args = parser.parse_args()

    rows = filter_rows_by_label(args.file, parse_rows(args.file), args.label)
    if len(rows) < 100:
        raise SystemExit(f"解析结果过少，已停止导入: {len(rows)}")
    import_rows(args, rows)
    print(f"导入完成: {args.province} {args.year} {args.subject_type} {len(rows)} 条，分数 {min(r[0] for r in rows)}-{max(r[0] for r in rows)}")


if __name__ == "__main__":
    main()
