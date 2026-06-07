"""환경 변수 로드 및 설정."""
import logging
import os
import secrets
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("uvicorn.error")


def _load_jwt_secret() -> str:
    """JWT 서명 비밀키 로드.

    미설정이거나 안전하지 않은 기본값(change-me)이면 토큰 위조를 막기 위해
    프로세스마다 임의의 강한 비밀키를 생성한다. 이 경우 재시작 시 기존 토큰이
    모두 무효화되므로, 운영/데모 환경에서는 .env에 JWT_SECRET을 반드시 지정할 것.
    """
    value = os.getenv("JWT_SECRET", "").strip()
    if not value or value == "change-me":
        logger.warning(
            "JWT_SECRET이 설정되지 않아 임의의 1회용 비밀키를 생성했습니다. "
            "재시작하면 발급된 토큰이 모두 무효화됩니다(재로그인 필요). "
            "운영/데모에서는 .env에 JWT_SECRET을 지정하세요."
        )
        return secrets.token_urlsafe(64)
    return value


class Settings:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    KAKAO_API_KEY = os.getenv("KAKAO_API_KEY", "")

    JWT_SECRET = _load_jwt_secret()
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # CORS 허용 출처. 콤마로 구분(예: "http://localhost:5173,https://app.example.com").
    # "*" 이면 모든 출처 허용(임시 데모/터널용). 기본값은 Vite 개발 서버.
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173")


settings = Settings()
