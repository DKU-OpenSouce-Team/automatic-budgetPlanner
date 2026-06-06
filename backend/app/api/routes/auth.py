"""회원가입 / 로그인 라우터."""
from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.core.supabase_client import get_supabase
from app.models.schemas import TokenResponse, UserCreate, UserResponse

router = APIRouter()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: UserCreate):
    """이메일·비밀번호로 회원가입 후 JWT 반환."""
    sb = get_supabase()

    existing = sb.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")

    hashed = hash_password(body.password)
    result = (
        sb.table("users")
        .insert({"email": body.email, "hashed_password": hashed})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="회원가입에 실패했습니다.")
    new_user = result.data[0]

    token = create_access_token(new_user["id"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=new_user["id"], email=new_user["email"]),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: UserCreate):
    """이메일·비밀번호 로그인 후 JWT 반환."""
    sb = get_supabase()

    result = sb.table("users").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    user = result.data[0]
    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    token = create_access_token(user["id"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"]),
    )
