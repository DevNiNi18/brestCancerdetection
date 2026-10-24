import { useState } from 'react'
import './style.css'

export type ClinicianUser = {
  name: string
  role: string
  dept: string
  id: string
  initials: string
  avatarColor: string
}

export const DEMO_CLINICIANS: ClinicianUser[] = [
  {
    name: 'Dr. Amina Bello',
    role: 'Lead Oncologist',
    dept: 'Oncology',
    id: 'HW-DOC-001',
    initials: 'AB',
    avatarColor: '#2563eb',
  },
  {
    name: 'Dr. Marcus Vance',
    role: 'Senior Radiologist',
    dept: 'Diagnostic Radiology',
    id: 'HW-RAD-042',
    initials: 'MV',
    avatarColor: '#159b91',
  },
  {
    name: 'Dr. Sarah Chen',
    role: 'Consultant Pathologist',
    dept: 'Pathology',
    id: 'HW-PAT-018',
    initials: 'SC',
    avatarColor: '#7c3aed',
  },
]

type AuthProps = {
  onLogin: (user: ClinicianUser) => void
  onNotify?: (message: string) => void
}

export default function AuthPage({ onLogin, onNotify }: AuthProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    setTimeout(() => {
      setIsLoading(false)

      const matched = DEMO_CLINICIANS.find(
        c =>
          c.id.toLowerCase() === username.trim().toLowerCase() ||
          c.name.toLowerCase().includes(username.trim().toLowerCase()) ||
          c.dept.toLowerCase().includes(username.trim().toLowerCase())
      )

      const resolvedUser: ClinicianUser = matched || {
        name: username.trim()
          ? username.includes('@')
            ? username.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())
            : username
          : 'Dr. Amina Bello',
        role: isRegisterMode ? 'Clinical Practitioner' : 'Lead Oncologist',
        dept: 'Oncology',
        id: 'MED-9021',
        initials: username.trim() ? username.slice(0, 2).toUpperCase() : 'AB',
        avatarColor: '#3d97a2',
      }

      onNotify?.(isRegisterMode ? `Account created! Welcome, ${resolvedUser.name}` : `Welcome back, ${resolvedUser.name}`)
      onLogin(resolvedUser)
    }, 450)
  }

  function handleQuickFill(clinician: ClinicianUser) {
    setUsername(clinician.name)
    setPassword('••••••••••••')
    onLogin(clinician)
  }

  return (
    <div className="medlink-auth-page">
      <div className="medlink-auth-card">
        {/* Header */}
        <div className="medlink-auth-header">
          <h1 className="medlink-auth-title">
            {isRegisterMode ? 'Create your Medlink Account' : 'Welcome Back to Medlink'}
          </h1>
          <p className="medlink-auth-subtitle">
            {isRegisterMode
              ? 'Register your clinical credentials to begin managing patients and AI assessments.'
              : 'Sign in to continue managing patients, appointments, and hospital operations in real time.'}
          </p>
        </div>

        {/* Form */}
        <form className="medlink-auth-form" onSubmit={handleSubmit}>
          <div className="medlink-form-group">
            <label className="medlink-label" htmlFor="medlink-email">
              Email or Username
            </label>
            <div className="medlink-input-wrapper">
              <input
                id="medlink-email"
                type="text"
                className="medlink-input"
                placeholder="Input your email or username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="medlink-form-group">
            <label className="medlink-label" htmlFor="medlink-password">
              Password
            </label>
            <div className="medlink-input-wrapper">
              <input
                id="medlink-password"
                type={showPassword ? 'text' : 'password'}
                className="medlink-input"
                placeholder="Input your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="medlink-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  /* Eye off icon */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* Eye icon matching screenshot */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="medlink-controls-row">
            <label className="medlink-remember-label">
              <input
                type="checkbox"
                className="medlink-checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span>Remember Me</span>
            </label>

            <a
              href="#forgot-password"
              className="medlink-forgot-link"
              onClick={e => {
                e.preventDefault()
                onNotify?.('Password recovery link sent to clinical IT administrator.')
              }}
            >
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            className="medlink-login-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : isRegisterMode ? 'Create Account' : 'Login'}
          </button>
        </form>

        {/* Footer */}
        <div className="medlink-auth-footer">
          {isRegisterMode ? (
            <>
              Already have an account?
              <a
                href="#login"
                className="medlink-register-link"
                onClick={e => {
                  e.preventDefault()
                  setIsRegisterMode(false)
                }}
              >
                Sign in
              </a>
            </>
          ) : (
            <>
              New to Medlink?
              <a
                href="#register"
                className="medlink-register-link"
                onClick={e => {
                  e.preventDefault()
                  setIsRegisterMode(true)
                }}
              >
                Create an account
              </a>
            </>
          )}
        </div>

        {/* Quick Demo Clinician Switcher */}
        <div className="medlink-demo-hint">
          <span className="medlink-demo-label">Demo Logins:</span>
          <div className="medlink-demo-chips">
            {DEMO_CLINICIANS.map(clinician => (
              <button
                key={clinician.id}
                type="button"
                className="medlink-demo-chip"
                onClick={() => handleQuickFill(clinician)}
                title={`Login as ${clinician.name}`}
              >
                {clinician.name.split(' ')[1]} ({clinician.dept.split(' ')[0]})
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
