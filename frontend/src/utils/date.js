// 날짜 관련 공용 유틸.

// 'YYYY-MM-DD' 문자열이 오늘(로컬 자정 기준)보다 미래면 true.
export function isFutureDate(dateStr) {
  if (!dateStr) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const selected = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return selected > today
}

// 오늘 날짜를 'YYYY-MM-DD'로 반환 (date input의 max 속성용 — 달력에서 미래 선택 차단).
export function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
