"""Bill-Gets 백엔드 진입점 (FastAPI)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, receipts, transactions, analytics, files
from app.core.config import settings

app = FastAPI(title="Bill-Gets API", version="0.1.0")

# CORS - 허용 출처는 환경변수 CORS_ORIGINS(콤마 구분, "*" 가능)로 설정.
# 인증은 Authorization 헤더(Bearer)라 쿠키가 없어 "*" 사용 시 credentials는 끈다.
_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
_allow_all = "*" in _origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _origins,
    allow_credentials=not _allow_all,  # "*" + credentials 조합은 브라우저가 차단함
    allow_methods=["*"],
    allow_headers=["*"],
)

# 기능별 라우터 등록
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(receipts.router, prefix="/receipts", tags=["receipts"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(files.router, prefix="/files", tags=["files"])


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Bill-Gets API"}
