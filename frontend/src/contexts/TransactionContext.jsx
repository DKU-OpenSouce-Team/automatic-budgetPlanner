import { createContext, useContext, useState, useCallback } from 'react'

// ── 초기 더미 데이터 (한 곳에서만 관리) ─────────────────
const INITIAL_TRANSACTIONS = [
  { id: '1',  store: '스타벅스',   amount: -5500,   date: '2026-06-01', category: '식비' },
  { id: '2',  store: '지하철',     amount: -1400,   date: '2026-06-02', category: '교통' },
  { id: '3',  store: '월급',       amount: 3200000, date: '2026-06-03', category: '수입' },
  { id: '4',  store: '올리브영',   amount: -32000,  date: '2026-06-04', category: '쇼핑' },
  { id: '5',  store: '맥도날드',   amount: -8900,   date: '2026-06-05', category: '식비' },
  { id: '6',  store: '넷플릭스',   amount: -17000,  date: '2026-06-06', category: '구독' },
  { id: '7',  store: 'CU편의점',   amount: -4200,   date: '2026-06-07', category: '식비' },
  { id: '8',  store: '버스',       amount: -1400,   date: '2026-06-08', category: '교통' },
  { id: '9',  store: '이마트',     amount: -55000,  date: '2026-06-09', category: '식비' },
  { id: '10', store: '헬스장',     amount: -60000,  date: '2026-06-10', category: '건강' },
  { id: '11', store: '카카오페이', amount: -12000,  date: '2026-06-11', category: '기타' },
  { id: '12', store: '배달의민족', amount: -22000,  date: '2026-06-12', category: '식비' },
  { id: '13', store: '지하철',     amount: -1400,   date: '2026-06-13', category: '교통' },
  { id: '14', store: '무신사',     amount: -79000,  date: '2026-06-14', category: '쇼핑' },
  { id: '15', store: '부수입',     amount: 450000,  date: '2026-06-15', category: '수입' },
]

const TransactionContext = createContext(null)

export function TransactionProvider({ children }) {
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)

  // ── CRUD ───────────────────────────────────────────────

  // 추가
  const addTransaction = useCallback((tx) => {
    const newTx = { ...tx, id: Date.now().toString() }
    setTransactions(prev => [newTx, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
  }, [])

  // 수정
  const updateTransaction = useCallback((id, changes) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, ...changes } : t)
    )
  }, [])

  // 삭제
  const deleteTransaction = useCallback((id) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }, [])

  // 여러 건 삭제 (MyFilesPage용)
  const deleteTransactions = useCallback((ids) => {
    const set = new Set(ids)
    setTransactions(prev => prev.filter(t => !set.has(t.id)))
  }, [])

  return (
    <TransactionContext.Provider value={{
      transactions,
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
