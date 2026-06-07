import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../contexts/TransactionContext'

const TABS = ['영수증 업로드', '수동 작성', 'CSV 업로드']

export default function ReceiptUploadPage() {
  const [tab, setTab] = useState(0)

  return (
    <section style={styles.container}>
      <h1 style={styles.title}>영수증 등록</h1>

      <div style={styles.tabRow}>
        {TABS.map((t, i) => (
          <button
            key={i}
            style={{ ...styles.tab, ...(tab === i ? styles.tabActive : {}) }}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={styles.card}>
        {tab === 0 && <ReceiptUpload />}
        {tab === 1 && <ManualEntry />}
        {tab === 2 && <CsvUpload />}
      </div>
    </section>
  )
}

// ── 1. 영수증 업로드 + OCR ──────────────────────────────
function ReceiptUpload() {
  const { refresh } = useTransactions()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 수정 폼 상태
  const [store, setStore] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setOcrResult(null)
    setError('')
  }

  async function handleUpload() {
    if (!file) { setError('파일을 선택해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:8000/receipts', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOcrResult(data)
      setStore(data.store || '')
      setAmount(data.amount || '')
      setDate(data.date || '')
      setCategory(data.category || '')
    } catch {
      setError('OCR 처리에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:8000/receipts/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ store, amount: Number(amount) || 0, date, category }),
      })
      if (!res.ok) throw new Error()
      await refresh()   // 전역 내역 동기화 → 목록/통계 화면에 즉시 반영
      alert('저장되었습니다!')
      setFile(null); setPreview(null); setOcrResult(null)
      navigate('/transactions')
    } catch {
      setError('저장에 실패했습니다.')
    }
  }

  return (
    <div>
      <div style={styles.uploadBox} onClick={() => document.getElementById('receipt-input').click()}>
        {preview
          ? <img src={preview} alt="미리보기" style={styles.preview} />
          : <div style={styles.uploadPlaceholder}>
              <span style={styles.uploadIcon}>📷</span>
              <p>클릭하여 영수증 이미지 선택</p>
              <p style={styles.uploadHint}>JPG, PNG, PDF 지원</p>
            </div>
        }
      </div>
      <input id="receipt-input" type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />

      {error && <p style={styles.error}>{error}</p>}

      <button style={styles.button} onClick={handleUpload} disabled={loading}>
        {loading ? 'OCR 분석 중...' : 'OCR 분석 시작'}
      </button>

      {ocrResult && (
        <div style={styles.resultBox}>
          <h3 style={styles.resultTitle}>OCR 결과 확인 · 수정</h3>
          <div style={styles.fieldGrid}>
            <label style={styles.label}>가게명</label>
            <input style={styles.input} value={store} onChange={e => setStore(e.target.value)} />
            <label style={styles.label}>금액 (원)</label>
            <input style={styles.input} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <label style={styles.label}>날짜</label>
            <input style={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
            <label style={styles.label}>카테고리</label>
            <input style={styles.input} value={category} onChange={e => setCategory(e.target.value)} placeholder="식비, 교통, 쇼핑 등" />
          </div>
          <button style={styles.button} onClick={handleSave}>저장</button>
        </div>
      )}
    </div>
  )
}

// ── 2. 수동 작성 ────────────────────────────────────────
function ManualEntry() {
  const { addTransaction } = useTransactions()
  const navigate = useNavigate()
  const [store, setStore] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!store || !amount || !date) { setError('가게명, 금액, 날짜는 필수입니다.'); return }
    setError('')
    try {
      // 컨텍스트 경유로 저장(POST /transactions) → 전역 내역 즉시 동기화
      await addTransaction({ store, amount, date, category, memo })
      alert('저장되었습니다!')
      setStore(''); setAmount(''); setDate(''); setCategory(''); setMemo('')
      navigate('/transactions')
    } catch {
      setError('저장에 실패했습니다.')
    }
  }

  return (
    <div>
      <h3 style={styles.resultTitle}>지출 내역 직접 입력</h3>
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.fieldGrid}>
        <label style={styles.label}>가게명 *</label>
        <input style={styles.input} value={store} onChange={e => setStore(e.target.value)} placeholder="스타벅스" />
        <label style={styles.label}>금액 (원) *</label>
        <input style={styles.input} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" />
        <label style={styles.label}>날짜 *</label>
        <input style={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <label style={styles.label}>카테고리</label>
        <input style={styles.input} value={category} onChange={e => setCategory(e.target.value)} placeholder="식비, 교통, 쇼핑 등" />
        <label style={styles.label}>메모</label>
        <input style={styles.input} value={memo} onChange={e => setMemo(e.target.value)} placeholder="선택사항" />
      </div>
      <button style={styles.button} onClick={handleSubmit}>저장</button>
    </div>
  )
}

// ── 3. CSV 업로드 ───────────────────────────────────────
function CsvUpload() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload() {
    if (!file) { setError('CSV 파일을 선택해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:8000/files/csv', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error()
      alert('CSV 업로드 완료!')
      setFile(null)
    } catch {
      setError('업로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 style={styles.resultTitle}>은행 CSV 업로드</h3>
      <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>
        은행 앱에서 내보낸 거래내역 CSV 파일을 업로드하세요.
      </p>
      <div style={styles.uploadBox} onClick={() => document.getElementById('csv-input').click()}>
        <div style={styles.uploadPlaceholder}>
          <span style={styles.uploadIcon}>📄</span>
          <p>{file ? file.name : 'CSV 파일 선택'}</p>
          <p style={styles.uploadHint}>.csv 파일만 지원</p>
        </div>
      </div>
      <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => { setFile(e.target.files[0]); setError('') }} />
      {error && <p style={styles.error}>{error}</p>}
      <button style={styles.button} onClick={handleUpload} disabled={loading}>
        {loading ? '업로드 중...' : '업로드'}
      </button>
    </div>
  )
}

// ── 스타일 ───────────────────────────────────────────────
const styles = {
  container: { maxWidth: '600px', margin: '0 auto', padding: '32px 16px' },
  title: { fontSize: '24px', fontWeight: '700', marginBottom: '24px' },
  tabRow: { display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' },
  tab: { flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#9ca3af', fontWeight: '500' },
  tabActive: { color: '#6d28d9', borderBottom: '2px solid #6d28d9', marginBottom: '-2px' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' },
  uploadBox: { border: '2px dashed #d1d5db', borderRadius: '8px', padding: '32px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' },
  uploadPlaceholder: { color: '#9ca3af' },
  uploadIcon: { fontSize: '32px' },
  uploadHint: { fontSize: '12px', marginTop: '4px' },
  preview: { maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' },
  button: { width: '100%', padding: '12px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  error: { color: '#ef4444', fontSize: '13px', margin: '8px 0' },
  resultBox: { marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' },
  resultTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px' },
  fieldGrid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px', alignItems: 'center', marginBottom: '16px' },
  label: { fontSize: '14px', color: '#374151', fontWeight: '500' },
  input: { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' },
}

