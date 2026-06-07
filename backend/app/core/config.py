"""환경 변수 로드 및 설정."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    KAKAO_API_KEY = os.getenv("KAKAO_API_KEY", "")

    JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # CORS 허용 출처. 콤마로 구분(예: "http://localhost:5173,https://app.example.com").
    # "*" 이면 모든 출처 허용(임시 데모/터널용). 기본값은 Vite 개발 서버.
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173")


settings = Settings()
