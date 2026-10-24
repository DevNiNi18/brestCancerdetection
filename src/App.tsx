import { useState } from 'react'
import DashboardHome from './components/dashboard'
import PatientPage from './components/patient'
import NewAssessment from './components/assessment'
import AssessmentHistory from './components/history'
import ReportsPage from './components/reports'
import AuthPage, { type ClinicianUser, DEMO_CLINICIANS } from './components/auth'
import './App.css'

/* ─── Navigation Config ──────────────────────────────────────── */

const navigation = [
  { name: 'Dashboard', icon: '⌂' },
  { name: 'Patients', icon: '♧' },
  { name: 'New Assessment', icon: '⊕' },
  { name: 'Assessment History', icon: '◷' },
  { name: 'Reports', icon: '▤' },
]

/* ─── Shell Components ───────────────────────────────────────── */

type HeaderProps = {
  onMenuClick: () => void
  user: ClinicianUser
  onSignOut: () => void
}

function AppHeader({ onMenuClick, user, onSignOut }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onMenuClick}>☰</button>
        <div className="brand-mark">✚</div>
        <div>
          <div className="brand-name">BreastCare <span>AI</span></div>
          <div className="brand-sub">Clinical Decision Support System</div>
        </div>
      </div>

      <div className="top-actions">
        {/* Clean Profile Display */}
        <div className="profile">
          <div className="avatar" style={{ backgroundColor: user.avatarColor || '#2563eb', color: '#fff' }}>
            {user.initials}
          </div>
          <div className="profile-copy">
            <div className="profile-name">{user.name}</div>
            <div className="profile-role">{user.dept} · {user.id}</div>
          </div>
        </div>

        {/* Direct Sign Out Button */}
        <button
          type="button"
          className="topbar-signout-btn"
          onClick={onSignOut}
          title="Sign out of clinical session"
        >
          <span className="signout-icon">⎋</span>
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  )
}

function SideNavigation({
  onSelect,
  open,
  active,
}: {
  onSelect: (page: string) => void
  open: boolean
  active: string
}) {
  return (
    <>
      <button className={`sidebar-backdrop ${open ? 'visible' : ''}`} aria-label="Close navigation" onClick={() => onSelect(active)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="side-label">Workspace</div>
        {navigation.map(item => (
          <button
            className={`nav-link ${active === item.name ? 'active' : ''}`}
            key={item.name}
            onClick={() => onSelect(item.name)}
          >
            <span className="nav-icon">{item.icon}</span>{item.name}
          </button>
        ))}
      </aside>
    </>
  )
}

/* ─── Main App ──────────────────────────────────────────────── */

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<ClinicianUser>(DEMO_CLINICIANS[0])
  const [toast, setToast] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activePage, setActivePage] = useState('Reports')

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  function handleLogin(user: ClinicianUser) {
    setCurrentUser(user)
    setIsAuthenticated(true)
    notify(`Signed in as ${user.name} (${user.role})`)
  }

  function handleSignOut() {
    setIsAuthenticated(false)
    notify('Successfully signed out of General Teaching Hospital workspace.')
  }

  function navigate(page: string) {
    if (page === 'Dashboard' || page === 'Patients' || page === 'New Assessment' || page === 'Assessment History' || page === 'Reports') {
      setActivePage(page)
    } else {
      notify(`${page} page is not connected yet.`)
    }
    setMobileOpen(false)
  }

  // Unauthenticated State: Show Auth Page
  if (!isAuthenticated) {
    return (
      <>
        <AuthPage onLogin={handleLogin} onNotify={notify} />
        <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
      </>
    )
  }

  // Authenticated State: Show Clinical Workspace
  return (
    <div className="app">
      <AppHeader
        onMenuClick={() => setMobileOpen(!mobileOpen)}
        user={currentUser}
        onSignOut={handleSignOut}
      />
      <div className="layout">
        <SideNavigation
          open={mobileOpen}
          active={activePage}
          onSelect={navigate}
        />
        <main>
          {activePage === 'Dashboard' && <DashboardHome onNavigate={navigate} />}
          {activePage === 'Patients' && <PatientPage onNotify={notify} onNavigate={navigate} />}
          {activePage === 'New Assessment' && <NewAssessment onNavigate={navigate} onNotify={notify} />}
          {activePage === 'Assessment History' && <AssessmentHistory onNavigate={navigate} onNotify={notify} />}
          {activePage === 'Reports' && <ReportsPage onNavigate={navigate} onNotify={notify} />}
        </main>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </div>
  )
}

export default App
