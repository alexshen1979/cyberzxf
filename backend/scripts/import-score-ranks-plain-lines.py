#!/usr/bin/env python3
import argparse
import html
import re
import sqlite3
from datetime import datetime
from html.parser import HTMLParser


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        if data.strip():
            self.parts.append(data)


def extract_text(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    parser = TextParser()
    parser.feed(content)
    return "\n".join(html.unescape(part).strip() for part in parser.parts if part.strip())


def parse_rows(path, province, subject_type, year):
    text = extract_text(path)
    subject = subject_type.replace("类", "")
    rows = []
    pattern = re.compile(
        rf"^\s*(\d{{1,3}})(?:\s*分?\s*及\s*以上)?\s+(\d+)\s+(\d+)\s+{re.escape(subject)}(?:类)?\s+{re.escape(province)}\s+{year}\s*$"
    )
    for line in text.splitlines():
        normalized = re.sub(r"\s+", " ", line.replace(",", "").replace("，", "")).strip()
        match = pattern.match(normalized)
        if not match:
            continue
        score = int(match.group(1))
        same_count = int(match.group(2))
        rank = int(match.group(3))
        if 1 <= score <= 750:
            rows.append((score, rank, same_count))

    by_score = {}
    for score, rank, same_count in rows:
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
                    f'{{"parser":"plain-lines","file":"{args.file}"}}',
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
    parser.add_argument("--source-name", default="网页文本")
    parser.add_argument("--source-url", default="")
    parser.add_argument("--source-type", default="score_rank_plain_lines")
    args = parser.parse_args()

    rows = parse_rows(args.file, args.province, args.subject_type, args.year)
    if len(rows) < 100:
        raise SystemExit(f"解析结果过少，已停止导入: {len(rows)}")
    import_rows(args, rows)
    print(f"导入完成: {args.province} {args.year} {args.subject_type} {len(rows)} 条，分数 {min(r[0] for r in rows)}-{max(r[0] for r in rows)}")


if __name__ == "__main__":
    main()
