"""Pydantic 스키마."""
from datetime import date
from typing import Any
from pydantic import BaseModel, EmailStr


# ── 인증 ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── OCR 결과 ─────────────────────────────────────────────────────────────────
# recognize_receipt()가 반환하는 구조와 1:1 대응.
# 프론트엔드는 이 응답을 사용자에게 보여주고, 확인/수정 후 TransactionCreate로 저장한다.

class OcrItem(BaseModel):
    name: str
    price: int


class OcrResult(BaseModel):
    # OCR이 실패하면 None → 사용자가 직접 입력 (제안서 2.1.1 '추출 텍스트 수동 조정')
    store: str | None = None
    # YYYY-MM-DD 문자열; 저장 시 TransactionBase.spent_at(date)으로 변환해 전달
    date: str | None = None
    amount: int | None = None
    items: list[OcrItem] = []
    # classify_service 연동 전까지 None; 연동 후 receipts.py에서 채워서 반환
    category: str | None = None
    confidence: float
    elapsed_sec: float
    source: str        # "regex" | "regex+claude"
    raw_text: str


# ── 지출 내역 ─────────────────────────────────────────────────────────────────

class TransactionBase(BaseModel):
    store: str            # 가게명
    amount: int           # 금액
    spent_at: date        # 날짜 (OcrResult.date를 date 타입으로 변환해 전달)
    category: str | None = None
    note: str | None = None
    items: list[dict[str, Any]] = []  # 영수증 품목 목록 (OcrItem과 동일 구조)
    # 결제 유형 구분 (제안서 3.4): 카드 결제 / 현금 결제
    cid: str | None = None   # card id (카드 결제)
    bid: str | None = None   # bill id (현금 결제)


class TransactionCreate(TransactionBase):
    pass


class Transaction(TransactionBase):
    id: str
    user_id: str


# ── 프론트엔드 요청 전용 스키마 ────────────────────────────────────────────────
# 프론트엔드는 spent_at 대신 date, note 대신 memo 필드명을 사용한다.

class TransactionFromClient(BaseModel):
    """POST /transactions, POST /receipts/confirm 요청 바디."""
    store: str
    amount: int
    date: str           # YYYY-MM-DD → DB저장 시 spent_at으로 매핑
    category: str | None = None
    memo: str | None = None  # 수동 입력 메모 → note로 매핑


class TransactionUpdateFromClient(BaseModel):
    """PUT /transactions/{id} 요청 바디 (부분 업데이트)."""
    store: str | None = None
    amount: int | None = None
    date: str | None = None   # YYYY-MM-DD → spent_at으로 매핑
    category: str | None = None


# ── 나만의 파일 ───────────────────────────────────────────────────────────────

class FileCreate(BaseModel):
    """POST /files 요청 바디."""
    name: str
    description: str | None = None
    transaction_ids: list[str]  # 선택한 지출 내역 ID 목록
