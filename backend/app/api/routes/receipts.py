"""영수증 업로드 / OCR 라우터."""
from fastapi import APIRouter, UploadFile, File, HTTPException

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
