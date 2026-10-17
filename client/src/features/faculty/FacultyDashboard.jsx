import { useCallback, useEffect, useMemo, useState } from 'react'
import PasswordChangeModal from '../common/PasswordChangeModal.jsx'
import './FacultyDashboard.css'
import './FacultyDashboardExtras.css'

const stageLabels = { warden: 'Warden', counsellor: 'Counsellor', hod: 'HOD', joint_director: 'Joint Director' }

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value))
}

function deadlineLabel(value, now) {
  if (!value) return 'Deadline: 5 days from submission'
  const remaining = new Date(value).getTime() - now
  if (remaining <= 0) return 'Deadline passed · request expiring'
  const hours = Math.ceil(remaining / 3600000)
  return hours < 24 ? `Respond within ${hours}h` : `Respond by ${formatDate(value)}`
}

export default function FacultyDashboard({ user, onSignOut }) {
  const [requests, setRequests] = useState([])
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [clock, setClock] = useState(() => new Date().getTime())
  const [view, setView] = useState('queue')
  const [history, setHistory] = useState([])
  const role = user?.approvalRole

  const loadQueue = useCallback(async () => {
    const response = await fetch('/api/faculty/approvals', { credentials: 'same-origin' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Could not load assigned requests.')
    return data
  }, [])

  useEffect(() => {
    let active = true
    loadQueue().then((data) => {
        if (active) setRequests(data.requests || [])
      })
      .catch((error) => { if (active) setNotice(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [loadQueue])

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().getTime()), 60000)
    return () => clearInterval(timer)
  }, [])

  async function refreshQueue() {
    setRefreshing(true)
    try {
      const data = await loadQueue()
      setRequests(data.requests || [])
      setNotice('Queue refreshed.')
    } catch (error) { setNotice(error.message) }
    finally { setRefreshing(false) }
  }

  async function loadHistory() {
    try {
      const response = await fetch('/api/faculty/approvals/history', { credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not load your decision history.')
      setHistory(data.requests || [])
    } catch (error) { setNotice(error.message) }
  }

  const visibleRequests = useMemo(() => requests.filter((request) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [request.studentName, request.studentEmail, request.reference, request.reason].some((value) => String(value || '').toLowerCase().includes(query))
    return matchesSearch && (priorityFilter === 'all' || (request.priority || 'normal') === priorityFilter)
  }), [requests, search, priorityFilter])
  const urgentCount = requests.filter((request) => request.priority === 'urgent').length
  const expiringCount = requests.filter((request) => request.expiresAt && new Date(request.expiresAt).getTime() - clock <= 24 * 3600000).length

  async function decide(request, decision) {
    const comment = (comments[request.id] || '').trim()
    if (decision !== 'approved' && comment.length < 3) {
      setNotice('Add a short note so the student knows what to correct or provide.')
      return
    }
    setBusyId(request.id)
    setNotice('')
    try {
      const response = await fetch(`/api/faculty/approvals/${request.id}/decision`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not save your decision.')
      setRequests((current) => current.filter((item) => item.id !== request.id))
      setNotice(decision === 'approved' ? 'Approval saved. The request has moved to the next reviewer.' : decision === 'rejected' ? 'Request rejected with your explanation for the student.' : 'More information requested. The student can now reply.')
      if (view === 'history') await loadHistory()
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusyId('')
    }
  }

  return <main className="faculty-portal">
    <header className="faculty-header"><div><span className="faculty-brand">CAMPUS LEAVE</span><h1>{stageLabels[role] || 'Faculty'} approvals</h1><p>Signed in as {user?.name} · {user?.email}</p></div><div className="faculty-header-actions"><button type="button" onClick={() => setShowPasswordChange(true)}>Change password</button><button type="button" onClick={onSignOut}>Sign out</button></div></header>
    {notice && <p className="faculty-notice" role="status">{notice}</p>}
    <section className="faculty-queue"><div className="faculty-queue-heading"><div><span>YOUR WORK</span><h2>{view === 'queue' ? 'Review dashboard' : 'Decision history'}</h2></div><div className="faculty-header-actions"><button type="button" onClick={() => { setView('queue'); refreshQueue() }}>Pending queue</button><button type="button" onClick={() => { setView('history'); loadHistory() }}>My decisions</button><button type="button" className="faculty-refresh" onClick={refreshQueue} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh queue ↻'}</button></div></div>
      {view === 'queue' ? <>
      <div className="faculty-metrics"><article><span>Waiting for you</span><strong>{requests.length}</strong></article><article><span>Urgent</span><strong>{urgentCount}</strong></article><article><span>Deadline within 24h</span><strong>{expiringCount}</strong></article></div>
      <div className="faculty-filters"><input aria-label="Search requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, reference, or reason"/><select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent only</option><option value="normal">Normal only</option></select></div>
      {loading ? <p className="faculty-empty">Loading assigned requests…</p> : requests.length === 0 ? <p className="faculty-empty">No requests are waiting for your review.</p> : visibleRequests.length === 0 ? <p className="faculty-empty">No requests match these filters.</p> : visibleRequests.map((request) => <article className={`faculty-request ${request.priority === 'urgent' ? 'faculty-request-urgent' : ''}`} key={request.id}>
        <div className="faculty-request-top"><div><span className="faculty-reference">{request.reference} · {request.applicationType === 'outpass' ? 'OUTPASS' : 'LEAVE'}</span><h3>{request.studentName || 'Student'} <small>{request.studentEmail}</small></h3></div><div className="faculty-badges"><span className={`faculty-priority ${request.priority || 'normal'}`}>{request.priority === 'urgent' ? 'Urgent' : 'Normal'}</span><span className="faculty-stage">{stageLabels[role]}</span></div></div>
        <div className="faculty-request-info"><div><span>APPLICATION</span><strong>{request.applicationType === 'outpass' ? 'Outpass' : request.leaveType}</strong></div><div><span>DATES</span><strong>{formatDate(request.startDate)} – {formatDate(request.endDate)}</strong></div>{request.applicationType === 'outpass' && <div><span>OUTPASS TIME</span><strong>{request.departureTime} – {request.returnTime}</strong></div>}<div><span>RESPONSE DEADLINE</span><strong>{deadlineLabel(request.expiresAt, clock)}</strong></div></div>
        <p className="faculty-reason">{request.reason}</p>{request.leaveAddress && <p className="faculty-reason" style={{ whiteSpace: 'pre-wrap' }}><strong>Leave address:</strong> {request.leaveAddress}</p>}{request.attachment && <a className="faculty-proof" href={`/api/faculty/approvals/${request.id}/proof`}>Supporting proof: {request.attachment.name}</a>}{request.studentResponse?.message && <p className="faculty-student-response"><strong>Student response:</strong> {request.studentResponse.message}</p>}
        <div className="faculty-assignees">{(request.approvers || []).map((person) => <span key={person.role}>{stageLabels[person.role]}: {person.name}</span>)}</div>
        <label className="faculty-comment">Decision note <small>Required for rejection or information requests; shared with the student.</small><textarea rows="2" maxLength="1000" value={comments[request.id] || ''} onChange={(event) => setComments((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Add a reason or guidance for the student" /></label>
        <div className="faculty-actions"><button type="button" className="faculty-reject" disabled={busyId === request.id} onClick={() => decide(request, 'rejected')}>Reject</button>{request.applicationType !== 'outpass' && <button type="button" className="faculty-request-info-button" disabled={busyId === request.id} onClick={() => decide(request, 'needs_information')}>Request information</button>}<button type="button" className="faculty-approve" disabled={busyId === request.id} onClick={() => decide(request, 'approved')}>{busyId === request.id ? 'Saving…' : request.applicationType === 'outpass' ? 'Approve outpass' : 'Approve and forward'}</button></div>
      </article>)}
      </> : history.length === 0 ? <p className="faculty-empty">Your decisions will appear here.</p> : history.map((request) => <article className="faculty-request" key={request.id}><div className="faculty-request-top"><div><span className="faculty-reference">{request.reference} · {request.applicationType === 'outpass' ? 'OUTPASS' : 'LEAVE'}</span><h3>{request.studentName || 'Student'} <small>{request.studentEmail}</small></h3></div><span className="faculty-stage">{request.status}</span></div><p className="faculty-reason">{request.reason}</p>{request.leaveAddress && <p className="faculty-reason" style={{ whiteSpace: 'pre-wrap' }}><strong>Leave address:</strong> {request.leaveAddress}</p>}{request.myDecisions?.map((item, index) => <p className="faculty-history-item" key={`${item.decidedAt}-${index}`}><strong>{item.decision.replace('_', ' ')}</strong> · {formatDate(item.decidedAt)}{item.comment ? ` · ${item.comment}` : ''}</p>)}</article>)}
    </section>
    {showPasswordChange && <PasswordChangeModal onClose={() => setShowPasswordChange(false)} onChanged={() => { setShowPasswordChange(false); onSignOut() }} />}
  </main>
}
