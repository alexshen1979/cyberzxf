#!/usr/bin/env python3
import argparse
import json
import re
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

import pdfplumber


SOURCE_NAME = "德立信生涯规划教育平台"
SOURCE_TYPE = "dlx_2025_admission_pdf"
SOURCE_URL = "https://www.dlxsygh.com"


PROVINCE_SUFFIX_RE = re.compile(r"(省|市|自治区|维吾尔自治区|壮族自治区|回族自治区)$")
GROUP_RE = re.compile(r"专业组[:：]\s*([A-Za-z0-9]+)")


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", "", str(value).replace("\n", "")).strip()


def normalize_province(value):
    text = clean(value)
    text = text.replace("维吾尔自治区", "").replace("壮族自治区", "").replace("回族自治区", "")
    text = PROVINCE_SUFFIX_RE.sub("", text)
    return text


def normalize_subject(value):
    text = clean(value)
    mapping = {
        "物理": "物理类",
        "历史": "历史类",
        "综合": "综合改革",
    }
    return mapping.get(text, text)


def normalize_university_name(value):
    return (
        clean(value)
        .replace("(", "（")
        .replace(")", "）")
        .replace("威海分校", "（威海）")
        .replace("山东大学威海分校", "山东大学（威海）")
    )


def base_university_name(value):
    return re.sub(r"（.*?）", "", normalize_university_name(value))


def to_int(value):
    text = clean(value)
    if not text or not re.fullmatch(r"\d+", text):
        return None
    return int(text)


def infer_line_type(batch, remark):
    text = f"{batch or ''} {remark or ''}"
    if "专业组" in text:
        return "major_group"
    return "university"


def parse_group_code(remark):
    match = GROUP_RE.search(remark or "")
    return match.group(1) if match else None


def parse_rows(pdf_path, max_pages=None):
    parsed = []
    skipped = []

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        page_count = min(total_pages, max_pages) if max_pages else total_pages

        for page_index in range(page_count):
            page = pdf.pages[page_index]
            try:
                tables = page.extract_tables()
            except Exception as exc:
                skipped.append({"page": page_index + 1, "reason": f"extract_failed: {exc}"})
                continue

            for table in tables:
                for row_index, row in enumerate(table):
                    if not row or len(row) < 11:
                        continue

                    cells = [clean(cell) for cell in row[:11]]
                    if cells[0] in ("高考省份", "高考省") or cells[1] == "年度":
                        continue
                    if not re.fullmatch(r"20\d{2}", cells[1] or ""):
                        continue

                    province = normalize_province(cells[0])
                    year = to_int(cells[1])
                    batch = cells[2] or None
                    subject_type = normalize_subject(cells[3])
                    school_code = cells[4] or None
                    university_name = cells[5]
                    subject_requirement = cells[6] or None
                    plan_count = to_int(cells[7])
                    min_score = to_int(cells[8])
                    min_rank = to_int(cells[9])
                    remark = cells[10] or None

                    if not province or not year or not subject_type or not university_name or min_score is None:
                        skipped.append({
                            "page": page_index + 1,
                            "row": row_index + 1,
                            "reason": "missing_required",
                            "cells": cells,
                        })
                        continue

                    raw = {
                        "page": page_index + 1,
                        "row": row_index + 1,
                        "schoolCode": school_code,
                        "remark": remark,
                        "sourceFile": str(pdf_path),
                    }
                    group_code = parse_group_code(remark)
                    group_name = f"专业组:{group_code}" if group_code else None

                    parsed.append({
                        "id": str(uuid.uuid4()),
                        "university_name": university_name,
                        "province": province,
                        "year": year,
                        "batch": batch,
                        "subject_type": subject_type,
                        "major_name": None,
                        "line_type": infer_line_type(batch, remark),
                        "group_code": group_code,
                        "group_name": group_name,
                        "subject_requirement": subject_requirement,
                        "min_score": min_score,
                        "min_rank": min_rank,
                        "avg_score": None,
                        "plan_count": plan_count,
                        "source_name": SOURCE_NAME,
                        "source_url": SOURCE_URL,
                        "source_type": SOURCE_TYPE,
                        "is_partial": 1,
                        "data_quality": "third_party_pdf",
                        "raw_data": json.dumps(raw, ensure_ascii=False),
                    })

    return parsed, skipped


def load_universities(conn):
    rows = conn.execute("select id, name from universities").fetchall()
    by_name = {}
    for row_id, name in rows:
        normalized = normalize_university_name(name)
        by_name.setdefault(normalized, row_id)
        base = base_university_name(name)
        if base:
            by_name.setdefault(base, row_id)
    return by_name


def resolve_university_id(name, by_name):
    normalized = normalize_university_name(name)
    if normalized in by_name:
        return by_name[normalized]

    base = base_university_name(name)
    if base in by_name:
        return by_name[base]

    suffixes = ["学院", "学校", "大学", "校区", "分校", "职业技术学院", "高等专科学校"]
    for suffix in suffixes:
        candidate = normalized + suffix
        if candidate in by_name:
            return by_name[candidate]

    if "（" in normalized and "）" not in normalized:
        for suffix in ["区）", "）"]:
            candidate = normalized + suffix
            if candidate in by_name:
                return by_name[candidate]

    return None


def attach_university_ids(rows, by_name):
    matched = 0
    for row in rows:
        row["university_id"] = resolve_university_id(row["university_name"], by_name)
        row["university_major_id"] = None
        if row["university_id"]:
            matched += 1
    return matched


def dedupe(rows):
    result = {}
    for row in rows:
        key = (
            row["province"],
            row["year"],
            row["batch"],
            row["subject_type"],
            row["university_name"],
            row["group_code"],
            row["subject_requirement"],
            row["min_score"],
            row["min_rank"],
            row["plan_count"],
            row["raw_data"],
        )
        result[key] = row
    return list(result.values())


def summarize(rows, skipped, matched):
    by_province = {}
    by_subject = {}
    by_batch = {}
    for row in rows:
        by_province[row["province"]] = by_province.get(row["province"], 0) + 1
        by_subject[row["subject_type"]] = by_subject.get(row["subject_type"], 0) + 1
        by_batch[row["batch"] or ""] = by_batch.get(row["batch"] or "", 0) + 1

    return {
        "parsed": len(rows),
        "skipped": len(skipped),
        "matchedUniversities": matched,
        "matchRate": round(matched / len(rows), 4) if rows else 0,
        "byProvinceTop": sorted(by_province.items(), key=lambda item: item[1], reverse=True)[:20],
        "bySubject": sorted(by_subject.items(), key=lambda item: item[1], reverse=True),
        "byBatchTop": sorted(by_batch.items(), key=lambda item: item[1], reverse=True)[:20],
        "samples": rows[:8],
        "skippedSamples": skipped[:8],
    }


def insert_rows(conn, rows, replace_source):
    if replace_source:
        deleted = conn.execute("delete from admission_scores where source_type = ?", (SOURCE_TYPE,)).rowcount
    else:
        deleted = 0

    now = datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
    columns = [
        "id",
        "university_id",
        "university_major_id",
        "university_name",
        "province",
        "year",
        "batch",
        "subject_type",
        "major_name",
        "line_type",
        "group_code",
        "group_name",
        "subject_requirement",
        "min_score",
        "min_rank",
        "avg_score",
        "plan_count",
        "source_name",
        "source_url",
        "source_type",
        "is_partial",
        "data_quality",
        "raw_data",
        "created_at",
    ]
    placeholders = ",".join(["?"] * len(columns))
    sql = f"insert into admission_scores ({','.join(columns)}) values ({placeholders})"
    conn.executemany(sql, [[row.get(col, now if col == "created_at" else None) for col in columns] for row in rows])
    conn.commit()
    return deleted, len(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--db", default="prisma/dev.db")
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replace-source", action="store_true")
    parser.add_argument("--summary-json")
    args = parser.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    db_path = Path(args.db).expanduser()
    if not pdf_path.exists():
        raise SystemExit(f"PDF 不存在: {pdf_path}")
    if not db_path.exists():
        raise SystemExit(f"数据库不存在: {db_path}")

    rows, skipped = parse_rows(pdf_path, args.max_pages)
    rows = dedupe(rows)

    conn = sqlite3.connect(db_path)
    try:
        matched = attach_university_ids(rows, load_universities(conn))
        summary = summarize(rows, skipped, matched)

        if args.dry_run:
            summary["dryRun"] = True
        else:
            deleted, inserted = insert_rows(conn, rows, args.replace_source)
            summary["dryRun"] = False
            summary["deleted"] = deleted
            summary["inserted"] = inserted

        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if args.summary_json:
            summary_path = Path(args.summary_json)
            summary_path.parent.mkdir(parents=True, exist_ok=True)
            summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
