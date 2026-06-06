"""영수증 업로드 / OCR 라우터."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status

from app.core.security import get_current_user_id
from app.core.supabase_client import get_supabase
from app.models.schemas import TransactionFromClient
from app.services import ocr_service

router = APIRouter()


@router.post("")
async def upload_receipt(image: UploadFile = File(...)):
    """영수증 이미지를 받아 OCR 로 인식한 결과를 반환한다.

    프론트엔드는 이 결과를 사용자에게 보여주고, 사용자가 확인/수정한 뒤
    /transactions 로 저장한다. (제안서 2.1.1 '추출 텍스트 수동 조정')
    """
    if image.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="지원하지 않는 이미지 형식입니다.")

    image_bytes = await image.read()
    try:
        result = ocr_service.recognize_receipt(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # TODO: 카테고리 자동 분류(classify_service) 연동 후 결과에 category 추가
    return result


@router.post("/confirm", status_code=status.HTTP_201_CREATED)
def confirm_receipt(
    body: TransactionFromClient,
    user_id: str = Depends(get_current_user_id),
):
    """OCR 결과를 사용자가 확인/수정 후 지출 내역으로 저장."""
    sb = get_supabase()
    result = sb.table("transactions").insert({
        "user_id": user_id,
        "store": body.store,
        "amount": body.amount,
        "spent_at": body.date,
        "category": body.category,
    }).execute()
    return result.data[0]
