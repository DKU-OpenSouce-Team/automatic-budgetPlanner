import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TransactionProvider } from './contexts/TransactionContext'
import MainPage from './pages/MainPage.jsx'
import ReceiptUploadPage from './pages/ReceiptUploadPage.jsx'
import TransactionsPage from './pages/TransactionsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import MyFilesPage from './pages/MyFilesPage.jsx'
import LoginPage from './pages/LoginPage.jsx'

const NAV_ITEMS = [
  { to: '/',             label: '메인 페이지',  icon: <GridIcon /> },
  { to: '/upload',       label: '영수증 등록',  icon: <ReceiptIcon /> },
  { to: '/transactions', label: '지출 내역',    icon: <ListIcon /> },
  { to: '/analytics',    label: '분석 & 통계', icon: <ChartIcon /> },
  { to: '/files',        label: '나만의 파일',  icon: <FileIcon /> },
]

export default function App() {
  return (
    <AuthProvider>
      <TransactionProvider>
        <div style={S.app}>
          <Navbar />
          <main style={S.content}>
            <Routes>
              <Route path="/"             element={<MainPage />} />
              <Route path="/upload"       element={<RequireAuth><ReceiptUploadPage /></RequireAuth>} />
              <Route path="/transactions" element={<RequireAuth><TransactionsPage /></RequireAuth>} />
              <Route path="/analytics"    element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
              <Route path="/files"        element={<RequireAuth><MyFilesPage /></RequireAuth>} />
              <Route path="/login"        element={<LoginPage />} />
            </Routes>
          </main>
        </div>
      </TransactionProvider>
    </AuthProvider>
  )
}

// 로그인 안 된 사용자가 보호 페이지에 접근하면 로그인 화면으로 보낸다.
function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav style={S.nav}>
      <Link to="/" style={S.logo}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
        BillGets
      </Link>
      <div style={S.navCenter}>
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.to
          return (
            <Link key={item.to} to={item.to}
              style={{ ...S.navLink, ...(active ? S.navLinkActive : {}) }}>
              <span style={S.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </div>
      {isAuthenticated ? (
        <div style={S.userArea}>
          <span style={S.userEmail}>{user?.email}</span>
          <button style={S.loginBtn} onClick={handleLogout}>
            <LoginIcon />
            로그아웃
          </button>
        </div>
      ) : (
        <Link to="/login" style={S.loginBtn}>
          <LoginIcon />
          로그인
        </Link>
      )}
    </nav>
  )
}

function GridIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
}
function ReceiptIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function ListIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
}
function ChartIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
}
function FileIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
}
function LoginIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
}

const S = {
  app: { minHeight: '100vh', background: '#f9fafb', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  content: { padding: '28px 16px' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 56, padding: '0 24px', background: '#fff',
    borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontWeight: 800, fontSize: 16, color: '#111827', textDecoration: 'none',
    letterSpacing: '-0.3px', minWidth: 110,
  },
  navCenter: {
    display: 'flex', alignItems: 'center', gap: 2,
    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
  },
  navLink: {
    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px',
    borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#6b7280',
    textDecoration: 'none', transition: 'background 0.15s, color 0.15s', whiteSpace: 'nowrap',
  },
  navLinkActive: { background: '#ede9fe', color: '#6d28d9', fontWeight: 700 },
  navIcon: { display: 'flex', alignItems: 'center', opacity: 0.85 },
  loginBtn: {
    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
    borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#374151',
    textDecoration: 'none', border: '1px solid #e5e7eb', background: '#fff',
    minWidth: 76, justifyContent: 'center', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  userArea: { display: 'flex', alignItems: 'center', gap: 10 },
  userEmail: {
    fontSize: 12, color: '#6b7280', fontWeight: 500,
    maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
}
