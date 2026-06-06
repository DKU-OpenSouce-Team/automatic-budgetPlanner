"""파일 내보내기: 선택 내역 -> Excel/CSV.

지출 내역(list[dict])을 받아 xlsx/csv 바이트로 변환한다.
스키마 확정 전이라 특정 키에 강하게 의존하지 않도록, 알려진 필드는 한글 헤더로
매핑하되 그 외 키는 그대로 내보낸다. (스키마 확정 시 매핑 키만 보강하면 됨)
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
    "cid": "카드결제",
    "bid": "현금결제",
}
# 컬럼 우선 순서(존재하는 것만 적용, 나머지는 뒤에 첫 등장 순으로).
_COLUMN_ORDER = ["store", "spent_at", "date", "amount", "category", "cid", "bid"]


def _to_dataframe(transactions: list[dict]) -> pd.DataFrame:
    """내역 목록을 보기 좋은 컬럼 순서·한글 헤더의 DataFrame 으로 만든다."""
    df = pd.DataFrame(transactions)
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
