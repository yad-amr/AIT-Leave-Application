import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import './App.css'

async function api(path, body) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed. Please try again.'), { status: response.status, ...data })
  return data
}

const stages = [
  ['warden', 'Warden'],
  ['counsellor', 'Counsellor'],
  ['hod', 'HOD'],
  ['joint_director', 'Joint Director'],
]
const stageName = role => stages.find(([key]) => key === role)?.[1] || role
const actionName = action => ({ submitted: 'Request submitted', approved: 'Approved', rejected: 'Rejected', needs_information: 'Contact requested' }[action] || action)
const date = value => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function Home() {
  return <div className="home">
    <header className="home-nav"><Link className="brand" to="/">SL <span>SMART LEAVE</span></Link><nav aria-label="Sign in"><Link to="/login/student">Student sign in</Link><Link className="button-link" to="/login/faculty">Faculty sign in</Link></nav></header>
    <main className="home-hero"><p className="eyebrow">ARMY INSTITUTE OF TECHNOLOGY · PUNE</p><h1>Leave, without the paperwork.</h1><p>One clear process for student leave requests, approvals and updates.</p><div className="hero-actions"><Link className="button-link" to="/login/student">Request leave <span aria-hidden="true">→</span></Link><Link className="secondary-link" to="/login/faculty">Faculty portal</Link></div><p className="hero-caption">One request. Four approvals. Every update in one place.</p></main>
    <footer className="site-footer">
      <div className="footer-main">
        <section><h2>Contact Us</h2><a href="https://www.aitpune.com/Contact-Us.aspx">For an Enquiry</a><p>Dighi Hills, Pune-411015<br /><a href="tel:8956018951">8956018951/ 52/ 53/ 54</a><br /><a href="mailto:ait@aitpune.edu.in">ait[at]aitpune[dot]edu[dot]in</a></p><h3>Follow Us</h3><div className="social-links"><a href="https://www.aitpune.com/">AIT Pune</a><a href="https://www.aitpune.com/clubs.aspx">Campus clubs</a></div></section>
        <section><h3>Departments</h3><ul>
          <li><a href="https://www.aitpune.com/Electronics-and-Telecommunication.aspx">E &amp; TC</a></li>
          <li><a href="https://www.aitpune.com/Computer-Engg.aspx">Computer Engg</a></li>
          <li><a href="https://www.aitpune.com/Information-Technology.aspx">Information Technology</a></li>
          <li><a href="https://www.aitpune.com/Mechanical-Engg.aspx">Mechanical Engg</a></li>
          <li><a href="https://www.aitpune.com/Automation-Robotics-Engg.aspx">Automation &amp; Robotics Engg</a></li>
        </ul></section>
        <section><h3>Useful Links</h3><ul>
          <li><a href="https://www.youth4work.com/onlinetalenttest">Skill Test For Students</a></li>
          <li><a href="https://alumni.aitpune.edu.in/">AIT Alumni</a></li>
          <li><a href="https://www.unipune.ac.in/">SPPU</a></li>
          <li><a href="https://www.awesindia.com/">AWES</a></li>
          <li><a href="https://www.aicte-india.org/">AICTE</a></li>
          <li><a href="https://www.vlab.co.in/">Virtual Labs</a></li>
          <li><a href="https://www.aitpune.com/clubs.aspx">Clubs</a></li>
        </ul></section>
        <a className="movie-link" href="https://www.aitpune.com/images/slider/Bird-View-AIT.jpg"><img src="https://www.aitpune.com/images/slider/Bird-View-AIT.jpg" alt="Bird's-eye view of Army Institute of Technology" /><strong>AIT Movie - Bird's Eye View</strong></a>
      </div>
      <div className="copyright"><span>Copyright ©2025 All Rights Reserved | Army Institute of Technology, Pune</span><span>Site Updated On :01 Mar 2026</span></div>
    </footer>
  </div>
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
  const localPattern = role === 'student' ? /^[a-z][a-z.-]*_\d{6}$/i : /^[a-z][a-z._-]*$/i
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
    <aside className="intro"><Link className="brand" to="/">SL <span>SMART LEAVE</span></Link><div><p className="eyebrow">YOUR CAMPUS. CONNECTED.</p><h1>A little less paperwork.<br />A lot more possibility.</h1><p>One place for hostel leave and academic outpasses. Sign in with your college email to get started.</p></div><p className="footnote">Smart Leave Management System · AIT</p></aside>
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

function ApprovalTimeline({ request }) {
  return <div className="approval-track" aria-label="Approval progress">
    {stages.map(([role, label]) => {
      const decision = request.timeline.find(event => event.role === role && ['approved', 'rejected'].includes(event.action))
      const current = request.currentStage === role
      return <div className={`approval-step ${decision?.action || (current ? 'current' : '')}`} key={role}>
        <span className="step-dot">{decision?.action === 'approved' ? '✓' : decision?.action === 'rejected' ? '×' : current ? '•' : '·'}</span>
        <span>{label}</span>
        {decision && <small>{actionName(decision.action)}</small>}
        {!decision && current && <small>Awaiting review</small>}
      </div>
    })}
  </div>
}

function TimelineLog({ request, event }) {
  return <li className="timeline-event">
    <span className={`event-mark ${event.action}`}></span><div><strong>{actionName(event.action)}{event.role ? ` · ${stageName(event.role)}` : ''}</strong><span>{event.actorName} · {date(event.createdAt)}</span>{event.note && <p>{event.note}</p>}<small title={event.signature}>Authenticated digital signature · {event.signature.slice(0, 16)}…</small>{request && <Link to={`/student/dashboard?token=${encodeURIComponent(request.token)}`}>{request.token}</Link>}</div>
  </li>
}

function RequestCard({ request, faculty, onRespond, onCertificate }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function respond(action) {
    setBusy(true); setError('')
    try { await onRespond(request, action, note); setNote('') }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <article className="request-card">
    <div className="request-card-top"><div><span className="token-label">TOKEN</span><h3>{request.token}</h3></div><span className={`status status-${request.status}`}>{request.status === 'approved' ? 'Approved' : request.status === 'rejected' ? 'Rejected' : `Pending · ${stageName(request.currentStage)}`}</span></div>
    <div className="request-meta"><span>{request.studentName}</span><span>{request.leaveType}</span><span>{date(request.startDate)} – {date(request.endDate)}</span></div>
    <p><strong>Destination</strong><br />{request.destination}</p><p><strong>Reason</strong><br />{request.reason}</p>
    <ApprovalTimeline request={request} />
    {faculty && request.status === 'pending' && <div className="response-form">
      <label htmlFor={`note-${request._id}`}>Response note <span className="muted">(required for reject or contact)</span></label><textarea id={`note-${request._id}`} value={note} maxLength={1000} onChange={event => setNote(event.target.value)} placeholder="Add context for the student…" />
      <div className="response-actions"><button className="button-quiet" type="button" disabled={busy} onClick={() => respond('needs_information')}>Not satisfied — get contacted ASAP</button><button className="button-danger" type="button" disabled={busy || !note.trim()} onClick={() => respond('rejected')}>Reject</button><button type="button" disabled={busy} onClick={() => respond('approved')}>Approve</button></div>{error && <p className="error" role="alert">{error}</p>}
    </div>}
    {request.status === 'approved' && <button className="certificate-button no-print" type="button" onClick={() => onCertificate(request)}>View / print approval</button>}
    <details className="request-history"><summary>Response history ({request.timeline.length})</summary><ol className="timeline-list">{request.timeline.map((event, index) => <TimelineLog event={event} key={`${event.signature}-${index}`} />)}</ol></details>
  </article>
}

function Certificate({ request, onBack }) {
  return <main className="certificate-wrap">
    <div className="certificate-controls no-print"><button className="button-quiet" onClick={onBack}>← Back to portal</button><button onClick={() => window.print()}>Print / Save as PDF</button></div>
    <article className="certificate">
      <p className="eyebrow">ARMY INSTITUTE OF TECHNOLOGY · PUNE</p><h1>Leave Approval</h1><p className="certificate-subtitle">Digitally signed approval record</p>
      <div className="certificate-token"><span>REQUEST TOKEN</span><strong>{request.token}</strong></div>
      <dl><dt>Student</dt><dd>{request.studentName} ({request.studentEmail})</dd><dt>Leave type</dt><dd>{request.leaveType}</dd><dt>Dates</dt><dd>{date(request.startDate)} – {date(request.endDate)}</dd><dt>Destination</dt><dd>{request.destination}</dd><dt>Reason</dt><dd>{request.reason}</dd></dl>
      <h2>Approval signatures</h2><div className="signature-grid">{request.timeline.filter(event => event.action === 'approved').map(event => <div className="signature-stamp" key={event.signature}><strong>{stageName(event.role)}</strong><span>{event.actorName}</span><span>{date(event.createdAt)}</span><small>Authenticated · {event.signature.slice(0, 20)}…</small></div>)}</div>
      <p className="certificate-note">This certificate records the approval decisions linked to the request token shown above.</p>
    </article>
  </main>
}

function PortalHeader({ user, section, onSignOut }) {
  return <header className="portal-header"><Link className="brand" to="/">SL <span>SMART LEAVE</span></Link><nav aria-label="Portal navigation">{section === 'faculty' ? <span className="staff-role">{stageName(user.approvalRole)} portal</span> : <span>Student portal</span>}<button className="text-button" onClick={onSignOut}>Sign out</button></nav></header>
}

function FacultyPortal({ user, onSignOut }) {
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [certificate, setCertificate] = useState(null)
  async function load(activeTab = tab) {
    setLoading(true); setError('')
    try {
      const data = await api(activeTab === 'logs' ? '/faculty/logs' : `/faculty/requests${activeTab === 'approved' ? '?view=approved' : ''}`)
      setItems(data.requests || data.logs)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    api(tab === 'logs' ? '/faculty/logs' : `/faculty/requests${tab === 'approved' ? '?view=approved' : ''}`)
      .then(data => {
        const rows = data.requests || data.logs
        if (!Array.isArray(rows)) throw new Error('The server returned an invalid request list.')
        if (active) { setItems(rows); setError('') }
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tab])
  function selectTab(value) { setLoading(true); setTab(value) }
  async function respond(request, action, note) {
    const result = await api(`/faculty/requests/${encodeURIComponent(request._id)}/respond`, { action, note })
    if (action === 'needs_information') await load(tab)
    else {
      setItems(current => current.filter(item => item._id !== request._id))
      if (action === 'approved' && !result.request.currentStage) await load(tab)
    }
  }
  if (certificate) return <Certificate request={certificate} onBack={() => setCertificate(null)} />
  return <main className="portal">
    <PortalHeader user={user} section="faculty" onSignOut={onSignOut} />
    <section className="portal-content"><div className="page-heading"><div><p className="eyebrow">FACULTY MANAGEMENT</p><h1>Welcome, {user.name}</h1><p className="muted">Review tokenized requests assigned to your approval stage.</p></div><span className="stage-pill">{stageName(user.approvalRole)}</span></div>
      <nav className="portal-tabs" aria-label="Faculty request views"><button className={tab === 'pending' ? 'selected' : ''} onClick={() => selectTab('pending')}>Pending requests</button><button className={tab === 'approved' ? 'selected' : ''} onClick={() => selectTab('approved')}>Approved requests</button><button className={tab === 'logs' ? 'selected' : ''} onClick={() => selectTab('logs')}>Logs</button></nav>
      <div className="list-heading"><h2>{tab === 'logs' ? 'Your response log' : `${tab === 'pending' ? 'Pending' : 'Approved'} requests`}</h2><button className="button-quiet" onClick={() => load(tab)}>Refresh</button></div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p role="status" className="empty-state">Loading requests…</p> : items.length === 0 ? <div className="empty-state"><strong>{tab === 'pending' ? 'You’re all caught up.' : 'Nothing here yet.'}</strong><p>{tab === 'pending' ? 'New tokens will appear when they reach your approval stage.' : 'Your completed responses will appear here.'}</p></div> : tab === 'logs' ? <ol className="log-feed">{items.map((event, index) => <TimelineLog event={event} key={`${event.signature}-${index}`} />)}</ol> : <div className="request-list">{items.map(request => <RequestCard key={request._id} request={request} faculty={tab === 'pending'} onRespond={respond} onCertificate={setCertificate} />)}</div>}
    </section>
  </main>
}

const emptyRequest = { leaveType: 'Hostel leave', startDate: '', endDate: '', destination: '', reason: '' }
function StudentPortal({ user, onSignOut }) {
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState(emptyRequest)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [certificate, setCertificate] = useState(null)
  async function load() {
    try { const data = await api('/student/requests'); setRequests(data.requests); setError('') }
    catch (err) { setError(err.message) }
  }
  useEffect(() => {
    let active = true
    api('/student/requests')
      .then(data => {
        if (!Array.isArray(data.requests)) throw new Error('The server returned an invalid request list.')
        if (active) setRequests(data.requests)
      })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await api('/student/requests', form)
      setForm(emptyRequest); setShowForm(false); await load()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  if (certificate) return <Certificate request={certificate} onBack={() => setCertificate(null)} />
  return <main className="portal">
    <PortalHeader user={user} section="student" onSignOut={onSignOut} />
    <section className="portal-content"><div className="page-heading"><div><p className="eyebrow">STUDENT PORTAL</p><h1>Welcome, {user.name}</h1><p className="muted">Every application gets a token you can use to follow its approval.</p></div><button onClick={() => setShowForm(value => !value)}>{showForm ? 'Close form' : 'New leave request +'}</button></div>
      {showForm && <form className="leave-form" onSubmit={submit}><h2>Request leave</h2><div className="form-grid"><div><label htmlFor="leaveType">Request type</label><select id="leaveType" value={form.leaveType} onChange={event => setForm({ ...form, leaveType: event.target.value })}><option>Hostel leave</option><option>Academic outpass</option></select></div><div><label htmlFor="destination">Destination</label><input id="destination" required maxLength={160} value={form.destination} onChange={event => setForm({ ...form, destination: event.target.value })} /></div><div><label htmlFor="startDate">From</label><input id="startDate" type="date" required value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></div><div><label htmlFor="endDate">To</label><input id="endDate" type="date" required min={form.startDate} value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} /></div></div><label htmlFor="reason">Reason for leave</label><textarea id="reason" required maxLength={2000} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /><button disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button></form>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="list-heading"><h2>Your requests <span className="count">{requests.length}</span></h2><button className="button-quiet" onClick={() => load()}>Refresh</button></div>
      {requests.length === 0 ? <div className="empty-state"><strong>No leave tokens yet.</strong><p>Start a request to track all four approval stages here.</p></div> : <div className="request-list">{requests.map(request => <RequestCard key={request._id} request={request} onCertificate={setCertificate} />)}</div>}
    </section>
  </main>
}

function Dashboard() {
  const { role } = useParams()
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
  async function signOut() {
    try { await api('/auth/logout', {}); navigate(`/login/${role}`, { replace: true }) }
    catch (err) { setError(err.message) }
  }
  if (error) return <main className="portal-content"><p role="alert" className="error">{error}</p></main>
  if (!user) return <p role="status" className="empty-state">Checking your session…</p>
  return role === 'faculty' ? <FacultyPortal user={user} onSignOut={signOut} /> : <StudentPortal user={user} onSignOut={signOut} />
}

function App() {
  const [domain, setDomain] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { api('/auth/config').then(data => setDomain(data.domain)).catch(() => setError('Unable to connect. Check the server and reload this page.')) }, [])
  if (error) return <p role="alert">{error}</p>
  if (!domain) return <p role="status">Connecting to Smart Leave…</p>
  return <BrowserRouter><Routes><Route path="/" element={<Home />} /><Route path="/login/:role" element={<RoleLogin domain={domain} />} /><Route path="/:role/dashboard" element={<Dashboard />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>
}
function RoleLogin({ domain }) { const { role } = useParams(); return <Login key={role} domain={domain} /> }
export default App
