"""JWT/비밀번호 해싱 단위테스트."""
import pytest
from fastapi import HTTPException

from app.core import security as s
from app.core.config import settings


def test_hash_is_not_plaintext_and_verifies():
    hashed = s.hash_password("hunter2!")
    assert hashed != "hunter2!"
    assert s.verify_password("hunter2!", hashed)


def test_verify_rejects_wrong_password():
    hashed = s.hash_password("correct")
    assert not s.verify_password("wrong", hashed)


def test_jwt_roundtrip_preserves_subject():
    token = s.create_access_token("user-123")
    payload = s.decode_access_token(token)
    assert payload["sub"] == "user-123"


def test_tampered_token_is_rejected():
    token = s.create_access_token("u")
    with pytest.raises(HTTPException) as exc:
        s.decode_access_token(token + "x")
    assert exc.value.status_code == 401


def test_expired_token_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", -1)
    token = s.create_access_token("u")
    with pytest.raises(HTTPException):
        s.decode_access_token(token)
