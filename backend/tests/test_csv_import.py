"""은행 CSV 파싱 단위테스트 (csv_import_service.parse_rows)."""
from app.services import csv_import_service as ci


def _b(text: str) -> bytes:
    return text.encode("utf-8")


def test_bank_csv_with_in_out_columns():
    csv = (
        "거래일자,적요,출금액,입금액\n"
        "2026-06-01,스타벅스,5500,\n"
        "2026-06-03,월급,,3200000\n"
    )
    rows = ci.parse_rows(_b(csv))
    assert len(rows) == 2
    expense = rows[0]
    assert expense["store"] == "스타벅스" and expense["amount"] == 5500
    assert expense["is_income"] is False and expense["spent_at"] == "2026-06-01"
    income = rows[1]
    assert income["amount"] == 3200000 and income["is_income"] is True


def test_card_csv_single_amount_is_expense():
    csv = "이용일자,가맹점명,이용금액\n2026.06.05,롯데리아,8900\n"
    rows = ci.parse_rows(_b(csv))
    assert len(rows) == 1
    assert rows[0]["amount"] == 8900 and rows[0]["is_income"] is False
    assert rows[0]["spent_at"] == "2026-06-05"


def test_various_date_formats_and_won_amount():
    csv = (
        "날짜,가맹점,금액\n"
        "20260607,GS25,\"1,800원\"\n"
        "2026/06/08,버스,1400\n"
    )
    rows = ci.parse_rows(_b(csv))
    assert [r["spent_at"] for r in rows] == ["2026-06-07", "2026-06-08"]
    assert rows[0]["amount"] == 1800


def test_rows_without_date_or_amount_are_skipped():
    csv = (
        "거래일자,적요,출금액\n"
        ",누락날짜,1000\n"        # 날짜 없음 → 스킵
        "2026-06-01,금액없음,\n"   # 금액 없음 → 스킵
        "2026-06-02,정상,3000\n"
    )
    rows = ci.parse_rows(_b(csv))
    assert len(rows) == 1 and rows[0]["store"] == "정상"


def test_empty_store_defaults_and_cp949_decoding():
    # cp949 인코딩 + 가게명 비어있음
    csv = "거래일자,가맹점명,금액\n2026-06-01,,5000\n"
    rows = ci.parse_rows(csv.encode("cp949"))
    assert len(rows) == 1 and rows[0]["store"] == "기타"
