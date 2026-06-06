"""Excel/CSV 내보내기 단위테스트."""
import io

import pandas as pd

from app.services import export_service as ex

ROWS = [
    {"store": "스타벅스", "spent_at": "2026-04-01", "amount": 8500, "category": "카페"},
    {"store": "CU", "spent_at": "2026-04-02", "amount": 3000, "category": "편의점"},
]


def test_to_excel_is_valid_xlsx_with_korean_headers():
    blob = ex.to_excel(ROWS)
    assert blob[:2] == b"PK"  # xlsx(zip) 시그니처
    df = pd.read_excel(io.BytesIO(blob))
    assert len(df) == 2
    assert "가게명" in df.columns and "금액" in df.columns


def test_to_csv_has_utf8_bom_and_korean_header():
    blob = ex.to_csv(ROWS)
    assert blob[:3] == b"\xef\xbb\xbf"  # 엑셀 한글 호환용 BOM
    header = blob.decode("utf-8-sig").splitlines()[0]
    assert header.startswith("가게명")


def test_empty_input_still_produces_files():
    assert ex.to_excel([])[:2] == b"PK"
    assert ex.to_csv([]).startswith(b"\xef\xbb\xbf")


def test_unknown_keys_pass_through():
    # 스키마가 바뀌어 모르는 키가 와도 그대로 내보냄(스키마 변경 견딤).
    csv = ex.to_csv([{"store": "X", "amount": 1, "미래필드": "값"}]).decode("utf-8-sig")
    assert "미래필드" in csv.splitlines()[0]
