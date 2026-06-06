"""지출 내역 CRUD / 검색 라우터."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user_id
from app.core.supabase_client import get_supabase
from app.models.schemas import TransactionFromClient, TransactionUpdateFromClient

router = APIRouter()


def _fmt(row: dict) -> dict:
    """DB 레코드를 프론트엔드 형식으로 변환 (spent_at → date)."""
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "store": row["store"],
        "amount": row["amount"],
        "date": row["spent_at"],
        "category": row.get("category"),
        "note": row.get("note"),
        "items": row.get("items") or [],
        "cid": row.get("cid"),
        "bid": row.get("bid"),
    }


@router.get("")
def list_transactions(
    q: str | None = None,
    category: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    """지출 내역 목록 조회. q=가게명 검색, category=카테고리 필터."""
    sb = get_supabase()
    query = sb.table("transactions").select("*").eq("user_id", user_id)
    if q:
        query = query.ilike("store", f"%{q}%")
    if category:
        query = query.eq("category", category)
    result = query.order("spent_at", desc=True).execute()
    return [_fmt(row) for row in result.data]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_transaction(
    body: TransactionFromClient,
    user_id: str = Depends(get_current_user_id),
):
    """수동 입력 지출 내역 저장."""
    sb = get_supabase()
    result = sb.table("transactions").insert({
        "user_id": user_id,
        "store": body.store,
        "amount": body.amount,
        "spent_at": body.date,
        "category": body.category,
        "note": body.memo,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="저장에 실패했습니다.")
    return _fmt(result.data[0])


@router.put("/{tx_id}")
def update_transaction(
    tx_id: str,
    body: TransactionUpdateFromClient,
    user_id: str = Depends(get_current_user_id),
):
    """지출 내역 수정 (본인 내역만 가능)."""
    sb = get_supabase()
    existing = (
        sb.table("transactions")
        .select("id")
        .eq("id", tx_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="내역을 찾을 수 없습니다.")

    updates: dict = {}
    if body.store is not None:
        updates["store"] = body.store
    if body.amount is not None:
        updates["amount"] = body.amount
    if body.date is not None:
        updates["spent_at"] = body.date
    if body.category is not None:
        updates["category"] = body.category

    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목이 없습니다.")

    result = sb.table("transactions").update(updates).eq("id", tx_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="수정에 실패했습니다.")
    return _fmt(result.data[0])


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    tx_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """지출 내역 삭제 (본인 내역만 가능)."""
    sb = get_supabase()
    existing = (
        sb.table("transactions")
        .select("id")
        .eq("id", tx_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="내역을 찾을 수 없습니다.")
    sb.table("transactions").delete().eq("id", tx_id).execute()
