// 백엔드(FastAPI) 호출용 공통 클라이언트.
// fetch 래퍼 - JWT 토큰을 자동으로 헤더에 첨부한다.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const SESSION_EXPIRED_MSG = '세션이 만료되었습니다. 다시 로그인해주세요.'

// 인증된 요청(토큰 첨부)에 401이 오면 = 토큰 만료/무효.
// 토큰을 정리하고 로그인 화면으로 보낸다(이미 로그인 화면이면 그대로 둠).
function expireSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  if (window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (res.status === 401 && token) {
    expireSession()
    throw new Error(SESSION_EXPIRED_MSG)
  }
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

// 파일 업로드용 — FormData(멀티파트) 전송. Content-Type은 지정하지 않아
// 브라우저가 boundary를 자동으로 붙이게 한다. (예: /receipts, /files/csv)
async function uploadForm(path, formData) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (res.status === 401 && token) { expireSession(); throw new Error(SESSION_EXPIRED_MSG) }
  if (!res.ok) throw new Error(await extractError(res))
  return res.status === 204 ? null : res.json()
}

// 파일 다운로드용 — JSON이 아닌 바이너리(Blob)를 받는다. (예: /files/{id}/export)
async function downloadBlob(path) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (res.status === 401 && token) { expireSession(); throw new Error(SESSION_EXPIRED_MSG) }
  if (!res.ok) throw new Error(await extractError(res))
  return res.blob()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => uploadForm(path, formData),
  download: (path) => downloadBlob(path),
}
