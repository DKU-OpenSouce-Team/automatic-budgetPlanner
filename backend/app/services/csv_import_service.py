"""은행/카드 거래내역 CSV 파싱.

은행마다 CSV 양식이 달라, 컬럼명을 유연하게 매칭한다(날짜/가게명/출금·입금·금액).
파싱은 순수 함수라 DB 없이 단위테스트가 가능하다. 카테고리 분류·중복 제거·DB
저장은 라우트(`POST /files/csv`)가 담당한다.

반환: list[dict] — {store, amount(양수), spent_at("YYYY-MM-DD"), is_income, note}
"""
from __future__ import annotations

import csv
import io

# 컬럼명 후보(공백 제거·소문자 비교). 더 구체적인 것을 앞에 둔다.
_DATE_COLS = ["거래일시", "거래일자", "이용일자", "승인일자", "거래일", "날짜", "일자", "date"]
_STORE_COLS = ["가맹점명", "가맹점", "이용처", "적요", "거래내용", "내용", "거래처", "상호", "store", "비고"]
_OUT_COLS = ["출금액", "출금금액", "출금", "이용금액", "결제금액", "사용금액", "승인금액"]
_IN_COLS = ["입금액", "입금금액", "입금"]
_AMOUNT_COLS = ["거래금액", "금액", "amount"]


def _norm_key(s: str) -> str:
    return (s or "").replace("﻿", "").replace(" ", "").strip().lower()


def _decode(raw: bytes) -> str:
    """한국 은행 CSV는 cp949(euc-kr)가 흔하다. BOM·UTF-8도 시도."""
    for enc in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _first(norm: dict, candidates: list[str]):
    """후보 컬럼 중 값이 빈 문자열이 아닌 첫 항목을 반환."""
    for c in candidates:
        v = norm.get(c)
        if v is not None and str(v).strip() != "":
            return v
    return None


def _parse_amount(s):
    """'1,234원', '(1,234)', '-1234' 등을 정수로. 실패 시 None."""
    if s is None:
        return None
    t = str(s).replace(",", "").replace("원", "").replace(" ", "").strip()
    if t == "":
        return None
    neg = t.startswith("-") or (t.startswith("(") and t.endswith(")"))
    t = t.strip("()-+").strip()
    try:
        v = int(round(float(t)))
    except ValueError:
        return None
    return -v if neg else v


def _parse_date(s):
    """다양한 날짜 형식을 'YYYY-MM-DD'로 정규화. 실패 시 None."""
    if s is None:
        return None
    t = str(s).strip()
    # 시간 부분 제거
    t = t.split(" ")[0].split("T")[0]
    # 구분자 통일
    for ch in (".", "/", "년", "월"):
        t = t.replace(ch, "-")
    t = t.replace("일", "").strip().strip("-")
    digits = t.replace("-", "").replace(" ", "")
    if "-" in t:
        parts = [p for p in (x.strip() for x in t.split("-")) if p != ""]
        if len(parts) >= 3:
            try:
                y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                return f"{y:04d}-{m:02d}-{d:02d}"
            except ValueError:
                return None
    if len(digits) == 8 and digits.isdigit():
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    return None


def parse_rows(raw: bytes) -> list[dict]:
    """CSV 바이트를 거래 dict 목록으로 파싱. 날짜·금액을 못 찾은 행은 건너뛴다."""
    text = _decode(raw)
    reader = csv.DictReader(io.StringIO(text))
    out: list[dict] = []
    for row in reader:
        norm = {_norm_key(k): v for k, v in row.items() if k is not None}

        date = _parse_date(_first(norm, [_norm_key(c) for c in _DATE_COLS]))
        if not date:
            continue

        in_amt = _parse_amount(_first(norm, [_norm_key(c) for c in _IN_COLS]))
        out_amt = _parse_amount(_first(norm, [_norm_key(c) for c in _OUT_COLS]))
        gen_amt = _parse_amount(_first(norm, [_norm_key(c) for c in _AMOUNT_COLS]))

        if in_amt and in_amt > 0:
            amount, is_income = in_amt, True
        elif out_amt and out_amt > 0:
            amount, is_income = out_amt, False
        elif gen_amt is not None and gen_amt != 0:
            # 단일 '금액' 열은 보통 결제(지출)로 본다. 부호가 음수면 출금으로 간주.
            amount, is_income = abs(gen_amt), False
        else:
            continue

        store_val = _first(norm, [_norm_key(c) for c in _STORE_COLS])
        store = str(store_val).strip() if store_val is not None else ""
        out.append({
            "store": store or "기타",
            "amount": int(amount),
            "spent_at": date,
            "is_income": is_income,
            "note": "CSV 가져오기",
        })
    return out
