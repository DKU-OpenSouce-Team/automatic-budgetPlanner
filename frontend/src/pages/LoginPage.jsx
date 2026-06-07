import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit() {
    setError('')

    // 입력값 검증
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }
    if (mode === 'signup' && password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    // 이메일 형식 사전 검증 (백엔드 EmailStr이 도메인에 점 없는 주소 등을 거부)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('올바른 이메일 형식이 아닙니다. (예: name@gmail.com)')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        // 로그인 요청
        const data = await api.post('/auth/login', { email, password })
        login(data)   // 토큰·유저 저장 (localStorage + 전역 상태)
        navigate('/')
      } else {
        // 회원가입 요청
        await api.post('/auth/signup', { email, password })
        setMode('login')
        setError('회원가입 완료! 로그인해주세요.')
      }
    } catch (e) {
      // 서버가 보낸 실제 사유를 우선 표시, 없으면 기본 문구
      const fallback = mode === 'login' ? '이메일 또는 비밀번호가 잘못되었습니다.' : '회원가입에 실패했습니다.'
      setError(e?.message || fallback)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          {mode === 'login' ? '로그인' : '회원가입'}
        </h1>

        <div style={styles.tabRow}>
          <button
            style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
            onClick={() => { setMode('login'); setError('') }}
          >
            로그인
          </button>
          <button
            style={{ ...styles.tab, ...(mode === 'signup' ? styles.tabActive : {}) }}
            onClick={() => { setMode('signup'); setError('') }}
          >
            회원가입
          </button>
        </div>

        <div style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' && (
            <input
              style={styles.input}
              type="password"
              placeholder="비밀번호 확인"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </div>
      </div>
    </section>
  )
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80vh',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '24px',
    textAlign: 'center',
  },
  tabRow: {
    display: 'flex',
    marginBottom: '24px',
    borderBottom: '2px solid #e5e7eb',
  },
  tab: {
    flex: 1,
    padding: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    color: '#9ca3af',
    fontWeight: '500',
  },
  tabActive: {
    color: '#6d28d9',
    borderBottom: '2px solid #6d28d9',
    marginBottom: '-2px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
  },
  button: {
    padding: '13px',
    background: '#6d28d9',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
  },
  error: {
    color: '#ef4444',
    fontSize: '13px',
    margin: 0,
  },
}
