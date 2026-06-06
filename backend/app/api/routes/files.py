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

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user_id
from app.core.supabase_client import get_supabase
from app.models.schemas import FileCreate
from app.services import export_service

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


def _fetch_transactions(tx_ids: list[str]) -> list[dict]:
    """transaction_ids 목록으로 지출 내역을 조회한다."""
    if not tx_ids:
        return []
    sb = get_supabase()
    return sb.table("transactions").select("*").in_("id", tx_ids).execute().data or []


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
    transactions = _fetch_transactions(tx_ids)
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
    transactions = _fetch_transactions(tx_ids)
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
