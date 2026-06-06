"""OCR 텍스트 파싱(순수 로직) 단위테스트. EasyOCR 엔진 없이 동작."""
from app.services import ocr_service as ocr


def _lines(text: str) -> list[str]:
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def test_parse_items_pairs_name_and_price_on_separate_lines():
    # 한국 영수증 OCR 특성: 이름과 가격이 다른 줄로 분리됨.
    text = "칸초\n1,500\n동원)소화잘되논초코\n1, 500\n종 구 매 액\n4,500"
    items = ocr.parse_items(_lines(text))
    assert {"name": "칸초", "price": 1500} in items
    assert any("동원" in it["name"] and it["price"] == 1500 for it in items)


def test_parse_items_excludes_metadata_and_after_total():
    # 합계 줄 이후(결제정보)·메타 줄(승인/사업자번호)은 품목에서 제외.
    lines = ["승인번호: 82305167", "사업자 123-45-67890", "합계", "5,000", "우유", "2,000"]
    assert ocr.parse_items(lines) == []


def test_parse_items_empty_when_no_valid_prices():
    # OCR 이 심하게 깨지면 거짓 품목을 만들지 않고 빈 목록.
    assert ocr.parse_items(["@U)", "대충 텍스트"]) == []


def test_parse_fields_extracts_date_amount_store():
    text = "스타벅스 강남점\n2026-04-01\n아메리카노\n4,500\n합계\n8,500"
    f = ocr.parse_fields(text)
    assert f["date"] == "2026-04-01"
    assert f["amount"] == 8500          # '합계' 줄 우선
    assert f["store"] == "스타벅스 강남점"


def test_parse_fields_amount_falls_back_to_max_when_no_total():
    # 합계 키워드가 없으면 가장 큰 금액을 결제액으로 추정.
    f = ocr.parse_fields("동네가게\n2,000\n9,900\n1,200")
    assert f["amount"] == 9900
