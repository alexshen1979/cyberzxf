#!/usr/bin/env python3
import argparse
import re
import sqlite3
from datetime import datetime

import pdfplumber


def int_text(value):
    if value is None:
        return None
    text = str(value).replace(",", "").strip()
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else None


def parse_zhejiang(path):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                for row in table:
                    if not row or row[0] == "总分":
                        continue
                    for index in range(0, len(row), 3):
                        if index + 2 >= len(row):
                            continue
                        score = int_text(str(row[index] or "").replace("↑", ""))
                        same_count = int_text(row[index + 1])
                        rank = int_text(row[index + 2])
                        if score is not None and rank is not None:
                            rows.append((score, rank, same_count))
    return dedupe(rows)


def parse_guizhou(path):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                for index in range(0, len(table) - 1, 2):
                    header = table[index]
                    values = table[index + 1]
                    if not header or not values or not str(header[0]).strip().startswith("分数"):
                        continue
                    for score_cell, value_cell in zip(header[1:], values[1:]):
                        score = int_text(str(score_cell or "").replace("及以上", ""))
                        nums = re.findall(r"\d+(?:\.\d+)?", str(value_cell or ""))
                        if score is not None and len(nums) >= 2:
                            rows.append((score, int(float(nums[1])), int(float(nums[0]))))
    return dedupe(rows)


def parse_guangdong(path, page_start, page_end):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages[page_start - 1:page_end]:
            for table in page.extract_tables() or []:
                for row in table:
                    if not row or len(row) < 3:
                        continue
                    score = int_text(str(row[0] or "").replace("（含以上）", "").replace("(含以上)", ""))
                    same_count = int_text(row[1])
                    rank = int_text(row[2])
                    if score is not None and rank is not None:
                        rows.append((score, rank, same_count))
    return dedupe(rows)


def parse_generic_text(path, page_start, page_end):
    rows = []
    with pdfplumber.open(path) as pdf:
        pages = pdf.pages[page_start - 1:page_end]
        for page in pages:
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            for line in text.splitlines():
                rows.extend(parse_score_line(line))
    return dedupe(fill_range_scores(fill_same_score_count(rows)))


def parse_score_line(line):
    text = re.sub(r"\s+", " ", line.replace(",", "").replace("，", "")).strip()
    if not text or any(keyword in text for keyword in ["分数 人数", "累计人数", "第 ", "官网", "微信号", "考试院"]):
        return []

    rows = []
    for match in re.finditer(r"(?<!\d)(\d{1,3})(?:\s*[-—–~～至]\s*(\d{1,3})|(?:\s*分)?\s*及\s*以上)?\s+(\d+)\s+(\d+)(?!\d)", text):
        score = int(match.group(1))
        range_end = int(match.group(2)) if match.group(2) else None
        same_count = int(match.group(3))
        rank = int(match.group(4))
        if 1 <= score <= 750 and rank > 0:
            rows.append((score, rank, same_count, range_end, re.search(r"及\s*以上", match.group(0)) is not None))
    return rows


def fill_range_scores(rows):
    filled = []
    for row in rows:
        if len(row) == 3:
            filled.append(row)
            continue
        score, rank, same_count, range_end, is_above = row
        if range_end is not None:
            start, end = sorted((score, range_end))
            for value in range(start, min(end, 750) + 1):
                filled.append((value, rank, same_count if value == score else None))
        elif is_above:
            for value in range(score, 751):
                filled.append((value, rank, same_count if value == score else None))
        else:
            filled.append((score, rank, same_count))
    return filled


def fill_same_score_count(rows):
    normalized = []
    for row in rows:
        score, rank, same_count = row[:3]
        normalized.append((score, rank, same_count))
    by_score = {}
    for score, rank, same_count in normalized:
        if 1 <= score <= 750:
            by_score[score] = (score, rank, same_count)
    scores = sorted(by_score.keys(), reverse=True)
    previous_rank = 0
    filled = []
    for score in scores:
        _, rank, same_count = by_score[score]
        if same_count is None and rank >= previous_rank:
            same_count = rank - previous_rank
        filled.append((score, rank, same_count))
        previous_rank = rank
    return filled


def dedupe(rows):
    by_score = {}
    for score, rank, same_count in rows:
        if 1 <= score <= 750:
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
                    f'{{"parser":"{args.parser}","file":"{args.file}"}}',
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
    parser.add_argument("--parser", required=True, choices=["zhejiang", "guizhou", "guangdong", "generic-text"])
    parser.add_argument("--province", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--subject-type", required=True)
    parser.add_argument("--source-name", default="官方发布")
    parser.add_argument("--source-url", default="")
    parser.add_argument("--source-type", default="official_score_rank_pdf")
    parser.add_argument("--page-start", type=int, default=1)
    parser.add_argument("--page-end", type=int, default=9999)
    args = parser.parse_args()

    if args.parser == "zhejiang":
        rows = parse_zhejiang(args.file)
    elif args.parser == "guizhou":
        rows = parse_guizhou(args.file)
    elif args.parser == "guangdong":
        rows = parse_guangdong(args.file, args.page_start, args.page_end)
    else:
        rows = parse_generic_text(args.file, args.page_start, args.page_end)

    if len(rows) < 100:
        raise SystemExit(f"解析结果过少，已停止导入: {len(rows)}")

    import_rows(args, rows)
    print(f"导入完成: {args.province} {args.year} {args.subject_type} {len(rows)} 条，分数 {min(r[0] for r in rows)}-{max(r[0] for r in rows)}")


if __name__ == "__main__":
    main()
