"""Supabase 클라이언트 초기화."""
from supabase import create_client, Client
from app.core.config import settings

_client: Client | None = None


def get_supabase() -> Client:
    """싱글톤 패턴으로 Supabase 클라이언트를 반환한다."""
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client
