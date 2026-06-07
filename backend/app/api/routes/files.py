"""나만의 파일 CRUD + Excel/CSV 내보내기.

DB 테이블: user_files
  id              uuid PK
  user_id         uuid (users.id)
  name            text
  description     text nullable
  transaction_ids uuid[]  -- 선택한 지출 내역 ID 배열
  created_at      timestamptz
"""
import io
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user_id
from app.core.supabase_client import get_supabase
from app.models.schemas import FileCreate
from app.services import classify_service, csv_import_service, export_service

router = APIRouter()


def _get_owned_file(file_id: str, user_id: str) -> dict:
    """파일이 존재하고 본인 소유인지 확인. 아니면 404."""
    sb = get_supabase()
    result = (
        sb.table("user_files")
        .select("*")
        .eq("id", file_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return result.data[0]


def _fetch_transactions(tx_ids: list[str], user_id: str) -> list[dict]:
    """transaction_ids 목록으로 지출 내역을 조회한다 (본인 소유만)."""
    if not tx_ids:
        return []
    sb = get_supabase()
    return (
        sb.table("transactions")
        .select("*")
        .in_("id", tx_ids)
        .eq("user_id", user_id)
        .execute()
        .data or []
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_file(
    body: FileCreate,
    user_id: str = Depends(get_current_user_id),
):
    """선택한 지출 내역으로 나만의 파일 생성."""
    sb = get_supabase()
    result = sb.table("user_files").insert({
        "user_id": user_id,
        "name": body.name,
        "description": body.description,
        "transaction_ids": body.transaction_ids,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="파일 생성에 실패했습니다.")
    row = result.data[0]
    return {**row, "count": len(body.transaction_ids)}


@router.post("/csv", status_code=status.HTTP_201_CREATED)
async def import_csv(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """은행/카드 거래내역 CSV를 받아 지출 내역으로 가져온다.

    - 컬럼명 유연 매칭(날짜/가게명/출금·입금·금액)으로 파싱.
    - 수입(입금)은 카테고리 '수입', 그 외는 가게명으로 자동 분류.
    - 같은 날짜·금액·가게는 기존 내역과 대조해 중복 제외(재업로드 안전).
    """
    raw = await file.read()
    try:
        parsed = csv_import_service.parse_rows(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="CSV를 파싱하지 못했습니다. 파일 형식을 확인해주세요.")
    if not parsed:
        raise HTTPException(
            status_code=400,
            detail="추가할 거래를 찾지 못했습니다. (날짜·금액 컬럼이 있는지 확인해주세요)",
        )

    sb = get_supabase()
    # 중복 제거: 기존 내역의 (가게, 금액, 날짜) 집합과 대조.
    existing = (
        sb.table("transactions")
        .select("store,amount,spent_at")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    seen = {(r.get("store"), r.get("amount"), str(r.get("spent_at"))) for r in existing}

    rows, duplicates = [], 0
    for p in parsed:
        key = (p["store"], p["amount"], p["spent_at"])
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        category = "수입" if p["is_income"] else classify_service.classify(p["store"])
        rows.append({
            "user_id": user_id,
            "store": p["store"],
            "amount": p["amount"],
            "spent_at": p["spent_at"],
            "category": category,
            "note": p.get("note"),
        })

    inserted = 0
    if rows:
        result = sb.table("transactions").insert(rows).execute()
        inserted = len(result.data or [])
    return {"inserted": inserted, "duplicates": duplicates, "parsed": len(parsed)}


@router.get("")
def list_files(user_id: str = Depends(get_current_user_id)):
    """내 파일 목록 조회. 각 파일의 내역 건수를 함께 반환한다."""
    sb = get_supabase()
    result = (
        sb.table("user_files")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [
        {**row, "count": len(row.get("transaction_ids") or [])}
        for row in result.data
    ]


@router.get("/{file_id}")
def get_file(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """파일 상세 조회 (파일 정보 + 포함된 지출 내역 목록)."""
    row = _get_owned_file(file_id, user_id)
    tx_ids = row.get("transaction_ids") or []
    transactions = _fetch_transactions(tx_ids, user_id)
    total = sum(t.get("amount", 0) for t in transactions)
    return {**row, "count": len(tx_ids), "total": total, "transactions": transactions}


@router.get("/{file_id}/export")
def export_file(
    file_id: str,
    fmt: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    user_id: str = Depends(get_current_user_id),
):
    """파일을 Excel(xlsx) 또는 CSV로 다운로드한다. fmt=xlsx|csv (기본: xlsx)."""
    row = _get_owned_file(file_id, user_id)
    tx_ids = row.get("transaction_ids") or []
    transactions = _fetch_transactions(tx_ids, user_id)
    file_name = row.get("name", "가계부")

    if fmt == "csv":
        content = export_service.to_csv(transactions)
        media_type = "text/csv"
        filename = f"{file_name}.csv"
    else:
        content = export_service.to_excel(transactions)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{file_name}.xlsx"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """파일 삭제 (본인 파일만 가능)."""
    _get_owned_file(file_id, user_id)
    sb = get_supabase()
    sb.table("user_files").delete().eq("id", file_id).execute()
