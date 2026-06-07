"""파일 내보내기: 선택 내역 -> Excel/CSV.

지출 내역(list[dict])을 받아 xlsx/csv 바이트로 변환한다.
- 내부 식별자(id, user_id, created_at)는 내보내기에서 제외한다.
- 품목(items)은 '이름 1,000원; ...' 형태의 읽기 쉬운 문자열로 변환한다.
- 금액은 화면 표시 규칙(수입=+, 그 외=−)에 맞춰 부호를 정규화한다.
- 알려진 필드는 한글 헤더로 매핑하되, 그 외 키는 그대로 내보낸다(스키마 변경 견딤).
"""
from __future__ import annotations

import io

import pandas as pd

# 알려진 필드 -> 한글 헤더.
_HEADER_MAP = {
    "store": "가게명",
    "spent_at": "날짜",
    "date": "날짜",
    "amount": "금액",
    "category": "카테고리",
    "note": "메모",
    "items": "품목",
    "cid": "카드결제",
    "bid": "현금결제",
}
# 컬럼 우선 순서(존재하는 것만 적용, 나머지는 뒤에 첫 등장 순으로).
_COLUMN_ORDER = ["store", "spent_at", "date", "amount", "category", "note", "items", "cid", "bid"]
# 내보내기에서 제외할 내부 식별자.
_DROP_COLUMNS = {"id", "user_id", "created_at"}


def _normalize_amount(amount, category):
    """화면 표시 규칙대로 부호 정규화: 수입=+, 그 외=−. 숫자가 아니면 원본 유지."""
    try:
        a = int(amount)
    except (TypeError, ValueError):
        return amount
    return abs(a) if category == "수입" else -abs(a)


def _format_items(value) -> str:
    """품목 목록을 '이름 1,000원; ...' 형태의 읽기 쉬운 문자열로 만든다."""
    if not isinstance(value, list):
        return "" if value is None else str(value)
    parts = []
    for it in value:
        if isinstance(it, dict):
            name = it.get("name", "")
            price = it.get("price")
            if isinstance(price, (int, float)):
                parts.append(f"{name} {int(price):,}원")
            else:
                parts.append(str(name))
        else:
            parts.append(str(it))
    return "; ".join(parts)


def _clean_row(t: dict) -> dict:
    """내부 식별자 제거 + 품목 문자열화 + 금액 부호 정규화."""
    out = {}
    for k, v in t.items():
        if k in _DROP_COLUMNS:
            continue
        if k == "items":
            out[k] = _format_items(v)
        elif k == "amount":
            out[k] = _normalize_amount(v, t.get("category"))
        else:
            out[k] = v
    return out


def _to_dataframe(transactions: list[dict]) -> pd.DataFrame:
    """내역 목록을 보기 좋은 컬럼 순서·한글 헤더의 DataFrame 으로 만든다."""
    df = pd.DataFrame([_clean_row(t) for t in transactions])
    if df.empty:
        return df
    # 알려진 컬럼을 우선 순서대로 앞에, 나머지는 뒤에.
    known = [c for c in _COLUMN_ORDER if c in df.columns]
    rest = [c for c in df.columns if c not in known]
    df = df[known + rest]
    # 한글 헤더로 rename (매핑에 있는 것만 변환).
    return df.rename(columns={c: _HEADER_MAP.get(c, c) for c in df.columns})


def to_excel(transactions: list[dict]) -> bytes:
    """지출 내역을 xlsx 바이트로 변환한다 (StreamingResponse 등으로 반환용)."""
    df = _to_dataframe(transactions)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="가계부")
    return buf.getvalue()


def to_csv(transactions: list[dict]) -> bytes:
    """지출 내역을 CSV 바이트로 변환한다.

    Excel 에서 한글이 깨지지 않도록 UTF-8 BOM(utf-8-sig)으로 인코딩한다.
    """
    df = _to_dataframe(transactions)
    return df.to_csv(index=False).encode("utf-8-sig")
