"""분석 & 통계 라우터.

제안서 3.x: 월별 추이 / 요일별 / 전월 비교 집계.
집계는 순수 함수(`_summarize`)로 분리해 DB 없이 단위테스트가 가능하다.
라우트는 Supabase `transactions` 에서 본인 데이터만 읽어 집계 함수에 넘긴다.
"""
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user_id
from app.core.supabase_client import get_supabase

router = APIRouter()

# 요일 라벨 (date.weekday(): 0=월 ... 6=일)
_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]
# 월별 추이에 포함할 개월 수(대상 월 포함, 과거로).
_TREND_MONTHS = 6


def _prev_year_month(year: int, month: int) -> tuple[int, int]:
    """직전 달의 (연, 월)."""
    return (year - 1, 12) if month == 1 else (year, month - 1)


def _recent_months(year: int, month: int, n: int) -> list[tuple[int, int]]:
    """대상 월부터 과거 n개월의 (연, 월) 목록 (오래된 순)."""
    out: list[tuple[int, int]] = []
    y, m = year, month
    for _ in range(n):
        out.append((y, m))
        y, m = _prev_year_month(y, m)
    return list(reversed(out))


def _summarize(rows: list[dict], year: int, month: int) -> dict:
    """거래 레코드 목록을 받아 대상 월 기준 통계로 집계한다 (순수 함수).

    rows 각 항목은 최소 spent_at(YYYY-MM-DD), amount, category 를 가진다고 가정.
    """
    py, pm = _prev_year_month(year, month)

    total = 0
    count = 0
    by_category: dict[str, int] = defaultdict(int)
    by_weekday = [0] * 7
    month_totals: dict[tuple[int, int], int] = defaultdict(int)
    prev_total = 0

    for r in rows:
        raw = r.get("spent_at")
        if not raw:
            continue
        try:
            d = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue  # 날짜 파싱 불가한 레코드는 건너뜀
        amount = r.get("amount") or 0

        month_totals[(d.year, d.month)] += amount
        if d.year == year and d.month == month:
            total += amount
            count += 1
            by_category[r.get("category") or "미분류"] += amount
            by_weekday[d.weekday()] += amount
        elif d.year == py and d.month == pm:
            prev_total += amount

    diff = total - prev_total
    pct = round(diff / prev_total * 100, 1) if prev_total > 0 else None

    return {
        "month": f"{year:04d}-{month:02d}",
        "total": total,
        "count": count,
        # 카테고리별 (금액 내림차순)
        "by_category": sorted(
            ({"category": k, "amount": v} for k, v in by_category.items()),
            key=lambda x: x["amount"],
            reverse=True,
        ),
        # 요일별 (월~일 고정 순서, 0원 포함)
        "by_weekday": [
            {"weekday": _WEEKDAYS[i], "amount": by_weekday[i]} for i in range(7)
        ],
        # 전월 비교
        "vs_prev_month": {"prev_total": prev_total, "diff": diff, "pct": pct},
        # 월별 추이 (최근 _TREND_MONTHS 개월)
        "monthly_trend": [
            {"month": f"{y:04d}-{m:02d}", "total": month_totals.get((y, m), 0)}
            for (y, m) in _recent_months(year, month, _TREND_MONTHS)
        ],
    }


def _parse_month(month: str | None) -> tuple[int, int]:
    """'YYYY-MM' 문자열을 (연, 월)로. 없으면 이번 달. 형식 오류 시 400."""
    if not month:
        today = date.today()
        return today.year, today.month
    try:
        year, mon = (int(x) for x in month.split("-")[:2])
        date(year, mon, 1)  # 유효성 검증 (예: 13월 거르기)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="month 형식은 'YYYY-MM' 이어야 합니다.")
    return year, mon


@router.get("/summary")
def monthly_summary(
    month: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    """월별 지출 통계. month=YYYY-MM(미지정 시 이번 달).

    반환: 총액/건수, 카테고리별, 요일별, 전월 비교, 월별 추이.
    """
    year, mon = _parse_month(month)
    sb = get_supabase()
    rows = (
        sb.table("transactions")
        .select("spent_at,amount,category")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )
    return _summarize(rows, year, mon)
