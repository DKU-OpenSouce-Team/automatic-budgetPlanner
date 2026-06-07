import { useState, useEffect, useCallback } from 'react'
import { useTransactions } from '../contexts/TransactionContext'
import { api } from '../api/client'

const CATEGORY_OPTIONS = ['전체', '식비', '카페/간식', '편의점', '마트/쇼핑', '의료/건강', '교통', '문화/여가', '의류', '수입', '기타']

// 백엔드 created_at(ISO) → "YYYY-MM-DD HH:MM"
function fmtDate(s) {
  if (!s) return ''
  return String(s).slice(0, 16).replace('T', ' ')
}

export default function MyFilesPage() {
  const { transactions } = useTransactions()           // ← 전역(백엔드) 데이터
  const [selected, setSelected] = useState(new Set())
  const [filterCat, setFilterCat] = useState('전체')
  const [filterType, setFilterType] = useState('전체')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')

  // 파일 저장 폼
  const [fileName, setFileName] = useState('')
  const [fileDesc, setFileDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 백엔드 파일 목록 / 상세
  const [savedFiles, setSavedFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)         // { ...file, transactions }

  const [tab, setTab] = useState('select')           // 'select' | 'files'

  // ── 백엔드 파일 목록 로드 ──
  const loadFiles = useCallback(async () => {
    setLoadingFiles(true)
    setError('')
    try {
      setSavedFiles(await api.get('/files'))
    } catch (e) {
      setError(e.message || '파일 목록을 불러오지 못했습니다.')
    } finally {
      setLoadingFiles(false)
    }
  }, [])

  useEffect(() => { loadFiles() }, [loadFiles])

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

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(t => t.id)))
  }

  function toggleOne(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const selectedRows = filtered.filter(t => selected.has(t.id))
  const selTotal = selectedRows.reduce((s, t) => s + t.amount, 0)
  const selExpense = Math.abs(selectedRows.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))

  // ── 파일 저장 (POST /files) ──
  async function handleSaveFile() {
    if (!selected.size) return
    if (!fileName.trim()) { setError('파일 이름을 입력해주세요.'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/files', {
        name: fileName.trim(),
        description: fileDesc.trim() || null,
        transaction_ids: [...selected],
      })
      setFileName(''); setFileDesc(''); setSelected(new Set())
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
      await loadFiles()
      setTab('files')
    } catch (e) {
      setError(e.message || '파일 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // ── 내보내기 다운로드 (GET /files/{id}/export) ──
  async function handleDownload(file, fmt) {
    try {
      const blob = await api.download(`/files/${file.id}/export?fmt=${fmt}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${file.name}.${fmt}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('다운로드 실패: ' + (e.message || ''))
    }
  }

  // ── 파일 상세 보기 (GET /files/{id}) ──
  async function handleViewDetail(file) {
    if (detail && detail.id === file.id) { setDetail(null); return }
    try {
      setDetail(await api.get(`/files/${file.id}`))
    } catch (e) {
      alert('상세 조회 실패: ' + (e.message || ''))
    }
  }

  // ── 파일 삭제 (DELETE /files/{id}) ──
  async function handleDeleteFile(id) {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return
    try {
      await api.del(`/files/${id}`)
      if (detail && detail.id === id) setDetail(null)
      await loadFiles()
    } catch (e) {
      alert('삭제 실패: ' + (e.message || ''))
    }
  }

  return (
    <section style={S.page}>
      <h1 style={S.pageTitle}>나만의 파일</h1>

      <div style={S.tabRow}>
        <button style={{ ...S.tab, ...(tab === 'select' ? S.tabActive : {}) }} onClick={() => setTab('select')}>
          📋 내역 선택 &amp; 저장
        </button>
        <button style={{ ...S.tab, ...(tab === 'files' ? S.tabActive : {}) }} onClick={() => setTab('files')}>
          📁 저장된 파일 {savedFiles.length > 0 && <span style={S.badge}>{savedFiles.length}</span>}
        </button>
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {tab === 'select' && (
        <div style={S.twoCol}>
          {/* ── 왼쪽: 필터 + 목록 ── */}
          <div style={S.leftPane}>
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
                <input style={S.dateInput} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span style={{ color: '#9ca3af', fontSize: 14 }}>~</span>
                <input style={S.dateInput} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                <button style={S.clearBtn} onClick={() => { setDateFrom(''); setDateTo('') }}>초기화</button>
              </div>
            </div>

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

          {/* ── 오른쪽: 선택 요약 + 파일 저장 ── */}
          <div style={S.rightPane}>
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

            <div style={S.exportCard}>
              <h3 style={S.sectionTitle}>파일로 저장</h3>
              <p style={S.fieldLabel}>파일 이름</p>
              <input style={S.input} placeholder="예: 6월 식비 정리" value={fileName} onChange={e => setFileName(e.target.value)} />
              <p style={S.fieldLabel}>설명 (선택)</p>
              <input style={S.input} placeholder="메모" value={fileDesc} onChange={e => setFileDesc(e.target.value)} />

              <button
                style={{ ...S.downloadBtn, width: '100%', opacity: selected.size && !saving ? 1 : 0.5 }}
                onClick={handleSaveFile}
                disabled={!selected.size || saving}
              >
                {saving ? '저장 중...' : `💾 ${selected.size}건 파일로 저장`}
              </button>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, marginBottom: 0 }}>
                저장한 파일은 ‘저장된 파일’ 탭에서 Excel/CSV로 내려받을 수 있어요.
              </p>

              {saveSuccess && <div style={S.successBanner}>✅ 파일이 저장되었습니다!</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div style={S.card}>
          <h3 style={S.sectionTitle}>저장된 파일 목록</h3>
          {loadingFiles ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>불러오는 중...</p>
          ) : savedFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
              <p style={{ fontSize: 14 }}>저장된 파일이 없습니다.</p>
              <p style={{ fontSize: 13 }}>‘내역 선택 &amp; 저장’ 탭에서 파일을 만들어보세요.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {savedFiles.map(f => (
                <div key={f.id}>
                  <div style={S.fileItem}>
                    <div style={S.fileIcon}>📁</div>
                    <div style={S.fileInfo}>
                      <span style={S.fileName}>{f.name}</span>
                      <span style={S.fileMeta}>
                        {f.count}건{f.description ? ` · ${f.description}` : ''} · {fmtDate(f.created_at)}
                      </span>
                    </div>
                    <div style={S.fileActions}>
                      <button style={S.viewBtn} onClick={() => handleViewDetail(f)}>
                        {detail && detail.id === f.id ? '접기' : '보기'}
                      </button>
                      <button style={S.xlsxBtn} onClick={() => handleDownload(f, 'xlsx')}>Excel</button>
                      <button style={S.csvBtn} onClick={() => handleDownload(f, 'csv')}>CSV</button>
                      <button style={S.fileDeleteBtn} onClick={() => handleDeleteFile(f.id)}>삭제</button>
                    </div>
                  </div>

                  {detail && detail.id === f.id && (
                    <div style={S.detailBox}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>포함 내역 {detail.count}건</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9' }}>
                          합계 {Number(detail.total || 0).toLocaleString()}원
                        </span>
                      </div>
                      {(detail.transactions || []).length === 0 ? (
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>내역 없음</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {detail.transactions.map(t => (
                            <div key={t.id} style={S.detailRow}>
                              <span style={{ fontSize: 12 }}>{(t.spent_at || t.date || '').slice(0, 10)} · {t.store}</span>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{Number(t.amount || 0).toLocaleString()}원</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
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
  tab: { padding: '10px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: 14, color: '#9ca3af', fontWeight: 500 },
  tabActive: { color: '#6d28d9', borderBottom: '2px solid #6d28d9', marginBottom: -2, fontWeight: 700 },
  badge: { display: 'inline-block', background: '#6d28d9', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 6px', marginLeft: 6 },
  errorBanner: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#ef4444', marginBottom: 16 },

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
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },

  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#111827' },
  summaryRow2: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f9fafb' },

  fieldLabel: { fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 14 },

  downloadBtn: { padding: '11px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  successBanner: { marginTop: 12, padding: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#16a34a', textAlign: 'center', fontWeight: 600 },

  fileItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa' },
  fileIcon: { fontSize: 26, flexShrink: 0 },
  fileInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  fileName: { fontSize: 14, fontWeight: 600, color: '#111827' },
  fileMeta: { fontSize: 12, color: '#9ca3af' },
  fileActions: { display: 'flex', gap: 6, flexShrink: 0 },
  viewBtn: { padding: '5px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  xlsxBtn: { padding: '5px 10px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#047857', fontWeight: 600 },
  csvBtn: { padding: '5px 10px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#1d4ed8', fontWeight: 600 },
  fileDeleteBtn: { padding: '5px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#ef4444', fontWeight: 600 },

  detailBox: { margin: '6px 0 0', padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f9fafb' },
}
