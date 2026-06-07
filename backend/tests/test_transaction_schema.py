"""거래 입력 스키마의 금액 부호 정규화 단위테스트.

DB는 금액을 부호 없는 '크기'로 저장한다(수입/지출 구분은 category).
편집 화면이 정규화된 음수값을 보내도 음수가 저장되지 않아야 analytics 집계가 정확하다.
"""
from app.models.schemas import TransactionFromClient, TransactionUpdateFromClient


def test_create_negative_amount_is_stored_as_magnitude():
    body = TransactionFromClient(store="가게", amount=-5000, date="2026-06-08")
    assert body.amount == 5000


def test_create_positive_amount_unchanged():
    body = TransactionFromClient(store="가게", amount=5000, date="2026-06-08")
    assert body.amount == 5000


def test_update_negative_amount_is_stored_as_magnitude():
    body = TransactionUpdateFromClient(amount=-5000)
    assert body.amount == 5000


def test_update_amount_none_stays_none():
    body = TransactionUpdateFromClient(store="새이름")
    assert body.amount is None
