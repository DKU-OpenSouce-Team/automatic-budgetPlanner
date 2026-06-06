import { useState } from 'react'
import { useTransactions } from '../contexts/TransactionContext'

const CATEGORY_OPTIONS = ['전체', '식비', '교통', '쇼핑', '구독', '건강', '수입', '기타']
const FILE_TYPE_ICONS = { csv: '📊', json: '📋', txt: '📄' }

function nowStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function generateCSV(rows) {
  const header = '날짜,가게명,금액,카테고리\n'
  const body = rows.map(r => `${r.date},${r.store},${r.amount},${r.category}`).join('\n')
  return header + body
}

function generateTXT(rows) {
  const lines = rows.map(r => `[${r.date}] ${r.store.padEnd(12)} ${r.amount > 0 ? '+' : ''}${r.amount.toLocaleString()}원  (${r.category})`)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return lines.join('\n') + `\n\n──────────────\n합계: ${total > 0 ? '+' : ''}${total.toLocaleString()}원`
}

function generateJSON(rows) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, transactions: rows }, null, 2)
}

export default function MyFilesPage() {
  const { transactions } = useTransactions()           // ← 전역 데이터
  const [selected, setSelected] = useState(new Set())
  const [filterCat, setFilterCat] = useState('전체')
  const [filterType, setFilterType] = useState('지출')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')
  const [fileType, setFileType] = useState('csv')
  const [fileName, setFileName] = useState('')
  const [savedFiles, setSavedFiles] = useState([])
  const [previewContent, setPreviewContent] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [tab, setTab] = useState('select') // 'select' | 'files'
  const [saveSuccess, setSaveSuccess] = useState(false)


  // ── 필터링 & 정렬 ──
  const filtered = transactions
    .filter(t => {
      if (filterCat !== '전체' && t.category !== filterCat) return false
      if (filterType === '지출' && t.amount >= 0) return false
      if (filterType === '수입' && t.amount <= 0) return false
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo && t.date > dateTo) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return b.date.localeCompare(a.date)
      if (sortBy === 'date_asc') return a.date.localeCompare(b.date)
      if (sortBy === 'amount_desc') return b.amount - a.amount
      if (sortBy === 'amount_asc') return a.amount - b.amount
      return 0
    })

  // ── 전체 선택 ──
  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(t => t.id)))
    }
  }

  function toggleOne(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const selectedRows = filtered.filter(t => selected.has(t.id))

  // ── 미리보기 ──
  function handlePreview() {
    if (!selectedRows.length) return
    let content = ''
    if (fileType === 'csv') content = generateCSV(selectedRows)
    else if (fileType === 'txt') content = generateTXT(selectedRows)
    else content = generateJSON(selectedRows)
    setPreviewContent(content)
  }

  // ── 다운로드 ──
  function handleDownload() {
    if (!selectedRows.length) return
    let content = ''
    let mime = 'text/plain'
    let ext = fileType

    if (fileType === 'csv') { content = generateCSV(selectedRows); mime = 'text/csv' }
    else if (fileType === 'txt') { content = generateTXT(selectedRows); mime = 'text/plain' }
    else { content = generateJSON(selectedRows); mime = 'application/json' }

    const name = (fileName || `지출내역_${new Date().toISOString().slice(0, 10)}`) + '.' + ext
    const blob = new Blob([content], { type: mime + ';charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)

    // 파일 목록에 저장
    const newFile = {
      id: Date.now().toString(),
      name,
      type: fileType,
      count: selectedRows.length,
      size: Math.round(content.length / 1024 * 10) / 10 + ' KB',
      createdAt: nowStr(),
      content,
    }
    const updated = [newFile, ...savedFiles]
    setSavedFiles(updated)
    try { localStorage.setItem('myfiles', JSON.stringify(updated.map(f => ({ ...f, content: undefined })))) } catch { }
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  // ── 파일 삭제 ──
  function deleteFile(id) {
    if (!confirm('파일을 목록에서 삭제하시겠습니까?')) return
    const updated = savedFiles.filter(f => f.id !== id)
    setSavedFiles(updated)
    try { localStorage.setItem('myfiles', JSON.stringify(updated)) } catch { }
  }

  // ── 선택 요약 ──
  const selTotal = selectedRows.reduce((s, t) => s + t.amount, 0)
  const selExpense = Math.abs(selectedRows.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))

  return (
    <section style={S.page}>
      <h1 style={S.pageTitle}>나만의 파일</h1>

      {/* ── 탭 ── */}
      <div style={S.tabRow}>
        <button style={{ ...S.tab, ...(tab === 'select' ? S.tabActive : {}) }} onClick={() => setTab('select')}>
          📋 내역 선택 &amp; 내보내기
        </button>
        <button style={{ ...S.tab, ...(tab === 'files' ? S.tabActive : {}) }} onClick={() => setTab('files')}>
          📁 저장된 파일 {savedFiles.length > 0 && <span style={S.badge}>{savedFiles.length}</span>}
        </button>
      </div>

      {tab === 'select' && (
        <div style={S.twoCol}>
          {/* ── 왼쪽: 필터 + 목록 ── */}
          <div style={S.leftPane}>
            {/* 필터 */}
            <div style={S.filterCard}>
              <div style={S.filterRow}>
                <select style={S.sel} value={filterType} onChange={e => { setFilterType(e.target.value); setSelected(new Set()) }}>
                  <option value="전체">전체</option>
                  <option value="지출">지출만</option>
                  <option value="수입">수입만</option>
                </select>
                <select style={S.sel} value={filterCat} onChange={e => { setFilterCat(e.target.value); setSelected(new Set()) }}>
                  {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                <select style={S.sel} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="date_desc">최신순</option>
                  <option value="date_asc">오래된순</option>
                  <option value="amount_desc">금액 높은순</option>
                  <option value="amount_asc">금액 낮은순</option>
                </select>
              </div>
              <div style={S.filterRow}>
                <input style={S.dateInput} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="시작일" />
                <span style={{ color: '#9ca3af', fontSize: 14 }}>~</span>
                <input style={S.dateInput} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="종료일" />
                <button style={S.clearBtn} onClick={() => { setDateFrom(''); setDateTo('') }}>초기화</button>
              </div>
            </div>

            {/* 전체 선택 헤더 */}
            <div style={S.listHeader}>
              <label style={S.checkLabel}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  style={{ accentColor: '#6d28d9', width: 15, height: 15 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>전체 선택 ({filtered.length}건)</span>
              </label>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{selected.size}건 선택됨</span>
            </div>

            {/* 내역 목록 */}
            <div style={S.txList}>
              {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>내역이 없습니다.</p>
              ) : filtered.map(tx => (
                <label key={tx.id} style={{ ...S.txItem, background: selected.has(tx.id) ? '#faf5ff' : '#fff', borderColor: selected.has(tx.id) ? '#ddd6fe' : '#e5e7eb' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(tx.id)}
                    onChange={() => toggleOne(tx.id)}
                    style={{ accentColor: '#6d28d9', width: 15, height: 15, flexShrink: 0 }}
                  />
                  <div style={S.txInfo}>
                    <span style={S.txStore}>{tx.store}</span>
                    <span style={S.txMeta}>{tx.date} · {tx.category}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: tx.amount < 0 ? '#ef4444' : '#16a34a' }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}원
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 내보내기 설정 ── */}
          <div style={S.rightPane}>
            {/* 선택 요약 */}
            <div style={S.summaryCard}>
              <h3 style={S.sectionTitle}>선택 요약</h3>
              {selected.size === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af' }}>내역을 선택해주세요.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={S.summaryRow2}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>선택 건수</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size}건</span>
                  </div>
                  <div style={S.summaryRow2}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>총 지출</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>-{selExpense.toLocaleString()}원</span>
                  </div>
                  <div style={S.summaryRow2}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>순 합계</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selTotal >= 0 ? '#16a34a' : '#ef4444' }}>
                      {selTotal >= 0 ? '+' : ''}{selTotal.toLocaleString()}원
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 내보내기 설정 */}
            <div style={S.exportCard}>
              <h3 style={S.sectionTitle}>내보내기 설정</h3>

              <p style={S.fieldLabel}>파일 이름</p>
              <input
                style={S.input}
                placeholder="지출내역_2026-06"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
              />

              <p style={S.fieldLabel}>파일 형식</p>
              <div style={S.typeRow}>
                {['csv', 'txt', 'json'].map(t => (
                  <button
                    key={t}
                    style={{ ...S.typeBtn, ...(fileType === t ? S.typeBtnActive : {}) }}
                    onClick={() => setFileType(t)}
                  >
                    {FILE_TYPE_ICONS[t]} .{t.toUpperCase()}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  style={{ ...S.previewBtn, opacity: selected.size ? 1 : 0.5 }}
                  onClick={handlePreview}
                  disabled={!selected.size}
                >
                  미리보기
                </button>
                <button
                  style={{ ...S.downloadBtn, opacity: selected.size ? 1 : 0.5 }}
                  onClick={handleDownload}
                  disabled={!selected.size}
                >
                  ⬇️ 다운로드
                </button>
              </div>

              {saveSuccess && (
                <div style={S.successBanner}>✅ 파일이 저장되었습니다!</div>
              )}
            </div>

            {/* 미리보기 */}
            {previewContent && (
              <div style={S.previewCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ ...S.sectionTitle, margin: 0 }}>미리보기</h3>
                  <button style={S.closeBtn} onClick={() => setPreviewContent(null)}>✕</button>
                </div>
                <pre style={S.previewPre}>{previewContent.slice(0, 600)}{previewContent.length > 600 ? '\n...(생략)' : ''}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div style={S.card}>
          <h3 style={S.sectionTitle}>저장된 파일 목록</h3>
          {savedFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
              <p style={{ fontSize: 14 }}>저장된 파일이 없습니다.</p>
              <p style={{ fontSize: 13 }}>내역 선택 탭에서 파일을 내보내보세요.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {savedFiles.map(f => (
                <div key={f.id} style={S.fileItem}>
                  <div style={S.fileIcon}>{FILE_TYPE_ICONS[f.type] || '📄'}</div>
                  <div style={S.fileInfo}>
                    <span style={S.fileName}>{f.name}</span>
                    <span style={S.fileMeta}>{f.count}건 · {f.size} · {f.createdAt}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={S.filePreviewBtn}
                      onClick={() => {
                        setPreviewFile(f)
                        setPreviewContent(f.content || '(내용 없음)')
                      }}
                    >
                      보기
                    </button>
                    <button style={S.fileDeleteBtn} onClick={() => deleteFile(f.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {previewContent && previewFile && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{previewFile.name}</h4>
                <button style={S.closeBtn} onClick={() => { setPreviewContent(null); setPreviewFile(null) }}>✕</button>
              </div>
              <pre style={S.previewPre}>{previewContent || '(저장된 내용 없음)'}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── 스타일 ───────────────────────────────────────────────
const S = {
  page: { maxWidth: 960, margin: '0 auto', padding: '32px 16px', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  pageTitle: { fontSize: 26, fontWeight: 800, marginBottom: 24, color: '#111827' },
  tabRow: { display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 },
  tab: { padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', fontWeight: 500 },
  tabActive: { color: '#6d28d9', borderBottom: '2px solid #6d28d9', marginBottom: -2, fontWeight: 700 },
  badge: { display: 'inline-block', background: '#6d28d9', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 6px', marginLeft: 6 },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' },
  leftPane: { display: 'flex', flexDirection: 'column', gap: 12 },
  rightPane: { display: 'flex', flexDirection: 'column', gap: 12 },

  filterCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  filterRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  sel: { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#fff' },
  dateInput: { padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 },
  clearBtn: { padding: '7px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 12 },

  listHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },

  txList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 440, overflowY: 'auto' },
  txItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', transition: 'background 0.1s, border-color 0.1s' },
  txInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  txStore: { fontSize: 14, fontWeight: 600, color: '#111827' },
  txMeta: { fontSize: 12, color: '#9ca3af' },

  summaryCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 },
  exportCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 },
  previewCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },

  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#111827' },
  summaryRow2: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f9fafb' },

  fieldLabel: { fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 14 },
  typeRow: { display: 'flex', gap: 8 },
  typeBtn: { flex: 1, padding: '9px 0', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  typeBtnActive: { background: '#ede9fe', border: '1px solid #c4b5fd', color: '#6d28d9', fontWeight: 700 },

  previewBtn: { flex: 1, padding: '10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  downloadBtn: { flex: 2, padding: '10px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },

  successBanner: { marginTop: 12, padding: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#16a34a', textAlign: 'center', fontWeight: 600 },

  previewPre: { background: '#1e1e2e', color: '#cdd6f4', padding: 14, borderRadius: 8, fontSize: 12, overflowX: 'auto', overflowY: 'auto', maxHeight: 220, whiteSpace: 'pre', fontFamily: 'monospace', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' },

  fileItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa' },
  fileIcon: { fontSize: 26, flexShrink: 0 },
  fileInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  fileName: { fontSize: 14, fontWeight: 600, color: '#111827' },
  fileMeta: { fontSize: 12, color: '#9ca3af' },
  filePreviewBtn: { padding: '5px 12px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#6d28d9', fontWeight: 600 },
  fileDeleteBtn: { padding: '5px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#ef4444', fontWeight: 600 },
}
