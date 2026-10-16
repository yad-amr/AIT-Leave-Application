import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import './App.css'
import Student from './Student'

async function api(path, body) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed. Please try again.'), { status: response.status, ...data })
  return data
}
function Login({ domain }) {
  const { role } = useParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [challenge, setChallenge] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const inputs = useRef([])
  const pending = useRef(false)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const template = role === 'student' ? `name_123456@${domain}` : `name@${domain}`
  const emailError = role === 'student' ? `Use ${template} with a six-digit registration number.` : `Use ${template} for faculty sign-in.`
  const localPattern = role === 'student' ? /^[a-z][a-z.-]*_\d{6}$/i : /^[a-z][a-z.-]*$/i
  const parts = email.trim().toLowerCase().split('@')
  const validEmail = parts.length === 2 && parts[1] === domain && localPattern.test(parts[0])
  if (!['student', 'faculty'].includes(role)) return <Navigate to="/login/student" replace />
  const cooldown = Math.max(0, Math.ceil(((challenge?.resendAt || 0) - now) / 1000))
  const remaining = Math.max(0, Math.ceil(((challenge?.expiresAt || 0) - now) / 1000))
  async function send(event) {
    event.preventDefault()
    setTouched(true)
    if (!validEmail || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const data = await api('/auth/request-otp', { email, role })
      setChallenge(data); setDigits(Array(6).fill('')); setNow(Date.now())
      setTimeout(() => inputs.current[0]?.focus(), 0)
    } catch (err) { setError(err.message) }
    finally { pending.current = false; setBusy(false) }
  }
  async function verify(code) {
    if (pending.current || code.length !== 6) return
    pending.current = true; setBusy(true); setError('')
    try { await api('/auth/verify-otp', { email, role, otp: code }); navigate(`/${role}/dashboard`, { replace: true }) }
    catch (err) {
      setError(err.message)
      if (err.attemptsLeft !== undefined) setChallenge(value => ({ ...value, attemptsLeft: err.attemptsLeft }))
      setDigits(Array(6).fill('')); inputs.current[0]?.focus()
    } finally { pending.current = false; setBusy(false) }
  }
  function change(index, value) {
    if (!/^\d*$/.test(value)) return
    const next = [...digits]; next[index] = value.slice(-1); setDigits(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
    if (next.every(Boolean)) void verify(next.join(''))
  }
  const blocked = busy || !remaining || challenge?.attemptsLeft === 0
  return <main className="shell">
    <aside className="intro"><a className="brand" href="/">SL <span>SMART LEAVE</span></a><div><p className="eyebrow">YOUR CAMPUS. CONNECTED.</p><h1>A little less paperwork.<br />A lot more possibility.</h1><p>One place for hostel leave and academic outpasses. Sign in with your college email to get started.</p></div><p className="footnote">Smart Leave Management System · AIT</p></aside>
    <section className="panel" aria-labelledby="login-title"><div className="card">
      <p className="eyebrow">WELCOME BACK</p><h2 id="login-title">Sign in to Smart Leave</h2><p className="muted">Your college inbox is your key. No password needed.</p>
      <nav className="roles" aria-label="Sign-in role"><NavLink to="/login/student">Student</NavLink><NavLink to="/login/faculty">Faculty</NavLink></nav>
      <form onSubmit={send} aria-busy={busy}>
        <label htmlFor="email">College email address</label>
        <input id="email" type="email" autoComplete="email" placeholder={template} value={email} readOnly={!!challenge} onBlur={() => setTouched(true)} onChange={e => setEmail(e.target.value)} aria-invalid={touched && !validEmail} aria-describedby="email-help" required />
        <p id="email-help" className={touched && !validEmail ? 'error' : 'hint'}>{touched && !validEmail ? emailError : `Use ${template}, your official Microsoft 365 email.`}</p>
        {!challenge && <button disabled={busy || !domain} type="submit">{busy ? 'Sending code…' : 'Send OTP →'}</button>}
        {challenge && <>
          <div className="otp-heading"><label id="otp-label">Enter your verification code</label><button className="text-button" type="button" disabled={busy} onClick={() => { setChallenge(null); setDigits(Array(6).fill('')); setError('') }}>Change email</button></div>
          <p className="hint">If eligible, a code has been sent to your college inbox.</p>
          <div className="digits" role="group" aria-labelledby="otp-label" onPaste={event => {
            event.preventDefault(); if (blocked) return
            const code = event.clipboardData.getData('text').trim()
            if (/^\d{6}$/.test(code)) { setDigits(code.split('')); inputs.current[5]?.focus(); void verify(code) }
          }}>
            {digits.map((digit, index) => <input key={index} ref={element => { inputs.current[index] = element }} aria-label={`Code digit ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} value={digit} disabled={blocked} onChange={e => change(index, e.target.value)} onKeyDown={e => {
              if (e.key === 'Backspace' && !digit && index) inputs.current[index - 1]?.focus()
              if (e.key === 'ArrowLeft' && index) inputs.current[index - 1]?.focus()
              if (e.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus()
            }} />)}
          </div>
          <p className="hint">{remaining ? `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'Code expired. Request a new code.'} · {challenge.attemptsLeft} attempts left</p>
          <button type="button" disabled={blocked || digits.some(d => !d)} onClick={() => verify(digits.join(''))}>{busy ? 'Please wait…' : 'Verify & sign in →'}</button>
          <button className="text-button resend" type="submit" disabled={busy || cooldown > 0}>{cooldown ? `Resend code in ${cooldown}s` : 'Resend code'}</button>
        </>}
        {error && <p role="alert" className="error">{error}</p>}
      </form><p className="security">Protected access · For authorized college members</p>
    </div></section>
  </main>
}
function Dashboard({ student = false }) {
  const params = useParams()
  const role = student ? 'student' : params.role
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function check() {
      try {
        const data = await api('/auth/session')
        if (!active) return
        if (data.user.role !== role) { navigate(`/${data.user.role}/dashboard`, { replace: true }); return }
        await api(`/${role}/dashboard`)
        if (active) { setUser(data.user); setError('') }
      } catch (err) { if (active) { if (err.status === 401) navigate(`/login/${role}`, { replace: true }); else setError(err.message) } }
    }
    void check()
    const timer = setInterval(check, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [role, navigate])
  if (user && role === 'student') return <Student user={user} />
  return <main className="dashboard"><p className="eyebrow">SMART LEAVE / {role}</p><h1>{user ? `Welcome, ${user.name}` : 'Checking your session…'}</h1><p>{user?.email}</p><p>Your {role} dashboard will live here.</p>{error && <p role="alert" className="error">{error}</p>}<button onClick={async () => { try { await api('/auth/logout', {}); navigate(`/login/${role}`, { replace: true }) } catch (err) { setError(err.message) } }}>Sign out</button></main>
}
function App() {
  const [domain, setDomain] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { api('/auth/config').then(data => setDomain(data.domain)).catch(() => setError('Unable to connect. Check the server and reload this page.')) }, [])
  if (error) return <p role="alert">{error}</p>
  if (!domain) return <p role="status">Connecting to Smart Leave…</p>
  return <BrowserRouter><Routes><Route path="/login/:role" element={<RoleLogin domain={domain} />} /><Route path="/student/*" element={<StudentGuard />} /><Route path="/:role/dashboard" element={<Dashboard />} /><Route path="*" element={<Navigate to="/login/student" replace />} /></Routes></BrowserRouter>
}
function StudentGuard() { return <Dashboard student /> }
function RoleLogin({ domain }) { const { role } = useParams(); return <Login key={role} domain={domain} /> }
export default App
