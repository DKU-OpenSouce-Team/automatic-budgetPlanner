import { useState } from 'react'
import { useTransactions } from '../contexts/TransactionContext'

const CATEGORY_OPTIONS = ['식비', '카페/간식', '편의점', '마트/쇼핑', '의료/건강', '교통', '문화/여가', '의류', '수입', '기타']

export default function TransactionsPage() {
  const { transactions, updateTransaction, deleteTransaction } = useTransactions()

  const now = new Date()
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  const [q, setQ]               = useState('')
  const [category, setCategory] = useState('')
  const [editId, setEditId]     = useState(null)
  const [editStore, setEditStore]       = useState('')
  const [editAmount, setEditAmount]     = useState('')
  const [editDate, setEditDate]         = useState('')
  const [editCategory, setEditCategory] = useState('')

  function startEdit(tx) {
    setEditId(tx.id)
    setEditStore(tx.store)
    setEditAmount(String(tx.amount))
    setEditDate(tx.date)
    setEditCategory(tx.category)
  }

  function handleSaveEdit(id) {
    updateTransaction(id, {
      store: editStore,
      amount: Number(editAmount),
      date: editDate,
      category: editCategory,
    })
    setEditId(null)
  }

  function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    deleteTransaction(id)
  }

  // ── 선택 월 기준 통계 ──
  const selMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}`
  const selMonthTx  = transactions.filter(t => t.date.startsWith(selMonthStr))
  const selCount    = selMonthTx.filter(t => t.amount < 0).length
  const selExpense  = selMonthTx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  const selIncome   = selMonthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  // ── 프론트 필터 ──
  const filtered = transactions.filter(t => {
    const matchQ   = q        ? (t.store ?? '').includes(q) : true
    const matchCat = category ? t.category === category : true
    return matchQ && matchCat
  })

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i)

  return (
    <section style={styles.container}>
      {/* 제목 + 년도/월 선택 */}
      <div style={styles.titleRow}>
        <h1 style={styles.title}>지출 내역</h1>
        <div style={styles.monthSelector}>
          <select
            style={styles.yearSelect}
            value={selYear}
            onChange={e => setSelYear(Number(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            style={styles.monthSelect}
            value={selMonth}
            onChange={e => setSelMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}월</option>
            ))}
          </select>
        </div>
      </div>

      {/* 선택 월 요약 카드 */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>{selYear}년 {selMonth}월 건수</p>
          <p style={styles.summaryValue}>{selCount}건</p>
        </div>
        <div style={{ ...styles.summaryCard, borderColor: '#fca5a5' }}>
          <p style={styles.summaryLabel}>{selYear}년 {selMonth}월 지출</p>
          <p style={{ ...styles.summaryValue, color: '#ef4444' }}>
            {selExpense.toLocaleString()}원
          </p>
        </div>
        <div style={{ ...styles.summaryCard, borderColor: '#86efac' }}>
          <p style={styles.summaryLabel}>{selYear}년 {selMonth}월 수입</p>
          <p style={{ ...styles.summaryValue, color: '#16a34a' }}>
            +{selIncome.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 검색/필터 */}
      <div style={styles.searchRow}>
        <input
          style={styles.searchInput}
          placeholder="가게명 검색"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select style={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">전체 카테고리</option>
          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 내역 목록 */}
      {filtered.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>내역이 없습니다.</p>
      ) : (
        <div style={styles.list}>
          {filtered.map(tx => (
            <div key={tx.id} style={styles.item}>
              {editId === tx.id ? (
                <div style={styles.editRow}>
                  <input style={styles.editInput} value={editStore}    onChange={e => setEditStore(e.target.value)}    placeholder="가게명" />
                  <input style={styles.editInput} type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="금액" />
                  <input style={styles.editInput} type="date"   value={editDate}   onChange={e => setEditDate(e.target.value)} />
                  <select style={styles.editInput} value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button style={styles.saveBtn}   onClick={() => handleSaveEdit(tx.id)}>저장</button>
                  <button style={styles.cancelBtn} onClick={() => setEditId(null)}>취소</button>
                </div>
              ) : (
                <>
                  <div style={styles.itemLeft}>
                    <span style={styles.itemStore}>{tx.store}</span>
                    <span style={styles.itemMeta}>{tx.date} · {tx.category}</span>
                  </div>
                  <div style={styles.itemRight}>
                    <span style={{ ...styles.itemAmount, color: tx.amount < 0 ? '#ef4444' : '#16a34a' }}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}원
                    </span>
                    <div style={styles.btnGroup}>
                      <button style={styles.editBtn}   onClick={() => startEdit(tx)}>수정</button>
                      <button style={styles.deleteBtn} onClick={() => handleDelete(tx.id)}>삭제</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const styles = {
  container:    { maxWidth: '700px', margin: '0 auto', padding: '32px 16px', fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" },
  titleRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  title:        { fontSize: '24px', fontWeight: '700', margin: 0 },
  monthSelector:{ display: 'flex', alignItems: 'center', gap: '8px' },
  yearSelect:   { padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer', background: '#fff' },
  monthSelect:  { padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer', background: '#fff' },
  searchRow:    { display: 'flex', gap: '8px', marginBottom: '20px' },
  searchInput:  { flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' },
  select:       { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' },
  summaryRow:   { display: 'flex', gap: '12px', marginBottom: '24px' },
  summaryCard:  { flex: 1, border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', textAlign: 'center' },
  summaryLabel: { fontSize: '12px', color: '#9ca3af', margin: '0 0 6px' },
  summaryValue: { fontSize: '18px', fontWeight: '700', margin: 0 },
  list:         { display: 'flex', flexDirection: 'column', gap: '8px' },
  item:         { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  itemLeft:     { display: 'flex', flexDirection: 'column', gap: '4px' },
  itemStore:    { fontSize: '15px', fontWeight: '600' },
  itemMeta:     { fontSize: '12px', color: '#9ca3af' },
  itemRight:    { display: 'flex', alignItems: 'center', gap: '12px' },
  itemAmount:   { fontSize: '16px', fontWeight: '700' },
  btnGroup:     { display: 'flex', gap: '6px' },
  editBtn:      { padding: '4px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  deleteBtn:    { padding: '4px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#ef4444' },
  editRow:      { display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' },
  editInput:    { padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', flex: 1, minWidth: '80px' },
  saveBtn:      { padding: '6px 12px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  cancelBtn:    { padding: '6px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
}