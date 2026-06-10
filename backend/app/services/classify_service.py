"""카테고리 분류: Kakao Local API + 캐싱 + 키워드 Fallback.

제안서 3.4 위험 대책 반영:
- 캐싱: 같은 가게명은 먼저 캐시에서 조회하여 API 호출 비용을 줄인다.
- Fallback: 외부 API 실패/키 없음 시 키워드 규칙으로 대체해 시스템 중단을 막는다.

분류 체인: (1) 캐시 → (2) Kakao Local API → (3) 키워드 규칙 → (4) '기타'.
결과는 카테고리 '문자열'이라 거래 스키마와 무관(스키마 확정과 독립적으로 동작).

캐시는 현재 인메모리(dict)다. DB 캐시 테이블 스키마가 확정되면
`_cache_get`/`_cache_set` 만 Supabase 연동으로 교체하면 된다(_TODO 표시).
"""
from __future__ import annotations

import requests

from app.core.config import settings

# 서비스가 사용하는 카테고리 집합 (영수증 샘플 유형 기준).
CATEGORIES = [
    "식비",
    "카페/간식",
    "편의점",
    "마트/쇼핑",
    "의료/건강",
    "교통",
    "문화/여가",
    "의류",
    "기타",
]
DEFAULT_CATEGORY = "기타"

# Kakao Local 의 category_group_code → 우리 카테고리.
# (코드표: MT1 대형마트, CS2 편의점, FD6 음식점, CE7 카페, HP8 병원, PM9 약국,
#          CT1 문화시설, AT4 관광명소 등)
_KAKAO_CODE_MAP = {
    "MT1": "마트/쇼핑",
    "CS2": "편의점",
    "FD6": "식비",
    "CE7": "카페/간식",
    "HP8": "의료/건강",
    "PM9": "의료/건강",
    "CT1": "문화/여가",
}

# 키워드 규칙: 가게명/품목에 아래 토큰이 들어가면 해당 카테고리.
# 앞쪽 카테고리부터 우선 매칭하므로, 더 구체적인 규칙을 위에 둔다.
_KEYWORD_RULES: list[tuple[str, list[str]]] = [
    ("편의점", ["gs25", "cu", "씨유", "세븐일레븐", "7-eleven", "이마트24", "미니스톱", "편의점"]),
    ("카페/간식", ["스타벅스", "starbucks", "커피", "카페", "투썸", "이디야", "빽다방",
                "메가커피", "메가엠지씨", "컴포즈", "베이커리", "파리바게뜨", "뚜레쥬르", "공차"]),
    ("마트/쇼핑", ["이마트", "emart", "홈플러스", "롯데마트", "코스트코", "하나로마트",
                "다이소", "이케아", "ikea", "올리브영", "마트"]),
    ("의류", ["유니클로", "uniqlo", "자라", "zara", "무신사", "스파오", "탑텐", "에이치앤엠",
            "h&m", "의류", "패션"]),
    ("의료/건강", ["약국", "병원", "의원", "한의원", "치과", "이비인후과", "정형외과",
                "내과", "메디", "약품"]),
    ("교통", ["택시", "버스", "지하철", "주유소", "주유", "충전소", "주차", "코레일",
            "srt", "ktx", "톨게이트", "하이패스"]),
    ("문화/여가", ["cgv", "메가박스", "megabox", "롯데시네마", "영화", "씨네", "pc방",
                "노래", "볼링", "찜질방", "워터파크", "놀이공원"]),
    ("식비", ["식당", "김밥", "분식", "국밥", "치킨", "피자", "버거", "롯데리아", "lotteria",
            "맥도날드", "버거킹", "맘스터치", "kfc", "한솥", "백반", "고기", "포차",
            "주점", "배달", "푸드"]),
]


# ---------------------------------------------------------------------------
# 캐시 (현재 인메모리. _TODO: 스키마 확정 후 Supabase 테이블로 교체)
# ---------------------------------------------------------------------------
_cache: dict[str, str] = {}


def _cache_key(store: str) -> str:
    return store.strip().lower()


def _cache_get(store: str) -> str | None:
    return _cache.get(_cache_key(store))


def _cache_set(store: str, category: str) -> None:
    _cache[_cache_key(store)] = category


def clear_cache() -> None:
    """테스트/관리용 캐시 초기화."""
    _cache.clear()


# ---------------------------------------------------------------------------
# (2) Kakao Local API — 가게명으로 장소를 검색해 카테고리 코드를 얻는다.
# ---------------------------------------------------------------------------
_KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def _classify_by_kakao(store: str) -> str | None:
    """Kakao Local 키워드 검색으로 카테고리를 추정. 키 없음/실패 시 None."""
    if not settings.KAKAO_API_KEY:
        return None
    try:
        resp = requests.get(
            _KAKAO_URL,
            params={"query": store, "size": 1},
            headers={"Authorization": f"KakaoAK {settings.KAKAO_API_KEY}"},
            timeout=3,
        )
        resp.raise_for_status()
        docs = resp.json().get("documents", [])
    except (requests.RequestException, ValueError):
        return None  # 네트워크/JSON 오류 → 폴백으로

    if not docs:
        return None
    return _KAKAO_CODE_MAP.get(docs[0].get("category_group_code", ""))


# ---------------------------------------------------------------------------
# (3) 키워드 규칙 — 외부 API 없이 동작하는 폴백.
# ---------------------------------------------------------------------------
def _classify_by_keyword(store: str, items: list[str] | None) -> str | None:
    """가게명·품목 텍스트에서 키워드를 찾아 카테고리를 정한다."""
    haystack = " ".join([store, *(items or [])]).lower()
    for category, keywords in _KEYWORD_RULES:
        if any(kw in haystack for kw in keywords):
            return category
    return None


# ---------------------------------------------------------------------------
# 최상위 진입점
# ---------------------------------------------------------------------------
def classify(store: str, items: list[str] | None = None) -> str:
    """가게명(과 품목)으로 지출 카테고리를 반환한다.

    체인: 캐시 → Kakao Local API → 키워드 규칙 → '기타'.
    어떤 경로로든 항상 유효한 카테고리 문자열을 반환한다(예외 전파 X).
    """
    store = (store or "").strip()
    if not store:
        return DEFAULT_CATEGORY

    cached = _cache_get(store)
    if cached is not None:
        return cached

    category = (
        _classify_by_kakao(store)
        or _classify_by_keyword(store, items)
        or DEFAULT_CATEGORY
    )
    # '기타'는 분류 실패(일시적 API 장애·키 미설정 포함)의 결과일 수 있으므로
    # 캐싱하지 않는다 — 다음 호출에서 재분류 기회를 남긴다.
    if category != DEFAULT_CATEGORY:
        _cache_set(store, category)
    return category
