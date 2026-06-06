"""영수증 OCR 인식 파이프라인.

흐름: 이미지 바이트 -> (1) OpenCV 전처리 -> (2) EasyOCR 텍스트 추출
      -> (3) Regex 1차 파싱 -> (4) 필요 시 Claude 보완 -> 구조화된 결과 반환

제안서 매핑:
- 가게명/날짜처럼 규칙적인 필드는 Regex 로 빠르게 추출 (저비용).
- Regex 로 못 잡은 항목(금액/품목 등)은 Claude 로 보완 (폴백).
- 성공 기준(제안서 3.5): 신뢰도 >= 0.85, 응답 <= 10초.
"""
from __future__ import annotations

import re
import time

import cv2
import numpy as np

# EasyOCR Reader 는 모델 로딩이 무거워서, 프로그램 당 한 번만 생성해 재사용한다.
_reader = None


def get_reader():
    """EasyOCR Reader 싱글톤. 첫 호출 때만 모델을 로딩한다."""
    global _reader
    if _reader is None:
        import easyocr  # 무거운 import 이므로 함수 안에서 지연 로딩

        # 한국어 + 영어(숫자/상호 영문 대비). GPU 없으면 CPU 로 동작.
        # verbose=False: 진행바(█) 출력이 일부 콘솔(cp949 등)에서 인코딩 오류를 일으키는 것 방지.
        _reader = easyocr.Reader(["ko", "en"], gpu=False, verbose=False)
    return _reader


# ---------------------------------------------------------------------------
# (1) 전처리 — 사진을 OCR 이 읽기 좋은 형태로 다듬는다.
# ---------------------------------------------------------------------------
def preprocess(image_bytes: bytes) -> np.ndarray:
    """영수증 이미지를 흑백·고대비로 정리해 인식률을 높인다."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("이미지를 디코딩할 수 없습니다. 지원되는 이미지 파일인지 확인하세요.")

    # 흑백 변환 (색은 글자 인식에 불필요)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 글자가 너무 작으면 키워서 인식률을 올린다 (가로 기준 1000px 이상으로).
    h, w = gray.shape
    if w < 1000:
        scale = 1000 / w
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    # 잡음 제거 후, 조명 차이에 강한 적응형 이진화로 글자/배경을 또렷하게.
    gray = cv2.fastNlMeansDenoising(gray, h=10)
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11
    )
    return binary


# ---------------------------------------------------------------------------
# (2) 텍스트 추출 — EasyOCR
# ---------------------------------------------------------------------------
def extract_text(image_bytes: bytes) -> dict:
    """전처리 후 EasyOCR 로 텍스트를 추출하고 평균 신뢰도를 함께 반환."""
    processed = preprocess(image_bytes)
    reader = get_reader()
    # detail=1 -> (bbox, text, confidence) 튜플 목록 반환
    results = reader.readtext(processed, detail=1, paragraph=False)

    lines = [text for (_box, text, _conf) in results]
    confs = [conf for (_box, _text, conf) in results]
    avg_conf = round(sum(confs) / len(confs), 3) if confs else 0.0

    return {"lines": lines, "text": "\n".join(lines), "confidence": avg_conf}


# ---------------------------------------------------------------------------
# (3) Regex 1차 파싱 — 규칙이 뚜렷한 필드부터 뽑는다.
# ---------------------------------------------------------------------------
# 날짜: 2026-04-01 / 2026.04.01 / 2026/04/01 / 2026년 4월 1일
_DATE_RE = re.compile(
    r"(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})"
)
# 합계/총액/결제금액 줄의 숫자 (콤마 포함)
_TOTAL_RE = re.compile(
    r"(?:합\s*계|총\s*액|결제\s*금액|받을\s*금액|판매\s*금액)\D*([\d,]{2,})"
)
# 일반 금액 토큰 (원/₩ 포함 또는 콤마가 있는 숫자)
_AMOUNT_RE = re.compile(r"([\d,]{3,})\s*원|₩\s*([\d,]{3,})|([\d]{1,3}(?:,\d{3})+)")

# --- 품목 파싱용 패턴 ---------------------------------------------------------
# 가격 토큰: '1,500' / '1, 500'(OCR 공백) / '5000원' / '₩5000'.
# 콤마 묶음은 OCR 이 콤마 뒤에 공백을 넣는 경우가 잦아 '\s?' 로 허용한다.
_PRICE_TOKEN = r"\d{1,3}(?:,\s?\d{3})+|\d{2,6}\s*원|₩\s*\d{2,6}"
# '이름 ... 가격' 형태(같은 줄). 이름부와 가격부를 분리 캡처.
_ITEM_INLINE_RE = re.compile(rf"^(?P<name>.*?)(?P<price>{_PRICE_TOKEN})\s*$")
# 가격만 단독으로 있는 줄(직전 이름 줄과 페어링).
_PRICE_ONLY_RE = re.compile(rf"^\s*(?P<price>{_PRICE_TOKEN})\s*$")
# 품목 영역의 끝 = 합계/총액/결제 정보가 시작되는 줄.
_ITEM_END_RE = re.compile(
    r"합\s*계|총\s*(?:합|액)|구\s*매\s*액|판\s*매\s*(?:금|총)|받을\s*금액|청\s*구\s*액"
)
# 품목이 아닌 메타정보 줄(사업자번호·전화·승인번호·카드 등)을 걸러낸다.
_ITEM_NOISE_RE = re.compile(
    r"\d{3}-\d{2}-\d{5}"                 # 사업자등록번호
    r"|\d{2,4}-\d{3,4}-\d{4}"           # 전화번호
    r"|T\s*:|TEL"                        # 전화 표기
    r"|POS|승\s*인|거\s*래\s*번\s*호|영\s*수\s*증|카\s*드|대\s*표|점\s*장"
    r"|담\s*당|매\s*장|주\s*소|단\s*가|수\s*량|제\s*품\s*명|상\s*품\s*명"
    r"|메\s*뉴|품\s*목|과\s*세|부\s*가|금\s*액"
)


def _to_int(num_str: str) -> int:
    return int(re.sub(r"[^\d]", "", num_str))


def _clean_item_name(raw: str) -> str | None:
    """품목명 후보를 다듬는다. 너무 짧거나 기호/숫자뿐이면 None."""
    name = raw.strip(" \t-~·.:)([]")
    # 글자(한글/영문)가 2자 미만이면 품목명으로 보지 않는다.
    if len(re.sub(r"[^0-9A-Za-z가-힣]", "", name)) < 2:
        return None
    if re.fullmatch(r"[\d,\s원₩]+", name):
        return None
    return name


def parse_items(lines: list[str]) -> list[dict]:
    """품목 목록을 추출한다.

    한국 영수증 OCR 특성에 맞춰:
    - 합계 줄 이전(= 품목 영역)만 본다.
    - 사업자번호/전화/승인번호 등 메타 줄은 제외한다.
    - '이름↵가격'으로 줄이 분리된 레이아웃을 페어링한다.
    """
    # 1) 품목 영역 한정: 첫 합계/총액 줄 전까지.
    end = len(lines)
    for i, ln in enumerate(lines):
        if _ITEM_END_RE.search(ln):
            end = i
            break
    region = lines[:end]

    items: list[dict] = []
    pending_name: str | None = None  # 직전 줄에서 본 이름(가격 줄을 기다리는 중)
    for ln in region:
        if _ITEM_NOISE_RE.search(ln):
            pending_name = None
            continue

        # (a) 같은 줄에 '이름 가격' 둘 다 있는 경우
        m = _ITEM_INLINE_RE.match(ln)
        if m:
            name = _clean_item_name(m.group("name"))
            price = _to_int(m.group("price"))
            if name and price > 0:
                items.append({"name": name, "price": price})
                pending_name = None
                continue
            # 가격만 있는 줄(이름부가 비거나 무의미) → 직전 이름과 페어링
            if not name and pending_name and price > 0:
                items.append({"name": pending_name, "price": price})
                pending_name = None
                continue

        # (b) 가격만 단독으로 있는 줄 → 직전 이름과 페어링
        pm = _PRICE_ONLY_RE.match(ln)
        if pm:
            price = _to_int(pm.group("price"))
            if pending_name and price > 0:
                items.append({"name": pending_name, "price": price})
            pending_name = None
            continue

        # (c) 가격 없는 텍스트 줄 → 다음 가격 줄을 위한 이름 후보로 보관
        name = _clean_item_name(ln)
        if name:
            pending_name = name

    return items


def parse_fields(text: str) -> dict:
    """OCR 텍스트에서 날짜·금액·가게명·품목을 1차로 뽑아낸다."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # 날짜
    date = None
    m = _DATE_RE.search(text)
    if m:
        y, mo, d = m.groups()
        date = f"{y}-{int(mo):02d}-{int(d):02d}"

    # 금액: '합계/총액' 줄을 우선, 없으면 가장 큰 금액을 결제액으로 추정
    amount = None
    mt = _TOTAL_RE.search(text)
    if mt:
        amount = _to_int(mt.group(1))
    else:
        candidates = []
        for am in _AMOUNT_RE.finditer(text):
            raw = next((g for g in am.groups() if g), None)
            if raw:
                try:
                    candidates.append(_to_int(raw))
                except ValueError:
                    pass
        if candidates:
            amount = max(candidates)  # 영수증에서 가장 큰 금액 = 총액일 가능성이 높음

    # 가게명: 보통 영수증 맨 위쪽 줄. 숫자/금액/사업자번호 줄은 제외.
    store = None
    for ln in lines[:5]:
        if _DATE_RE.search(ln) or re.search(r"\d{3}-\d{2}-\d{5}", ln):
            continue
        if len(re.sub(r"[^0-9,]", "", ln)) > len(ln) * 0.5:
            continue  # 숫자가 절반 이상이면 가게명 아님
        if len(ln) >= 2:
            store = ln
            break

    # 품목: 영수증 품목 영역에서 '이름/가격'을 페어링해 수집.
    items = parse_items(lines)

    return {"store": store, "date": date, "amount": amount, "items": items}


# ---------------------------------------------------------------------------
# (4) Claude 보완(폴백) — Regex 가 핵심 필드를 못 잡았을 때만 호출.
# ---------------------------------------------------------------------------
def _needs_fallback(fields: dict, confidence: float) -> bool:
    return (
        fields.get("store") is None
        or fields.get("amount") is None
        or fields.get("date") is None
        or confidence < 0.85
    )


def claude_parse(ocr_text: str) -> dict | None:
    """OCR 텍스트를 Claude 에게 주고 JSON 으로 구조화하도록 요청 (선택적 폴백).

    ANTHROPIC_API_KEY 가 없으면 None 을 반환해 폴백을 건너뛴다.
    """
    try:
        from app.core.config import settings
    except Exception:
        # 단독 스크립트 실행 등 설정 모듈을 못 찾는 경우
        import os

        class _S:  # noqa
            ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

        settings = _S()  # type: ignore

    if not settings.ANTHROPIC_API_KEY:
        return None

    import json

    from anthropic import Anthropic

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    prompt = (
        "다음은 영수증 OCR 로 추출한 텍스트야. 여기서 가게명(store), 날짜(date, YYYY-MM-DD), "
        "총 결제금액(amount, 정수), 품목 목록(items: [{name, price}])을 뽑아서 "
        "JSON 으로만 답해줘. 모르면 null.\n\n---\n" + ocr_text
    )
    # TODO: 모델 ID 는 비용/정확도에 맞춰 조정 (예: 비용 효율적인 Haiku)
    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    # 코드블록(```)이 섞여 와도 JSON 부분만 파싱
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# 최상위 진입점
# ---------------------------------------------------------------------------
def recognize_receipt(image_bytes: bytes, use_fallback: bool = True) -> dict:
    """영수증 이미지 한 장을 받아 구조화된 지출 정보를 반환한다.

    반환 예:
    {
      "store": "스타벅스 강남점", "date": "2026-04-01", "amount": 8500,
      "items": [...], "confidence": 0.91, "elapsed_sec": 3.2, "source": "regex"
    }
    """
    started = time.perf_counter()

    ocr = extract_text(image_bytes)
    fields = parse_fields(ocr["text"])
    source = "regex"

    if use_fallback and _needs_fallback(fields, ocr["confidence"]):
        improved = claude_parse(ocr["text"])
        if improved:
            # Regex 가 비워둔 칸만 Claude 결과로 채운다.
            for key in ("store", "date", "amount", "items"):
                if not fields.get(key) and improved.get(key):
                    fields[key] = improved[key]
            source = "regex+claude"

    fields["confidence"] = ocr["confidence"]
    fields["elapsed_sec"] = round(time.perf_counter() - started, 2)
    fields["source"] = source
    fields["raw_text"] = ocr["text"]
    return fields
