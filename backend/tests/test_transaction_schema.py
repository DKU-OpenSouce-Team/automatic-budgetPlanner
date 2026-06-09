"""거래 입력 스키마 검증 단위테스트.

- 금액: DB는 부호 없는 '크기'로 저장(수입/지출 구분은 category). 음수 입력도 절대값 통일.
- 날짜: 미래 날짜·잘못된 형식은 거부(프론트뿐 아니라 API 우회도 막는다).
"""
from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.models.schemas import TransactionFromClient, TransactionUpdateFromClient

_PAST = "2020-01-01"
_TODAY = date.today().isoformat()
_FUTURE = (date.today() + timedelta(days=1)).isoformat()


def test_create_negative_amount_is_stored_as_magnitude():
    body = TransactionFromClient(store="가게", amount=-5000, date=_PAST)
    assert body.amount == 5000


def test_create_positive_amount_unchanged():
    body = TransactionFromClient(store="가게", amount=5000, date=_PAST)
    assert body.amount == 5000


def test_update_negative_amount_is_stored_as_magnitude():
    body = TransactionUpdateFromClient(amount=-5000)
    assert body.amount == 5000


def test_update_amount_none_stays_none():
    body = TransactionUpdateFromClient(store="새이름")
    assert body.amount is None


def test_create_today_is_accepted():
    body = TransactionFromClient(store="가게", amount=1000, date=_TODAY)
    assert body.date == _TODAY


def test_create_future_date_is_rejected():
    with pytest.raises(ValidationError):
        TransactionFromClient(store="가게", amount=1000, date=_FUTURE)


def test_create_malformed_date_is_rejected():
    with pytest.raises(ValidationError):
        TransactionFromClient(store="가게", amount=1000, date="2026/06/08")


def test_update_future_date_is_rejected():
    with pytest.raises(ValidationError):
        TransactionUpdateFromClient(date=_FUTURE)


def test_update_date_none_is_accepted():
    body = TransactionUpdateFromClient(store="새이름")
    assert body.date is None
