// 백엔드(FastAPI) 호출용 공통 클라이언트.
// fetch 래퍼 - JWT 토큰을 자동으로 헤더에 첨부한다.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    throw new Error(await extractError(res))
  }
  return res.status === 204 ? null : res.json()
}

// FastAPI 에러 응답에서 사람이 읽을 메시지를 뽑는다.
// - HTTPException: { detail: "문자열" }
// - 검증 실패(422): { detail: [{ loc, msg, ... }] }
async function extractError(res) {
  try {
    const body = await res.json()
    const d = body?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length) {
      const first = d[0]
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : ''
      return field ? `${field}: ${first.msg}` : first.msg
    }
  } catch {
    // JSON 아님 → 상태코드로 폴백
  }
  return `요청 실패 (${res.status})`
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
}
