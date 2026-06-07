import { useState } from 'react'
import { useTransactions } from '../contexts/TransactionContext'

// 전역 거래 내역에서 최근 N개월의 월별 수입/지출을 집계한다 (오래된 → 최신 순).
function buildMonthly(transactions, monthsBack = 6) {
  const now = new Date()
  const buckets = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ ym, month: `${d.getMonth() + 1}월`, income: 0, expense: 0 })
  }
  const idx = Object.fromEntries(buckets.map((b, i) => [b.ym, i]))
  transactions.forEach(t => {
    const ym = (t.date || '').slice(0, 7)
    if (ym in idx) {
      const b = buckets[idx[ym]]
      if (t.amount > 0) b.income += t.amount
      else b.expense += Math.abs(t.amount)
    }
  })
  return buckets
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const CATEGORY_COLORS = {
  식비: '#f97316', '카페/간식': '#f59e0b', 편의점: '#10b981',
  '마트/쇼핑': '#ec4899', '의료/건강': '#ef4444', 교통: '#3b82f6',
  '문화/여가': '#8b5cf6', 의류: '#06b6d4', 수입: '#22c55e', 기타: '#94a3b8',
}

const DEFAULT_BUDGETS = { 식비: 200000, '카페/간식': 50000, '마트/쇼핑': 100000, 교통: 50000, '의료/건강': 50000, '문화/여가': 30000 }

// ── 헬퍼 ────────────────────────────────────────────────
function fmt(n) {
  return Math.abs(n).toLocaleString() + '원'
}
function fmtSigned(n) {
  return (n >= 0 ? '+' : '-') + Math.abs(n).toLocaleString() + '원'
}

export default function AnalyticsPage() {
  const { transactions } = useTransactions()          // ← 전역 데이터
  const [activeTab, setActiveTab] = useState('monthly')
  const [animIn, setAnimIn] = useState(true)
  const [budgets, setBudgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('budgets') || 'null') || DEFAULT_BUDGETS }
    catch { return DEFAULT_BUDGETS }
  })

  // 이번 달 계산
  const thisMonth = new Date().toISOString().substring(0, 7)
  const thisMonthTx = transactions.filter(t => t.date.startsWith(thisMonth))
  const income = thisMonthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const expense = Math.abs(thisMonthTx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  const netSavings = income - expense
  const days = new Date().getDate()
  const dailyAvg = expense / days

  // 카테고리별 지출
  const byCat = {}
  thisMonthTx.filter(t => t.amount < 0).forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount)
  })
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const catTotal = catEntries.reduce((s, [, v]) => s + v, 0)

  // 요일별
  const byDay = Array(7).fill(0)
  thisMonthTx.filter(t => t.amount < 0).forEach(t => {
    const d = new Date(t.date).getDay()
    byDay[d] += Math.abs(t.amount)
  })
  const maxDay = Math.max(...byDay)

  // 월별 추이(최근 6개월) + 전월 비교 — 전역 거래 내역에서 직접 집계
  const monthlyData = buildMonthly(transactions, 6)
  const prevBucket = monthlyData[monthlyData.length - 2]
  const prevExpense = prevBucket ? prevBucket.expense : 0
  const prevLabel = prevBucket ? prevBucket.month : '전월'
  const thisLabel = monthlyData[monthlyData.length - 1]?.month || '이번달'
  const expenseDiff = expense - prevExpense
  const expenseDiffPct = prevExpense ? ((expenseDiff / prevExpense) * 100).toFixed(1) : 0


  return (
    <section style={S.page}>
      <h1 style={S.pageTitle}>분석 &amp; 통계</h1>

      {/* ── KPI 카드 4개 ── */}
      <div style={S.kpiRow}>
        {[
          { label: '이번달 수입', value: fmtSigned(income), color: '#16a34a', icon: '💰' },
          { label: '이번달 지출', value: '-' + fmt(expense), color: '#ef4444', icon: '💸' },
          { label: '순 저축', value: fmtSigned(netSavings), color: netSavings >= 0 ? '#6d28d9' : '#ef4444', icon: '🏦' },
          { label: '일평균 지출', value: Math.round(dailyAvg).toLocaleString() + '원', color: '#f97316', icon: '📅' },
        ].map((k, i) => (
          <div
            key={i}
            style={{
              ...S.kpiCard,
              opacity: animIn ? 1 : 0,
              transform: animIn ? 'translateY(0)' : 'translateY(16px)',
              transition: `opacity 0.4s ${i * 0.08}s, transform 0.4s ${i * 0.08}s`,
            }}
          >
            <span style={S.kpiIcon}>{k.icon}</span>
            <p style={S.kpiLabel}>{k.label}</p>
            <p style={{ ...S.kpiValue, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── 탭 ── */}
      <div style={S.tabRow}>
        {[
          { key: 'monthly', label: '월별 추이' },
          { key: 'weekday', label: '요일별 분석' },
          { key: 'compare', label: '전월 비교' },
          { key: 'budget', label: '예산 관리' },
        ].map(t => (
          <button
            key={t.key}
            style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div style={S.card}>
        {activeTab === 'monthly' && <MonthlyChart data={monthlyData} />}
        {activeTab === 'weekday' && <WeekdayChart byDay={byDay} maxDay={maxDay} />}
        {activeTab === 'compare' && (
          <CompareView
            thisExpense={expense}
            prevExpense={prevExpense}
            prevLabel={prevLabel}
            thisLabel={thisLabel}
            diff={expenseDiff}
            diffPct={expenseDiffPct}
            catEntries={catEntries}
            catTotal={catTotal}
          />
        )}
        {activeTab === 'budget' && <BudgetView byCat={byCat} budgets={budgets} setBudgets={setBudgets} />}
      </div>

      {/* ── 카테고리 도넛 + 리스트 ── */}
      <div style={S.bottomGrid}>
        <div style={S.card}>
          <h3 style={S.sectionTitle}>카테고리별 지출</h3>
          <DonutChart entries={catEntries} total={catTotal} />
        </div>
        <div style={S.card}>
          <h3 style={S.sectionTitle}>카테고리 상세</h3>
          <div style={S.catList}>
            {catEntries.map(([cat, val]) => (
              <div key={cat} style={S.catRow}>
                <div style={S.catLeft}>
                  <span style={{ ...S.catDot, background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                  <span style={S.catName}>{cat}</span>
                </div>
                <div style={S.catRight}>
                  <div style={S.catBarWrap}>
                    <div
                      style={{
                        ...S.catBar,
                        width: `${catTotal ? (val / catTotal) * 100 : 0}%`,
                        background: CATEGORY_COLORS[cat] || '#94a3b8',
                      }}
                    />
                  </div>
                  <span style={S.catAmt}>{fmt(val)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 월별 추이 차트 (SVG 막대) ────────────────────────────
function MonthlyChart({ data }) {
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
  const H = 180
  const W = 480
  const padL = 48
  const padB = 28
  const innerW = W - padL - 16
  const innerH = H - padB - 8
  const colW = innerW / data.length
  const barW = colW * 0.3

  return (
    <div>
      <h3 style={S.sectionTitle}>월별 수입 · 지출 추이</h3>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={S.legend}><span style={{ ...S.legendDot, background: '#22c55e' }} />수입</div>
        <div style={S.legend}><span style={{ ...S.legendDot, background: '#f87171' }} />지출</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 320 }}>
          {/* Y축 가이드라인 */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const y = 8 + innerH * (1 - r)
            return (
              <g key={r}>
                <line x1={padL} y1={y} x2={W - 16} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                  {Math.round((maxVal * r) / 10000)}만
                </text>
              </g>
            )
          })}
          {/* 막대 */}
          {data.map((d, i) => {
            const cx = padL + colW * i + colW / 2
            const incH = (d.income / maxVal) * innerH
            const expH = (d.expense / maxVal) * innerH
            return (
              <g key={i}>
                <rect x={cx - barW - 2} y={8 + innerH - incH} width={barW} height={incH} fill="#22c55e" rx="3" opacity="0.85" />
                <rect x={cx + 2} y={8 + innerH - expH} width={barW} height={expH} fill="#f87171" rx="3" opacity="0.85" />
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="#9ca3af">{d.month}</text>
              </g>
            )
          })}
          {/* 순저축 꺾은선 */}
          {data.map((d, i) => {
            const cx = padL + colW * i + colW / 2
            const net = d.income - d.expense
            const netH = (Math.max(0, net) / maxVal) * innerH
            return (
              <circle key={i} cx={cx} cy={8 + innerH - netH} r="4" fill="#6d28d9" stroke="#fff" strokeWidth="1.5" />
            )
          })}
          <polyline
            fill="none"
            stroke="#6d28d9"
            strokeWidth="2"
            strokeDasharray="4 2"
            points={data.map((d, i) => {
              const cx = padL + colW * i + colW / 2
              const net = d.income - d.expense
              const netH = (Math.max(0, net) / maxVal) * innerH
              return `${cx},${8 + innerH - netH}`
            }).join(' ')}
          />
        </svg>
      </div>
      <div style={S.legend}><span style={{ ...S.legendDot, background: '#6d28d9' }} />순저축 추이</div>
    </div>
  )
}

// ── 요일별 분석 ──────────────────────────────────────────
function WeekdayChart({ byDay, maxDay }) {
  return (
    <div>
      <h3 style={S.sectionTitle}>요일별 평균 지출</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, paddingBottom: 24, paddingTop: 8 }}>
        {byDay.map((val, i) => {
          const pct = maxDay ? val / maxDay : 0
          const isWeekend = i === 0 || i === 6
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{val ? Math.round(val / 1000) + 'k' : '-'}</span>
              <div
                style={{
                  width: '60%',
                  height: `${Math.max(pct * 120, val ? 6 : 0)}px`,
                  background: isWeekend ? '#ec4899' : '#6d28d9',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.6s ease',
                  opacity: 0.85,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: isWeekend ? 700 : 400, color: isWeekend ? '#ec4899' : '#374151' }}>
                {DAY_LABELS[i]}
              </span>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
        분홍색: 주말 / 보라색: 평일
      </p>
    </div>
  )
}

// ── 전월 비교 ────────────────────────────────────────────
function CompareView({ thisExpense, prevExpense, prevLabel = '전월', thisLabel = '이번달', diff, diffPct }) {
  const maxVal = Math.max(thisExpense, prevExpense, 1)
  return (
    <div>
      <h3 style={S.sectionTitle}>전월 지출 비교</h3>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: `${prevLabel} 지출`, val: prevExpense, color: '#94a3b8' },
          { label: `${thisLabel} 지출`, val: thisExpense, color: '#6d28d9' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</p>
            <div style={{ background: '#f9fafb', borderRadius: 8, height: 12, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${(val / maxVal) * 100}%`, background: color, borderRadius: 8, transition: 'width 0.8s ease' }} />
            </div>
            <p style={{ fontWeight: 700, color, fontSize: 16 }}>{val.toLocaleString()}원</p>
          </div>
        ))}
      </div>
      <div style={{
        padding: '14px 18px',
        borderRadius: 10,
        background: diff > 0 ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${diff > 0 ? '#fca5a5' : '#86efac'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
      }}>
        <span style={{ fontSize: 22 }}>{diff > 0 ? '📈' : '📉'}</span>
        <div>
          <p style={{ fontWeight: 700, color: diff > 0 ? '#ef4444' : '#16a34a', margin: 0 }}>
            전월 대비 {diff > 0 ? '+' : ''}{diff.toLocaleString()}원 ({diff > 0 ? '+' : ''}{diffPct}%)
          </p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            {diff > 0 ? '지출이 늘었어요. 지출 패턴을 확인해보세요.' : '잘 하고 있어요! 지출이 줄었습니다.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── 예산 관리 ────────────────────────────────────────────
const ALL_CATS = ['식비', '카페/간식', '편의점', '마트/쇼핑', '의료/건강', '교통', '문화/여가', '의류', '기타']

function BudgetView({ byCat, budgets, setBudgets }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [newCat, setNewCat] = useState('')
  const [newAmt, setNewAmt] = useState('')
  const [customCatName, setCustomCatName] = useState('')

  function startEdit() {
    setDraft(Object.fromEntries(Object.entries(budgets).map(([k, v]) => [k, String(v)])))
    setEditing(true)
  }

  function handleSave() {
    const next = Object.fromEntries(
      Object.entries(draft)
        .filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) > 0)
        .map(([k, v]) => [k, Number(v)])
    )
    setBudgets(next)
    try { localStorage.setItem('budgets', JSON.stringify(next)) } catch {}
    setEditing(false)
  }

  function handleDelete(cat) {
    const next = { ...budgets }
    delete next[cat]
    setBudgets(next)
    try { localStorage.setItem('budgets', JSON.stringify(next)) } catch {}
  }

  function handleAdd() {
    const catKey = newCat === '__custom__' ? customCatName.trim() : newCat
    if (!catKey || !newAmt || isNaN(Number(newAmt)) || Number(newAmt) <= 0) return
    const next = { ...budgets, [catKey]: Number(newAmt) }
    setBudgets(next)
    try { localStorage.setItem('budgets', JSON.stringify(next)) } catch {}
    setNewCat(''); setNewAmt(''); setCustomCatName('')
  }

  const unusedCats = ALL_CATS.filter(c => !budgets[c])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ ...S.sectionTitle, margin: 0 }}>카테고리별 예산 현황</h3>
        {editing
          ? <div style={{ display: 'flex', gap: 8 }}>
              <button style={BG.cancelBtn} onClick={() => setEditing(false)}>취소</button>
              <button style={BG.saveBtn} onClick={handleSave}>저장</button>
            </div>
          : <button style={BG.editBtn} onClick={startEdit}>✏️ 예산 수정</button>
        }
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(budgets).map(([cat, budget]) => {
          const spent = byCat[cat] || 0
          const pct   = Math.min((spent / budget) * 100, 100)
          const over  = spent > budget
          const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f97316' : '#6d28d9'
          return (
            <div key={cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...S.catDot, background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{cat}</span>
                </div>
                {editing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      style={BG.budgetInput}
                      type="number"
                      value={draft[cat] ?? String(budget)}
                      onChange={e => setDraft(prev => ({ ...prev, [cat]: e.target.value }))}
                    />
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>원</span>
                    <button style={BG.deleteBtn} onClick={() => handleDelete(cat)}>✕</button>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: over ? '#ef4444' : '#6b7280' }}>
                    {spent.toLocaleString()}원 / {budget.toLocaleString()}원
                  </span>
                )}
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: color, borderRadius: 6, transition: 'width 0.8s ease',
                }} />
              </div>
              {!editing && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{pct.toFixed(0)}% 사용</span>
                  {over
                    ? <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>⚠️ 예산 초과</span>
                    : <span style={{ fontSize: 11, color: '#9ca3af' }}>잔여 {(budget - spent).toLocaleString()}원</span>
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 카테고리 추가 */}
      <div style={BG.addRow}>
        <select
          style={BG.addSelect}
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
        >
          <option value="">카테고리 선택</option>
          {unusedCats.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__custom__">직접 입력</option>
        </select>
        {newCat === '__custom__' && (
          <input
            style={BG.addInput}
            placeholder="카테고리명"
            value={customCatName}
            onChange={e => setCustomCatName(e.target.value)}
          />
        )}
        <input
          style={BG.addInput}
          type="number"
          placeholder="예산 금액"
          value={newAmt}
          onChange={e => setNewAmt(e.target.value)}
        />
        <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>원</span>
        <button style={BG.addBtn} onClick={handleAdd}>+ 추가</button>
      </div>
    </div>
  )
}

const BG = {
  editBtn:    { padding: '6px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  saveBtn:    { padding: '6px 14px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  cancelBtn:  { padding: '6px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  deleteBtn:  { padding: '2px 7px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#ef4444' },
  budgetInput:{ width: 90, padding: '4px 8px', border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 13, textAlign: 'right', background: '#faf5ff' },
  addRow:     { display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap' },
  addSelect:  { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#fff' },
  addInput:   { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, width: 110 },
  addBtn:     { padding: '8px 14px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
}

// ── 도넛 차트 (SVG) ──────────────────────────────────────
function DonutChart({ entries, total }) {
  const R = 60
  const cx = 80
  const cy = 80
  let cumAngle = -Math.PI / 2

  return (
    <svg viewBox="0 0 200 160" width="100%" style={{ maxWidth: 240, display: 'block', margin: '0 auto' }}>
      {entries.map(([cat, val]) => {
        const angle = (val / total) * Math.PI * 2
        const x1 = cx + R * Math.cos(cumAngle)
        const y1 = cy + R * Math.sin(cumAngle)
        cumAngle += angle
        const x2 = cx + R * Math.cos(cumAngle)
        const y2 = cy + R * Math.sin(cumAngle)
        const large = angle > Math.PI ? 1 : 0
        const color = CATEGORY_COLORS[cat] || '#94a3b8'
        return (
          <path
            key={cat}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`}
            fill={color}
            opacity="0.88"
            stroke="#fff"
            strokeWidth="2"
          />
        )
      })}
      {/* 도넛 구멍 */}
      <circle cx={cx} cy={cy} r={R * 0.5} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">지출 합계</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#374151">
        {Math.round(total / 10000)}만원
      </text>
    </svg>
  )
}

// ── 스타일 ───────────────────────────────────────────────
const S = {
  page: { maxWidth: 800, margin: '0 auto', padding: '32px 16px', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  pageTitle: { fontSize: 26, fontWeight: 800, marginBottom: 24, color: '#111827' },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 },
  kpiCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '18px 14px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
  kpiIcon: { fontSize: 24 },
  kpiLabel: { fontSize: 12, color: '#9ca3af', margin: '6px 0 4px', fontWeight: 500 },
  kpiValue: { fontSize: 18, fontWeight: 800, margin: 0 },
  tabRow: { display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 20, gap: 0 },
  tab: { flex: 1, padding: '10px 8px', background: 'none',  border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: 13, color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap' },
  tabActive: { color: '#6d28d9', borderBottom: '2px solid #6d28d9', marginBottom: -2, fontWeight: 700 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#111827' },
  bottomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  catList: { display: 'flex', flexDirection: 'column', gap: 12 },
  catRow: { display: 'flex', alignItems: 'center', gap: 8 },
  catLeft: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 70 },
  catDot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  catName: { fontSize: 13, fontWeight: 500 },
  catRight: { flex: 1, display: 'flex', alignItems: 'center', gap: 8 },
  catBarWrap: { flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  catBar: { height: '100%', borderRadius: 4, transition: 'width 0.8s ease' },
  catAmt: { fontSize: 13, fontWeight: 600, color: '#374151', minWidth: 70, textAlign: 'right' },
  legend: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' },
  legendDot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
}
