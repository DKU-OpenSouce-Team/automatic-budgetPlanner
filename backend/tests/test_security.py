"""JWT/비밀번호 해싱 단위테스트."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.core import config as cfg
from app.core import security as s
from app.core.config import settings


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _token(claims: dict) -> str:
    return jwt.encode(claims, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


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


def test_get_current_user_id_returns_subject():
    token = s.create_access_token("user-xyz")
    assert s.get_current_user_id(_creds(token)) == "user-xyz"


def test_get_current_user_id_rejects_token_without_sub():
    exp = datetime.now(timezone.utc) + timedelta(minutes=5)
    with pytest.raises(HTTPException) as exc:
        s.get_current_user_id(_creds(_token({"exp": exp})))
    assert exc.value.status_code == 401


def test_get_current_user_id_rejects_empty_sub():
    exp = datetime.now(timezone.utc) + timedelta(minutes=5)
    with pytest.raises(HTTPException) as exc:
        s.get_current_user_id(_creds(_token({"sub": "", "exp": exp})))
    assert exc.value.status_code == 401


def test_jwt_secret_never_falls_back_to_known_default(monkeypatch):
    # 미설정/기본값이면 위조 가능한 'change-me'가 아니라 강한 랜덤 키를 만든다.
    monkeypatch.delenv("JWT_SECRET", raising=False)
    generated = cfg._load_jwt_secret()
    assert generated and generated != "change-me" and len(generated) >= 40

    monkeypatch.setenv("JWT_SECRET", "change-me")
    assert cfg._load_jwt_secret() != "change-me"

    monkeypatch.setenv("JWT_SECRET", "a-real-strong-secret")
    assert cfg._load_jwt_secret() == "a-real-strong-secret"
