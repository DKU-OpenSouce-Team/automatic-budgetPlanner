"""카테고리 분류 단위테스트. Kakao 키 없이 키워드 폴백 + 매핑(모의) 검증."""
import pytest

from app.services import classify_service as cs


@pytest.fixture(autouse=True)
def _clear_cache():
    cs.clear_cache()
    yield
    cs.clear_cache()


@pytest.mark.parametrize(
    "store,expected",
    [
        ("스타벅스 강남점", "카페/간식"),
        ("GS25 역삼점", "편의점"),
        ("이마트 성수점", "마트/쇼핑"),
        ("롯데리아", "식비"),
        ("CGV 왕십리", "문화/여가"),
        ("유니클로 명동", "의류"),
        ("서울중앙약국", "의료/건강"),
        ("개인택시", "교통"),
        ("듣도보도못한가게", "기타"),
    ],
)
def test_classify_by_keyword(store, expected):
    assert cs.classify(store) == expected


def test_classify_uses_items_when_store_is_ambiguous():
    assert cs.classify("무인매장", ["아메리카노", "카페라떼"]) == "카페/간식"


def test_classify_caches_result():
    cs.classify("스타벅스")
    assert cs._cache_key("스타벅스") in cs._cache


def test_classify_does_not_cache_default_category():
    assert cs.classify("듣도보도못한가게") == "기타"
    assert cs._cache_key("듣도보도못한가게") not in cs._cache


def test_kakao_code_is_mapped_to_category(monkeypatch):
    monkeypatch.setattr(cs.settings, "KAKAO_API_KEY", "DUMMY")

    class _Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"documents": [{"category_group_code": "CE7"}]}

    monkeypatch.setattr(cs.requests, "get", lambda *a, **k: _Resp())
    assert cs._classify_by_kakao("아무카페") == "카페/간식"


def test_kakao_returns_none_without_key(monkeypatch):
    monkeypatch.setattr(cs.settings, "KAKAO_API_KEY", "")
    assert cs._classify_by_kakao("스타벅스") is None


def test_kakao_returns_none_on_network_error(monkeypatch):
    monkeypatch.setattr(cs.settings, "KAKAO_API_KEY", "DUMMY")

    def _boom(*a, **k):
        raise cs.requests.RequestException("down")

    monkeypatch.setattr(cs.requests, "get", _boom)
    assert cs._classify_by_kakao("가게") is None
