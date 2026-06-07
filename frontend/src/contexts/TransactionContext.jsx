import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'

// 지출 내역을 백엔드(FastAPI + Supabase)와 동기화하는 컨텍스트.
// 로그인(token)되어 있을 때만 GET /transactions 로 불러오고, CRUD는 모두 API를 거친다.

const TransactionContext = createContext(null)

// ── 부호 정규화 ─────────────────────────────────────────
// 백엔드 amount는 부호 없이 저장되므로(영수증·수동입력 경로마다 제각각),
// 프론트 표시 규칙(수입=+, 지출=−)으로 통일한다. '수입' 카테고리만 +.
function normalize(row) {
  const raw = Number(row.amount) || 0
  const isIncome = row.category === '수입'
  return {
    id: row.id,
    store: row.store,
    amount: isIncome ? Math.abs(raw) : -Math.abs(raw),
    date: row.date,                 // 백엔드가 spent_at → date 로 변환해 내려줌
    category: row.category || '기타',
    note: row.note ?? '',
  }
}

const byDateDesc = (a, b) => b.date.localeCompare(a.date)

export function TransactionProvider({ children }) {
  const { token } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 목록 새로고침 (로그인 안 됐으면 비움)
  const refresh = useCallback(async () => {
    if (!token) { setTransactions([]); return }
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/transactions')
      setTransactions((data || []).map(normalize).sort(byDateDesc))
    } catch (e) {
      setError(e.message || '내역을 불러오지 못했습니다.')
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [token])

  // 로그인 상태가 바뀌면(로그인/로그아웃/새로고침) 다시 불러온다.
  useEffect(() => { refresh() }, [refresh])

  // ── CRUD (모두 API 경유 후 동기화) ──────────────────────

  // 추가 — tx: { store, amount, date, category, memo }
  // amount는 부호 없는 '크기'로 저장한다(표시 부호는 normalize가 category로 부여).
  const addTransaction = useCallback(async (tx) => {
    await api.post('/transactions', {
      store: tx.store,
      amount: Math.abs(Number(tx.amount)),
      date: tx.date,
      category: tx.category || null,
      memo: tx.memo ?? tx.note ?? null,
    })
    await refresh()
  }, [refresh])

  // 수정 — changes: { store?, amount?, date?, category?, memo? }
  // 편집 폼이 정규화된 부호값(예: -5000)을 넘겨도 크기로 통일해 음수 저장을 막는다.
  const updateTransaction = useCallback(async (id, changes) => {
    await api.put(`/transactions/${id}`, {
      store: changes.store,
      amount: changes.amount != null ? Math.abs(Number(changes.amount)) : undefined,
      date: changes.date,
      category: changes.category,
      memo: changes.memo ?? changes.note,
    })
    await refresh()
  }, [refresh])

  // 삭제
  const deleteTransaction = useCallback(async (id) => {
    await api.del(`/transactions/${id}`)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }, [])

  // 여러 건 삭제
  const deleteTransactions = useCallback(async (ids) => {
    await Promise.all(ids.map(id => api.del(`/transactions/${id}`)))
    const set = new Set(ids)
    setTransactions(prev => prev.filter(t => !set.has(t.id)))
  }, [])

  return (
    <TransactionContext.Provider value={{
      transactions,
      loading,
      error,
      refresh,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      deleteTransactions,
    }}>
      {children}
    </TransactionContext.Provider>
  )
}

// 커스텀 훅
export function useTransactions() {
  const ctx = useContext(TransactionContext)
  if (!ctx) throw new Error('useTransactions must be used within TransactionProvider')
  return ctx
}
