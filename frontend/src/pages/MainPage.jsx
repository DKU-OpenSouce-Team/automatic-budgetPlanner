import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTransactions } from '../contexts/TransactionContext'
import { useAuth } from '../contexts/AuthContext'

// 비로그인 미리보기용 예시 데이터 (로그인 시에는 실제 내역으로 대체된다)
const DEMO_TRANSACTIONS = [
  { id: 'd1',  store: '스타벅스',   amount: -5500,   date: '2026-06-01', category: '카페/간식' },
  { id: 'd2',  store: '지하철',     amount: -1400,   date: '2026-06-02', category: '교통' },
  { id: 'd3',  store: '월급',       amount: 3200000, date: '2026-06-03', category: '수입' },
  { id: 'd4',  store: '올리브영',   amount: -32000,  date: '2026-06-04', category: '마트/쇼핑' },
  { id: 'd5',  store: '맥도날드',   amount: -8900,   date: '2026-06-05', category: '식비' },
  { id: 'd6',  store: '넷플릭스',   amount: -17000,  date: '2026-06-06', category: '기타' },
  { id: 'd7',  store: 'CU편의점',   amount: -4200,   date: '2026-06-07', category: '편의점' },
  { id: 'd8',  store: '이마트',     amount: -55000,  date: '2026-06-09', category: '마트/쇼핑' },
  { id: 'd9',  store: '헬스장',     amount: -60000,  date: '2026-06-10', category: '의료/건강' },
  { id: 'd10', store: '배달의민족', amount: -22000,  date: '2026-06-12', category: '식비' },
  { id: 'd11', store: '무신사',     amount: -79000,  date: '2026-06-14', category: '의류' },
  { id: 'd12', store: '부수입',     amount: 450000,  date: '2026-06-15', category: '수입' },
]

const CATEGORY_COLORS = {
  식비: '#f97316', '카페/간식': '#f59e0b', 편의점: '#10b981',
  '마트/쇼핑': '#ec4899', '의료/건강': '#ef4444', 교통: '#3b82f6',
  '문화/여가': '#8b5cf6', 의류: '#06b6d4', 수입: '#22c55e', 기타: '#94a3b8',
}
const CATEGORY_ICONS = {
  식비: '🍽️', '카페/간식': '☕', 편의점: '🏪',
  '마트/쇼핑': '🛍️', '의료/건강': '💊', 교통: '🚌',
  '문화/여가': '🎭', 의류: '👕', 수입: '💰', 기타: '📌',
}
const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function MainPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { transactions: realTransactions } = useTransactions()   // ← 전역 데이터
  // 비로그인 상태에서는 예시 데이터로 미리보기를 보여준다.
  const transactions = isAuthenticated ? realTransactions : DEMO_TRANSACTIONS

  // 로그인 사용자는 실제 현재 달, 비로그인 미리보기는 예시 데이터(2026-06)에 맞춤
  const [currentMonth, setCurrentMonth] = useState(
    isAuthenticated ? new Date() : new Date(2026, 5, 1)
  )
  const [selectedDate, setSelectedDate] = useState(null)

  // ── 캘린더 계산 ──
  const year  = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const txByDate = {}
  transactions.forEach(t => {
    if (!txByDate[t.date]) txByDate[t.date] = []
    txByDate[t.date].push(t)
  })

  function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const selectedTx = selectedDate ? (txByDate[selectedDate] || []) : []

  // ── 이번 달 계산 ──
  const thisMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const thisMonthTx  = transactions.filter(t => t.date.startsWith(thisMonthStr))
  const expense      = Math.abs(thisMonthTx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  const income       = thisMonthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const thisMonthCount = thisMonthTx.filter(t => t.amount < 0).length

  // ── 파이차트 ──
  const byCat = {}
  thisMonthTx.filter(t => t.amount < 0).forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount)
  })
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const catTotal   = catEntries.reduce((s, [, v]) => s + v, 0)

  // ── 최근 지출 6건 ──
  const recentTx = [...transactions]
    .filter(t => t.amount < 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  return (
    <div style={S.page}>
      {!isAuthenticated && (
        <div style={S.demoBanner}>
          <span>👋 지금 보이는 내역은 <strong>예시 데이터</strong>입니다.
            로그인하면 내 가계부가 표시됩니다.</span>
          <Link to="/login" style={S.demoBtn}>로그인 / 회원가입</Link>
        </div>
      )}
      <div style={S.mainGrid}>

        {/* ── 왼쪽: 지출 캘린더 ── */}
        <div style={S.card}>
          <div style={S.calHeader}>
            <button style={S.navBtn} onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>‹</button>
            <h2 style={S.calTitle}>지출 캘린더 &nbsp;·&nbsp; {year}년 {month + 1}월</h2>
            <button style={S.navBtn} onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>›</button>
          </div>

          <div style={S.calGrid}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{
                ...S.calDayLabel,
                color: d === '일' ? '#ef4444' : d === '토' ? '#3b82f6' : '#9ca3af',
              }}>
                {d}
              </div>
            ))}

            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}

            {Array(daysInMonth).fill(null).map((_, i) => {
              const d       = i + 1
              const dk      = dateKey(year, month, d)
              const dayTx   = txByDate[dk] || []
              const dayExp  = dayTx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
              const isToday    = dk === dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
              const isSelected = dk === selectedDate
              const dow        = (firstDay + i) % 7
              return (
                <div
                  key={d}
                  style={{
                    ...S.calCell,
                    background: isSelected ? '#1f2937' : isToday ? '#ede9fe' : 'transparent',
                  }}
                  onClick={() => setSelectedDate(isSelected ? null : dk)}
                >
                  <span style={{
                    fontSize: 14, fontWeight: isToday || isSelected ? 700 : 400,
                    color: isSelected ? '#fff' : isToday ? '#6d28d9'
                          : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : '#374151',
                  }}>
                    {d}
                  </span>
                  {dayExp < 0 && (
                    <span style={{ fontSize: 10, color: isSelected ? '#fca5a5' : '#ef4444', fontWeight: 500 }}>
                      -{Math.abs(Math.round(dayExp / 1000))}k
                    </span>
                  )}
                  {dayTx.some(t => t.amount > 0) && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#86efac' : '#22c55e', margin: '0 auto', display: 'block' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* 선택 날짜 내역 */}
          <div style={S.dayDetail}>
            {selectedDate ? (
              <>
                <p style={S.dayDetailTitle}>{selectedDate}</p>
                {selectedTx.length === 0
                  ? <p style={S.emptyText}>지출 내역 없음</p>
                  : selectedTx.map(t => (
                    <div key={t.id} style={S.dayDetailRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[t.category] || '📌'}</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{t.store}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.amount < 0 ? '#ef4444' : '#16a34a' }}>
                        {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}원
                      </span>
                    </div>
                  ))
                }
              </>
            ) : (
              <p style={S.emptyText}>날짜를 클릭하면 내역이 표시됩니다.</p>
            )}
          </div>
        </div>

        {/* ── 오른쪽 ── */}
        <div style={S.rightCol}>

          {/* 영수증 업로드 */}
          <div style={S.uploadCard} onClick={() => navigate('/upload')} role="button">
            <div style={S.uploadIconWrap}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h3 style={S.uploadTitle}>영수증 업로드</h3>
            <p style={S.uploadDesc}>영수증을 촬영하면 자동으로 내용이 입력됩니다</p>
            <div style={S.uploadCta}>영수증 등록하기 &nbsp;→</div>
            <div style={S.uploadMeta}>
              <span>이번 달 등록</span>
              <span style={{ fontWeight: 700 }}>{thisMonthCount}건</span>
              <span style={{ marginLeft: 16 }}>총 지출</span>
              <span style={{ fontWeight: 700, color: '#ef4444' }}>-{expense.toLocaleString()}원</span>
            </div>
          </div>

          {/* 이번 달 지출 현황 */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>이번 달 지출 현황</h3>
            <PieChart entries={catEntries} total={catTotal} />
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>총 지출</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{expense.toLocaleString()}원</span>
              </div>
              {catEntries.length === 0
                ? <p style={S.emptyText}>이번 달 지출 내역이 없습니다.</p>
                : catEntries.map(([cat, val]) => (
                  <div key={cat} style={S.legendItem}>
                    <span style={{ ...S.legendDot, background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                    <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{cat}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{val.toLocaleString()}원</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── 최근 지출 내역 ── */}
      <div style={{ ...S.card, marginTop: 0 }}>
        <h3 style={S.cardTitle}>최근 지출 내역</h3>
        {recentTx.length === 0
          ? <p style={S.emptyText}>지출 내역이 없습니다.</p>
          : recentTx.map(tx => (
            <div key={tx.id} style={S.recentItem}>
              <div style={{ ...S.recentIcon, background: (CATEGORY_COLORS[tx.category] || '#94a3b8') + '18' }}>
                <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[tx.category] || '📌'}</span>
              </div>
              <div style={S.recentInfo}>
                <span style={S.recentStore}>{tx.store}</span>
                <span style={S.recentMeta}>{tx.date} · {tx.category}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>
                -{Math.abs(tx.amount).toLocaleString()}원
              </span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

function PieChart({ entries, total }) {
  const R = 70, cx = 90, cy = 80
  let cumAngle = -Math.PI / 2
  if (!total) return <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>지출 데이터가 없습니다</div>
  return (
    <svg viewBox="0 0 180 160" width="100%" style={{ display: 'block', maxWidth: 200, margin: '0 auto' }}>
      {entries.map(([cat, val]) => {
        const angle = (val / total) * Math.PI * 2
        const x1 = cx + R * Math.cos(cumAngle), y1 = cy + R * Math.sin(cumAngle)
        cumAngle += angle
        const x2 = cx + R * Math.cos(cumAngle), y2 = cy + R * Math.sin(cumAngle)
        return (
          <path key={cat}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`}
            fill={CATEGORY_COLORS[cat] || '#94a3b8'} stroke="#fff" strokeWidth="2" opacity="0.92" />
        )
      })}
    </svg>
  )
}

const S = {
  page: { maxWidth: 1080, margin: '0 auto', padding: '24px 16px', fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", display: 'flex', flexDirection: 'column', gap: 16 },
  demoBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 18px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 12, fontSize: 13, color: '#5b21b6' },
  demoBtn: { background: '#6d28d9', color: '#fff', textDecoration: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#111827' },
  calHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  calTitle:  { fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' },
  navBtn: { background: '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 },
  calDayLabel: { fontSize: 12, fontWeight: 600, textAlign: 'center', paddingBottom: 10 },
  calCell: { minHeight: 58, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '7px 2px 4px', cursor: 'pointer', transition: 'background 0.15s', gap: 2 },
  dayDetail: { marginTop: 18, paddingTop: 16, borderTop: '1px solid #f3f4f6', minHeight: 60 },
  dayDetailTitle: { fontSize: 13, fontWeight: 700, color: '#6d28d9', marginBottom: 10 },
  dayDetailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f9fafb' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' },
  uploadCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24, cursor: 'pointer', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', userSelect: 'none' },
  uploadIconWrap: { width: 56, height: 56, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  uploadTitle: { fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#111827' },
  uploadDesc:  { fontSize: 13, color: '#9ca3af', margin: '0 0 14px' },
  uploadCta: { display: 'inline-block', background: '#111827', color: '#fff', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, marginBottom: 16 },
  uploadMeta: { display: 'flex', justifyContent: 'center', gap: 8, fontSize: 13, color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: 14 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 },
  legendDot:  { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  recentItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f9fafb' },
  recentIcon: { width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recentInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  recentStore: { fontSize: 14, fontWeight: 600, color: '#111827' },
  recentMeta:  { fontSize: 12, color: '#9ca3af' },
}
