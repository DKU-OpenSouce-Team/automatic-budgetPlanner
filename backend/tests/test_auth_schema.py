"""UserCreate 입력 검증 단위테스트 (비밀번호 bcrypt 72바이트 한계 등)."""
import pytest
from pydantic import ValidationError

from app.models.schemas import UserCreate


def test_password_at_bcrypt_limit_is_accepted():
    user = UserCreate(email="a@example.com", password="x" * 72)
    assert len(user.password.encode("utf-8")) == 72


def test_password_over_bcrypt_limit_is_rejected():
    with pytest.raises(ValidationError):
        UserCreate(email="a@example.com", password="x" * 73)


def test_multibyte_password_over_limit_is_rejected():
    # 한글 1자 = UTF-8 3바이트 → 25자(75바이트)면 한계 초과
    with pytest.raises(ValidationError):
        UserCreate(email="a@example.com", password="가" * 25)


def test_empty_password_is_rejected():
    with pytest.raises(ValidationError):
        UserCreate(email="a@example.com", password="")
