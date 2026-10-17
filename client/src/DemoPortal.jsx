import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom'
import './DemoPortal.css'
import './Home.css'

const storageKey = 'smart-leave-demo-requests'
const stages = [['warden', 'Warden'], ['counsellor', 'Counsellor'], ['hod', 'HOD'], ['joint_director', 'Joint Director']]
const stageName = role => stages.find(([key]) => key === role)?.[1] || role
const actionName = action => ({ submitted: 'Request submitted', approved: 'Approved', rejected: 'Rejected', needs_information: 'Contact requested' }[action] || action)
const date = value => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const demoId = () => `DEMO-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const createDemoEvent = (action, role, note = '') => ({
  action, role, actorName: role ? `Demo ${stageName(role)}` : 'Demo Student',
  actorEmail: role ? `${role}@demo.local` : 'student@demo.local',
  note, signature: demoId(), createdAt: new Date().toISOString(),
})
const initialRequests = () => [{
  _id: 'demo-request-1', token: 'AIT-DEMO-2026-001', studentEmail: 'student@demo.local',
  studentName: 'Demo Student', leaveType: 'Hostel leave',
  startDate: new Date(Date.now() + 86400000).toISOString(),
  endDate: new Date(Date.now() + 3 * 86400000).toISOString(),
  destination: 'Pune', reason: 'Family visit', status: 'pending', currentStage: 'warden',
  timeline: [createDemoEvent('submitted', null, 'Demo request for exploring the portal')],
}]

function Home() {
  return <div className="home">
    <header className="home-nav"><Link className="brand" to="/">SL <span>SMART LEAVE</span></Link><nav aria-label="Portal navigation"><a href="/login/student">Student sign in</a><a href="/login/faculty">Faculty sign in</a></nav></header>
    <main className="home-hero"><p className="eyebrow">ARMY INSTITUTE OF TECHNOLOGY · PUNE</p><h1>Leave, without the paperwork.</h1><p>One clear process for student leave requests, approvals and updates.</p><div className="hero-actions"><a className="button-link" href="/login/student">Student sign in <span aria-hidden="true">→</span></a><a className="secondary-link" href="/login/faculty">Faculty sign in</a></div><p className="hero-caption">One request. Four approvals. Every update in one place.</p></main>
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

function DemoNotice() {
  return <aside className="demo-notice" role="note"><strong>Demo portal</strong><span>Actions are saved only in this browser. No sign-in, real identity checks, or official approvals.</span></aside>
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

function TimelineLog({ event }) {
  return <li className="timeline-event">
    <span className={`event-mark ${event.action}`}></span><div><strong>{actionName(event.action)}{event.role ? ` · ${stageName(event.role)}` : ''}</strong><span>{event.actorName} · {date(event.createdAt)}</span>{event.note && <p>{event.note}</p>}<small>Demo audit record · {event.signature}</small></div>
  </li>
}

function RequestCard({ request, faculty, onRespond, onCertificate }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function respond(action) {
    setBusy(true); setError('')
    try { onRespond(request, action, note); setNote('') }
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
      <p className="eyebrow">ARMY INSTITUTE OF TECHNOLOGY · PUNE</p><h1>Leave Approval</h1><p className="certificate-subtitle">Demo portal record — not an official approval</p>
      <div className="certificate-token"><span>REQUEST TOKEN</span><strong>{request.token}</strong></div>
      <dl><dt>Student</dt><dd>{request.studentName} ({request.studentEmail})</dd><dt>Leave type</dt><dd>{request.leaveType}</dd><dt>Dates</dt><dd>{date(request.startDate)} – {date(request.endDate)}</dd><dt>Destination</dt><dd>{request.destination}</dd><dt>Reason</dt><dd>{request.reason}</dd></dl>
      <h2>Approval history</h2><div className="signature-grid">{request.timeline.filter(event => event.action === 'approved').map(event => <div className="signature-stamp" key={event.signature}><strong>{stageName(event.role)}</strong><span>{event.actorName}</span><span>{date(event.createdAt)}</span><small>Demo record · {event.signature}</small></div>)}</div>
      <p className="certificate-note">This is a local demo record. It does not represent an authorized or digitally certified leave approval.</p>
    </article>
  </main>
}

function PortalHeader({ section, role, onRoleChange }) {
  return <header className="portal-header"><Link className="brand" to="/">SL <span>SMART LEAVE</span></Link><nav aria-label="Portal navigation"><a href="/login/student">Student sign in</a><NavLink to="/portal/faculty">Faculty demo</NavLink><a href={`/login/${section}`}>Open authenticated portal</a>{section === 'faculty' && <label className="stage-selector">Review as <select value={role} onChange={event => onRoleChange(event.target.value)}>{stages.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>}<Link className="home-link" to="/">Home</Link></nav></header>
}

function FacultyPortal({ requests, setRequests }) {
  const [tab, setTab] = useState('pending')
  const [role, setRole] = useState('warden')
  const [certificate, setCertificate] = useState(null)
  const logs = requests.flatMap(request => request.timeline.filter(event => event.role === role).map(event => ({ ...event, token: request.token }))).reverse()
  const items = tab === 'logs'
    ? logs
    : tab === 'approved'
      ? requests.filter(request => request.timeline.some(event => event.role === role && event.action === 'approved'))
      : requests.filter(request => request.status === 'pending' && request.currentStage === role)
  function respond(request, action, note) {
    if (action !== 'approved' && !note.trim()) throw new Error('Add a short note for this response.')
    const event = createDemoEvent(action, role, note.trim())
    const updated = requests.map(item => {
      if (item._id !== request._id) return item
      const timeline = [...item.timeline, event]
      if (action === 'rejected') return { ...item, status: 'rejected', currentStage: null, timeline }
      if (action === 'needs_information') return { ...item, timeline }
      const nextRole = stages[stages.findIndex(([key]) => key === role) + 1]?.[0] || null
      return { ...item, status: nextRole ? 'pending' : 'approved', currentStage: nextRole, timeline }
    })
    setRequests(updated)
  }
  if (certificate) return <Certificate request={certificate} onBack={() => setCertificate(null)} />
  return <main className="portal">
    <PortalHeader section="faculty" role={role} onRoleChange={setRole} />
    <section className="portal-content"><DemoNotice /><div className="page-heading"><div><p className="eyebrow">FACULTY MANAGEMENT</p><h1>{stageName(role)} portal</h1><p className="muted">Review demo tokens assigned to this approval stage.</p></div><span className="stage-pill">{stageName(role)}</span></div>
      <nav className="portal-tabs" aria-label="Faculty request views"><button className={tab === 'pending' ? 'selected' : ''} onClick={() => setTab('pending')}>Pending requests</button><button className={tab === 'approved' ? 'selected' : ''} onClick={() => setTab('approved')}>Approved requests</button><button className={tab === 'logs' ? 'selected' : ''} onClick={() => setTab('logs')}>Logs</button></nav>
      <div className="list-heading"><h2>{tab === 'logs' ? 'Response log' : `${tab === 'pending' ? 'Pending' : 'Approved'} requests`} <span className="count">{items.length}</span></h2></div>
      {items.length === 0 ? <div className="empty-state"><strong>{tab === 'pending' ? 'You’re all caught up.' : 'Nothing here yet.'}</strong><p>{tab === 'pending' ? 'New demo tokens will appear when they reach this approval stage.' : 'Responses for this stage will appear here.'}</p></div> : tab === 'logs' ? <ol className="log-feed">{items.map((event, index) => <li className="timeline-event" key={`${event.signature}-${index}`}><span className={`event-mark ${event.action}`}></span><div><strong>{actionName(event.action)} · {stageName(event.role)}</strong><span>{event.actorName} · {date(event.createdAt)}</span>{event.note && <p>{event.note}</p>}<small>Demo audit record · {event.signature}</small><strong>{event.token}</strong></div></li>)}</ol> : <div className="request-list">{items.map(request => <RequestCard key={request._id} request={request} faculty={tab === 'pending'} onRespond={respond} onCertificate={setCertificate} />)}</div>}
    </section>
  </main>
}

function Portal() {
  const [requests, setRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === null ? initialRequests() : JSON.parse(saved)
    } catch (error) {
      console.error('Unable to load local demo requests.', error)
      return initialRequests()
    }
  })
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(requests)) }
    catch (error) { console.error('Unable to save local demo requests.', error) }
  }, [requests])
  return <FacultyPortal requests={requests} setRequests={setRequests} />
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/portal/:section" element={<PortalRoute />} />
    <Route path="/:role/dashboard" element={<LegacyPortalRoute />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter>
}

function StudentSignInRedirect() {
  useEffect(() => { window.location.replace('/login/student') }, [])
  return <p role="status">Opening student sign in…</p>
}

function PortalRoute() {
  const { section } = useParams()
  if (section === 'student') return <StudentSignInRedirect />
  if (section !== 'faculty') return <Navigate to="/" replace />
  return <Portal key={section} section={section} />
}

function LegacyPortalRoute() {
  const { role } = useParams()
  return <Navigate to={role === 'faculty' ? '/portal/faculty' : '/login/student'} replace />
}

export default App
