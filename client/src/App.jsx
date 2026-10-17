import Logo from './Logo.jsx'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import StudentDashboard from './features/student/StudentDashboard.jsx'
import FacultyDashboard from './features/faculty/FacultyDashboard.jsx'
import DemoPortal from './DemoPortal.jsx'
import './App.css'
import './Typography.css'

async function api(path, body) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error || data.message || 'Request failed. Please try again.'), { status: response.status, ...data })
  return data
}

function Login({ domain }) {
  const { role } = useParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const template = role === 'student' ? `name_123456@${domain}` : `name@${domain}`
  const emailError = role === 'student' ? `Use ${template} with a six-digit registration number.` : `Use ${template} for faculty sign-in.`
  const localPattern = role === 'student' ? /^[a-z][a-z.-]*_\d{6}$/i : /^[a-z][a-z.-]*$/i
  const parts = email.trim().toLowerCase().split('@')
  const validEmail = parts.length === 2 && parts[1] === domain && localPattern.test(parts[0])

  if (!['student', 'faculty'].includes(role)) return <Navigate to="/login/student" replace />

  async function signIn(event) {
    event.preventDefault()
    setTouched(true)
    setError('')
    if (!validEmail || password.length < 8 || busy) return
    setBusy(true)
    try {
      await api('/auth/login', { email, password, role })
      navigate(`/${role}/dashboard`, { replace: true })
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="shell">
    <aside className="intro"><a className="brand" href="/"><Logo /></a><div><p className="eyebrow">YOUR CAMPUS. CONNECTED.</p><h1>A little less paperwork.<br /><span className="login-highlight">A lot more possibility.</span></h1><p>One place for hostel leave and academic outpasses. Sign in with your college account to get started.</p></div><p className="footnote">Smart Leave Management System · AIT</p></aside>
    <section className="panel" aria-labelledby="login-title"><div className="card">
      <p className="eyebrow">WELCOME BACK</p><h2 id="login-title">Sign in to Smart Leave</h2><p className="muted">Use your college email and password.</p>
      <nav className="roles" aria-label="Sign-in role"><NavLink to="/login/student">Student</NavLink><NavLink to="/login/faculty">Faculty</NavLink></nav>
      <form onSubmit={signIn} aria-busy={busy}>
        <label htmlFor="email">College email address</label>
        <input id="email" type="email" autoComplete="username" placeholder={template} value={email} onBlur={() => setTouched(true)} onChange={(event) => setEmail(event.target.value)} aria-invalid={touched && !validEmail} aria-describedby="email-help" required />
        <p id="email-help" className={touched && !validEmail ? 'error' : 'hint'}>{touched && !validEmail ? emailError : `Use ${template}, your college account email.`}</p>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={200} required />
        {error && <p role="alert" className="error">{error}</p>}
        <button disabled={busy || !domain} type="submit">{busy ? 'Signing in…' : 'Sign in →'}</button>
      </form><p className="security">Protected access · For authorized college members</p>
    </div></section>
  </main>
}

function Dashboard() {
  const { role } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function checkSession() {
      try {
        const data = await api('/auth/session')
        if (!active) return
        if (data.user.role !== role) {
          navigate(`/${data.user.role}/dashboard`, { replace: true })
          return
        }
        await api(`/${role}/dashboard`)
        if (active) { setUser(data.user); setError('') }
      } catch (sessionError) {
        if (active) {
          if (sessionError.status === 401) navigate(`/login/${role}`, { replace: true })
          else setError(sessionError.message)
        }
      }
    }
    void checkSession()
    const timer = setInterval(checkSession, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [role, navigate])

  useEffect(() => {
    let lastActivitySent = 0
    const reportActivity = () => {
      const now = Date.now()
      if (now - lastActivitySent < 60000) return
      lastActivitySent = now
      void api('/auth/activity', {}).catch((activityError) => {
        if (activityError.status === 401) navigate(`/login/${role}`, { replace: true })
      })
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach((eventName) => window.addEventListener(eventName, reportActivity, { passive: true }))
    return () => events.forEach((eventName) => window.removeEventListener(eventName, reportActivity))
  }, [role, navigate])

  async function signOut() {
    try {
      await api('/auth/logout', {})
      navigate(`/login/${role}`, { replace: true })
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  if (user?.role === 'student') return <StudentDashboard user={user} onSignOut={signOut} />
  if (user?.role === 'faculty' && user.approvalRole) return <FacultyDashboard user={user} onSignOut={signOut} />
  return <main className="dashboard"><p className="eyebrow">SMART LEAVE / {role}</p><h1>{user ? `Welcome, ${user.name}` : 'Checking your session…'}</h1><p>{user?.email}</p><p>Your {role} dashboard will live here.</p>{error && <p role="alert" className="error">{error}</p>}<button onClick={signOut}>Sign out</button></main>
}

function AuthenticatedApp() {
  const [domain, setDomain] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api('/auth/config').then((data) => setDomain(data.domain)).catch(() => setError('Unable to connect. Check the server and reload this page.'))
  }, [])
  if (error) return <p role="alert">{error}</p>
  if (!domain) return <p role="status">Connecting to Smart Leave…</p>
  return <BrowserRouter><Routes><Route path="/login/:role" element={<RoleLogin domain={domain} />} /><Route path="/:role/dashboard" element={<Dashboard />} /><Route path="*" element={<Navigate to="/login/student" replace />} /></Routes></BrowserRouter>
}

function App() {
  const pathname = window.location.pathname
  return pathname === '/' || pathname.startsWith('/portal/') ? <DemoPortal /> : <AuthenticatedApp />
}

function RoleLogin({ domain }) {
  const { role } = useParams()
  return <Login key={role} domain={domain} />
}

export default App
