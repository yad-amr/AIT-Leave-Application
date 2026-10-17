import { useEffect, useMemo, useState } from 'react'
import Logo from '../../Logo.jsx'
import PasswordChangeModal from '../common/PasswordChangeModal.jsx'
import './StudentDashboard.css'

const apiBaseUrl = ''

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatTimestamp(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) + ' IST'
}

function formatUpdated(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function displayStatus(status) {
  if (status?.startsWith('pending_')) return 'In review'
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return status || 'Pending'
}

function activeApprover(status) {
  const names = { pending_warden: 'Warden', pending_counsellor: 'Counsellor', pending_hod: 'HOD', pending_joint_director: 'Joint Director' }
  return names[status] || '—'
}

function StatusBadge({ status }) {
  const label = displayStatus(status)
  return <span className={`status-badge status-${label.toLowerCase().replace(' ', '-')}`}>{label}</span>
}

const approvalSteps = [
  { role: 'warden', label: 'Warden' },
  { role: 'counsellor', label: 'Counsellor' },
  { role: 'hod', label: 'HOD' },
  { role: 'joint_director', label: 'Joint Director' },
]

function RequestDetails({ request, onClose, onDownload, downloading, onCancel, cancelling, onProof, onRespond, responding }) {
  const [responseMessage, setResponseMessage] = useState('')
  const statusOrder = request.applicationType === 'outpass' ? ['pending_warden'] : ['pending_warden', 'pending_counsellor', 'pending_hod', 'pending_joint_director']
  const history = request.approvalHistory || []
  const rejectedApproval = history.find((item) => item.decision === 'rejected')
  const isApproved = request.status === 'approved'
  const isRejected = request.status === 'rejected'
  const isCancelled = request.status === 'cancelled'

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="request-modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="modal-heading"><div><span className="eyebrow">{request.reference || request.id}</span><h2 id="detail-title">Request details</h2></div><button className="icon-button" onClick={onClose} aria-label="Close details">×</button></div>
        <div className="detail-summary"><div><span className="detail-label">APPLICATION</span><strong>{request.applicationType === 'outpass' ? 'Outpass' : request.leaveType} · {request.priority === 'urgent' ? 'Urgent' : 'Normal'}</strong></div><StatusBadge status={request.status} /></div>
        <div className="detail-fields"><div><span className="detail-label">DATES</span><strong>{formatDate(request.startDate)} – {formatDate(request.endDate)}</strong></div>{request.applicationType === 'outpass' && <><div><span className="detail-label">OUTPASS TIME</span><strong>{request.departureTime} – {request.returnTime}</strong></div><div><span className="detail-label">DESTINATION</span><strong>{request.destination}</strong></div><div><span className="detail-label">CONTACT DURING OUTPASS</span><strong>{request.contactNumber}</strong></div></>}{request.leaveAddress && <div><span className="detail-label">LEAVE ADDRESS</span><p style={{ whiteSpace: 'pre-wrap' }}>{request.leaveAddress}</p></div>}<div><span className="detail-label">REASON</span><p>{request.reason}</p></div>{request.attachment && <button type="button" className="text-button" onClick={() => onProof(request)}>Download supporting proof · {request.attachment.name}</button>}</div>
        <div className="timeline-heading"><span className="eyebrow">APPROVAL PROGRESS</span><span>{isApproved ? (request.applicationType === 'outpass' ? '1 of 1 complete' : '4 of 4 complete') : isRejected ? 'Request rejected' : isCancelled ? 'Request cancelled' : `With ${activeApprover(request.status)}`}</span></div>
        <div className="approval-timeline">{approvalSteps.filter((step) => request.applicationType !== 'outpass' || step.role === 'warden').map((step, index) => {
          const decision = [...history].reverse().find((item) => item.role === step.role)
          const assigned = request.approvers?.find((item) => item.role === step.role)
          const current = statusOrder[index] === request.status
          const complete = isApproved || history.some((item) => item.role === step.role && item.decision === 'approved')
          const rejected = decision?.decision === 'rejected'
          return <div className={`timeline-step ${complete ? 'step-complete' : ''} ${current ? 'step-current' : ''} ${rejected ? 'step-rejected' : ''}`} key={step.role}><span className="timeline-marker">{complete ? '✓' : rejected ? '!' : isCancelled ? '–' : index + 1}</span><div className="timeline-content"><div className="timeline-role"><strong>{step.label}{assigned ? ` · ${assigned.name}` : ''}</strong><span>{complete ? 'Approved' : rejected ? 'Rejected' : isCancelled ? 'Stopped' : decision?.decision === 'needs_information' ? 'More information requested' : current ? 'In review' : 'Waiting'}</span></div>{decision?.decidedAt && <small>{formatTimestamp(decision.decidedAt)}</small>}{decision?.comment && <p className={`approval-comment ${rejected ? 'rejection-comment' : ''}`}>{decision.comment}</p>}</div></div>
        })}</div>
        {isRejected && !rejectedApproval?.comment && <div className="rejection-note">This request was rejected. Contact the listed approver for more information.</div>}
        {isCancelled && <div className="rejection-note">You cancelled this request before the first reviewer acted.</div>}
        {request.approvalHistory?.at(-1)?.decision === 'needs_information' && request.status.startsWith('pending_') && <form className="student-response-form" onSubmit={async (event) => { event.preventDefault(); await onRespond(request, responseMessage); setResponseMessage('') }}><label>Reply to the approver<textarea minLength="5" maxLength="1000" required value={responseMessage} onChange={(event) => setResponseMessage(event.target.value)} placeholder="Add the requested information" /></label><button className="button button-primary" disabled={responding}>{responding ? 'Sending…' : 'Send response'}</button></form>}
        {request.studentResponse?.message && <p className="student-response-note"><strong>Your response:</strong> {request.studentResponse.message}</p>}
        <div className="detail-actions"><button type="button" className="button button-quiet" onClick={onClose}>Close</button>{request.status === 'pending_warden' && history.length === 0 && <button type="button" className="button button-quiet" onClick={() => onCancel(request)} disabled={cancelling}>Cancel request</button>}{isApproved && !String(request.id).startsWith('demo-') && <button type="button" className="button button-primary" onClick={() => onDownload(request)} disabled={downloading}>{downloading ? 'Preparing PDF…' : 'Download approval PDF ↓'}</button>}</div>
      </section>
    </div>
  )
}
function RequestForm({ onClose, onSubmit, submitting, approvers, approversLoading, leaveTypes }) {
  const [form, setForm] = useState({ applicationType: 'leave', leaveType: leaveTypes[0] || 'Personal leave', startDate: '', endDate: '', departureTime: '', returnTime: '', destination: '', contactNumber: '', leaveAddress: '', priority: 'normal', reason: '', approverIds: { warden: '', counsellor: '', hod: '' } })
  const [proof, setProof] = useState(null)
  const [error, setError] = useState('')

  function update(event) {
    setForm((current) => event.target.name === 'startDate' && current.applicationType === 'outpass' ? { ...current, startDate: event.target.value, endDate: event.target.value } : { ...current, [event.target.name]: event.target.value })
  }

  function updateApprover(event) {
    setForm((current) => ({ ...current, approverIds: { ...current.approverIds, [event.target.name]: event.target.value } }))
  }

  async function submit(event) {
    event.preventDefault()
    if (form.endDate < form.startDate) return setError('The end date must be on or after the start date.')
    if (!form.leaveAddress.trim()) return setError('Enter your leave or outpass address.')
    if (form.reason.trim().length < 8) return setError('Please provide a little more detail (at least 8 characters).')
    if (form.applicationType === 'outpass' && (!form.departureTime || !form.returnTime || form.returnTime <= form.departureTime || !form.destination.trim() || !/^\+?[\d ()-]{7,20}$/.test(form.contactNumber.trim()))) return setError('Enter valid outpass times, destination, and a contact number.')
    if (form.applicationType === 'leave' && Object.values(form.approverIds).some((id) => !id)) return setError('Choose a warden, counsellor, and HOD before submitting.')
    if (form.applicationType === 'outpass' && !form.approverIds.warden) return setError('Choose a warden before submitting.')
    if (form.applicationType === 'leave' && !approvers.jointDirector) return setError('The Joint Director account is not configured yet.')
    try { await onSubmit({ ...form, proof }) } catch (submitError) { setError(submitError.message) }
  }

  const approverSelect = (role, label, options) => <label>{label}<select name={role} value={form.approverIds[role]} onChange={updateApprover} required disabled={approversLoading || !options.length}><option value="">{approversLoading ? 'Loading approvers…' : `Choose ${label.toLowerCase()}`}</option>{options.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.email}</option>)}</select></label>

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
        <div className="modal-heading"><div><span className="eyebrow">NEW APPLICATION</span><h2 id="request-title">Request leave</h2></div><button className="icon-button" onClick={onClose} aria-label="Close form">×</button></div>
        <p className="modal-intro">Leave applications pass through four reviewers. Outpasses need only the selected Warden’s approval. Your submitted requests and approval history remain available after you sign out or the server restarts.</p>
        <form onSubmit={submit} className="request-form">
          <label>Application type<select name="applicationType" value={form.applicationType} onChange={(event) => setForm((current) => ({ ...current, applicationType: event.target.value, endDate: event.target.value === 'outpass' ? current.startDate : current.endDate }))}><option value="leave">Leave application · four approvals</option><option value="outpass">Outpass · Warden approval only</option></select></label>
          {form.applicationType === 'leave' && <label>Leave type<select name="leaveType" value={form.leaveType} onChange={update}>{leaveTypes.map((type) => <option key={type}>{type}</option>)}</select></label>}
          <div className="form-row"><label>{form.applicationType === 'outpass' ? 'Outpass date' : 'From'}<input type="date" name="startDate" value={form.startDate} onChange={update} min={new Date().toISOString().slice(0, 10)} required /></label>{form.applicationType === 'leave' && <label>To<input type="date" name="endDate" value={form.endDate} onChange={update} min={form.startDate || new Date().toISOString().slice(0, 10)} required /></label>}</div>
          {form.applicationType === 'outpass' && <><div className="form-row"><label>Departure time<input type="time" name="departureTime" value={form.departureTime} onChange={update} required /></label><label>Expected return<input type="time" name="returnTime" value={form.returnTime} onChange={update} required /></label></div><label>Destination<input name="destination" value={form.destination} onChange={update} maxLength="200" required /></label><label>Contact number during outpass<input type="tel" name="contactNumber" value={form.contactNumber} onChange={update} pattern="\+?[0-9 ()-]{7,20}" maxLength="20" required /></label></>}
          {form.applicationType === 'outpass' ? approverSelect('warden', 'Warden', approvers.warden) : <>{approverSelect('warden', 'Warden', approvers.warden)}{approverSelect('counsellor', 'Counsellor', approvers.counsellor)}{approverSelect('hod', 'HOD', approvers.hod)}<label>Joint Director<input value={approvers.jointDirector ? `${approvers.jointDirector.name} · ${approvers.jointDirector.email}` : approversLoading ? 'Loading…' : 'Not configured'} readOnly /></label></>}
          <label>Priority<select name="priority" value={form.priority} onChange={update}><option value="normal">Normal</option><option value="urgent">Urgent · review as soon as possible</option></select></label>
          {form.applicationType === 'leave' && <label>Supporting proof <span className="detail-label">Optional · PDF, JPG or PNG up to 5 MB</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setProof(event.target.files?.[0] || null)} /></label>}
          <label>Leave address<textarea name="leaveAddress" value={form.leaveAddress} onChange={update} rows="3" maxLength="1000" placeholder="House number, street, city, state and PIN code" required /></label>
          <label>Reason<textarea name="reason" value={form.reason} onChange={update} rows="4" placeholder="Briefly explain why you need leave..." required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={submitting || approversLoading || (form.applicationType === 'leave' && !approvers.jointDirector)}>{submitting ? 'Submitting…' : <>Submit request <span aria-hidden="true">→</span></>}</button></div>
        </form>
      </section>
    </div>
  )
}
function AppIcon({ name }) {
  const paths = {
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></>,
    file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M8 15h8M8 18h6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.7c-1.2 1.1-1.9 1.5-1.9 3M12 17h.01"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function StudentDashboard({ user, onSignOut }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [requests, setRequests] = useState([])
  const [approvers, setApprovers] = useState({ warden: [], counsellor: [], hod: [], jointDirector: null })
  const [leaveTypes, setLeaveTypes] = useState(['Personal leave', 'Medical leave', 'Academic leave', 'Other'])
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(true)
  const [approversLoading, setApproversLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('All requests')
  const [showForm, setShowForm] = useState(false)
  const [activeNav, setActiveNav] = useState('Overview')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [respondingId, setRespondingId] = useState('')
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const studentName = user?.name || 'Student'
  const initials = studentName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    let active = true

    async function fetchRequests() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/leave-requests`, { credentials: 'include' })
        if (!response.ok) {
          if (response.status === 401) throw new Error('Sign in with a student account to view your live requests.')
          throw new Error('Could not load your leave requests.')
        }
        const data = await response.json()
        if (active) {
          setRequests(data.requests || [])
          setApiUnavailable(false)
        }
      } catch (error) {
        if (active) {
          const isOffline = error.message === 'Failed to fetch'
          setApiUnavailable(isOffline)
          setRequests([])
          setNotice(isOffline ? 'Could not connect to the leave API. Your real requests are not available right now.' : error.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchRequests()
    const timer = setInterval(fetchRequests, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  useEffect(() => {
    let active = true
    fetch(`${apiBaseUrl}/api/leave-requests/leave-types`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Could not load leave types.')
        if (active && data.types?.length) setLeaveTypes(data.types)
      })
      .catch((error) => { if (active) setNotice(error.message) })
      .finally(() => { if (active) setLeaveTypesLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    fetch(`${apiBaseUrl}/api/leave-requests/approvers`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Could not load approvers.')
        if (active) setApprovers(data.approvers)
      })
      .catch((error) => { if (active) setNotice(error.message) })
      .finally(() => { if (active) setApproversLoading(false) })
    return () => { active = false }
  }, [])

  const filteredRequests = useMemo(() => {
    if (activeTab === 'In review') return requests.filter((request) => displayStatus(request.status) === 'In review')
    if (activeTab === 'Completed') return requests.filter((request) => displayStatus(request.status) !== 'In review')
    return requests
  }, [activeTab, requests])

  async function addRequest(form) {
    setSubmitting(true)
    try {
      const { proof, ...fields } = form
      const body = proof ? new FormData() : fields
      if (proof) {
        Object.entries(fields).forEach(([key, value]) => {
          if (key === 'approverIds') body.append(key, JSON.stringify(value))
          else if (value !== undefined && value !== null) body.append(key, String(value))
        })
        body.append('proof', proof)
      }
      const response = await fetch(`${apiBaseUrl}/api/leave-requests`, {
        method: 'POST',
        credentials: 'include',
        ...(!proof ? { headers: { 'Content-Type': 'application/json' } } : {}),
        body: proof ? body : JSON.stringify(fields),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not submit the request.')
      setRequests((current) => [data.request, ...current])
      setShowForm(false)
      setActiveTab('All requests')
      setNotice('Your leave request has been submitted and is awaiting warden review.')
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadApproval(request) {
    setDownloadingId(request.id)
    try {
      const response = await fetch(`${apiBaseUrl}/api/leave-requests/${request.id}/pdf`, { credentials: 'include' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Could not download the approval letter.')
      }
      const pdfBlob = await response.blob()
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${request.reference || 'leave-approval'}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setDownloadingId(null)
    }
  }

  async function downloadProof(request) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/leave-requests/${request.id}/proof`, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not download supporting proof.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = request.attachment?.name || 'supporting-proof'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) { setNotice(error.message) }
  }

  async function cancelRequest(request) {
    setCancellingId(request.id)
    try {
      const response = await fetch(`${apiBaseUrl}/api/leave-requests/${request.id}/cancel`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not cancel this request.')
      setRequests((current) => current.map((item) => item.id === request.id ? data.request : item))
      setSelectedRequest(data.request)
      setNotice('Your request was cancelled before approval started.')
    } catch (error) { setNotice(error.message) }
    finally { setCancellingId(null) }
  }

  async function respondToRequest(request, message) {
    setRespondingId(request.id)
    try {
      const response = await fetch(`${apiBaseUrl}/api/leave-requests/${request.id}/respond`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not send your response.')
      setRequests((current) => current.map((item) => item.id === request.id ? data.request : item))
      setSelectedRequest(data.request)
      setNotice('Your response was sent to the approver.')
    } catch (error) { setNotice(error.message) }
    finally { setRespondingId('') }
  }
  const totalCount = requests.length
  const pendingCount = requests.filter((request) => displayStatus(request.status) === 'In review').length
  const approvedCount = requests.filter((request) => request.status === 'approved').length
  const upcomingRequest = requests.find((request) => displayStatus(request.status) === 'In review')

  return (
    <div className={`student-app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className="sidebar" id="student-sidebar" hidden={!sidebarOpen}>
        <button className="sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">×</button>
        <button type="button" className="brand dashboard-brand" aria-label="Smart Leave dashboard home" onClick={() => setActiveNav('Overview')}><Logo /></button>
        <div className="sidebar-label">STUDENT PORTAL</div>
        <nav className="side-nav" aria-label="Main navigation">{[['Overview', 'grid'], ['Profile', 'profile']].map(([label, icon]) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} title={label} onClick={() => { setActiveNav(label); if (label === 'Overview') window.scrollTo({ top: 0, behavior: 'smooth' }) }}><AppIcon name={icon} />{label}</button>)}</nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><AppIcon name="help" /></div><strong>Need a hand?</strong><p>Our student support team is here for you.</p><button onClick={() => setNotice('Contact your student support office for assistance.')}>Get support <span>→</span></button></div><button className="profile-row" onClick={onSignOut} title="Sign out" aria-label="Sign out"><span className="avatar">{initials}</span><span className="profile-copy"><strong>{studentName}</strong><small>Student · {user?.email}</small></span><span className="profile-dots">Sign out</span></button></div>
      </aside>
      <main className="main-area" id="overview">
        <header className="topbar"><button className="sidebar-toggle" type="button" aria-controls="student-sidebar" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} onClick={() => setSidebarOpen(value => !value)}>☰</button><div className="breadcrumb">Student portal <span>/</span> <strong>{activeNav}</strong></div><div className="top-actions"><span className="semester-pill"><i /> Fall semester · 2026</span><button className="bell-button" aria-label="Notifications" onClick={() => setNotice('You are all caught up on notifications.')}><AppIcon name="bell" /><i /></button><button type="button" className="top-avatar" aria-label="View profile" onClick={() => setActiveNav('Profile')}>{initials}</button></div></header>
        <div className="page-content">
          {notice && <div className={`notice ${apiUnavailable ? 'notice-info' : ''}`} role="status"><span>✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
          {activeNav === 'Profile' ? <section className="student-profile" aria-labelledby="profile-title">
            <button type="button" className="header-account-button profile-back" onClick={() => setActiveNav('Overview')}>← Back to dashboard</button>
            <div className="profile-heading"><div><p className="date-line">STUDENT ACCOUNT</p><h1 id="profile-title">Your profile</h1><p>Your college account information.</p></div><span className="profile-avatar" aria-hidden="true">{initials}</span></div>
            <div className="profile-card"><h2>Personal information</h2><dl><div><dt>Full name</dt><dd>{studentName}</dd></div><div><dt>College email</dt><dd>{user?.email || 'Not available'}</dd></div><div><dt>Account type</dt><dd>Student</dd></div></dl></div>
            <div className="profile-card"><h2>Account security</h2><p>Keep your account secure by updating your password regularly.</p><div className="profile-actions"><button type="button" className="header-account-button" onClick={() => setShowPasswordChange(true)}>Change password</button><button type="button" className="header-account-button" onClick={onSignOut}>Sign out</button></div></div>
          </section> : <>

          <div className="welcome-row"><div><div className="date-line">STUDENT LEAVE MANAGEMENT</div><h1>Good afternoon, {studentName} <span className="wave">✳</span></h1><p className="welcome-subtitle">Here’s what’s happening with your leave applications.</p></div><button className="button button-primary new-request" onClick={() => setShowForm(true)}><span className="plus">+</span> New leave request</button></div>

          <section className="stats-grid" aria-label="Request summary"><article className="stat-card"><div className="stat-top"><span className="stat-label">Total requests</span><span className="stat-icon stat-blue"><AppIcon name="file" /></span></div><div className="stat-value">{loading ? '—' : String(totalCount).padStart(2, '0')}</div><div className="stat-foot">Leave and outpass applications sent</div></article><article className="stat-card"><div className="stat-top"><span className="stat-label">Pending</span><span className="stat-icon stat-amber"><AppIcon name="file" /></span></div><div className="stat-value">{loading ? '—' : String(pendingCount).padStart(2, '0')}</div><div className="stat-foot"><span className="dot amber-dot" />Requests moving through approval</div></article><article className="stat-card"><div className="stat-top"><span className="stat-label">Approved</span><span className="stat-icon stat-green">✓</span></div><div className="stat-value">{loading ? '—' : String(approvedCount).padStart(2, '0')}</div><div className="stat-foot"><span className="dot green-dot" />PDF available after required approvals</div></article><article className="stat-card highlight-card"><div className="stat-top"><span className="stat-label">Next up</span><span className="stat-icon stat-blue"><AppIcon name="calendar" /></span></div><div className="next-date">{upcomingRequest ? `${formatDate(upcomingRequest.startDate)} — ${formatDate(upcomingRequest.endDate)}` : 'No upcoming leave'}</div><div className="stat-foot"><span className="dot blue-dot" />{upcomingRequest ? (upcomingRequest.applicationType === 'outpass' ? 'Outpass' : upcomingRequest.leaveType) : 'Your approved dates will show here'}</div></article></section>
          <section className="requests-section" id="requests"><div className="section-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Leave requests</h2></div><button className="text-button" onClick={() => setActiveTab('All requests')}>View all <AppIcon name="arrow" /></button></div>
            <div className="request-toolbar"><div className="tabs" role="tablist" aria-label="Filter requests">{['All requests', 'In review', 'Completed'].map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab}{tab === 'All requests' && <span className="tab-count">{requests.length}</span>}</button>)}</div><span className="table-caption">{loading ? 'Loading…' : `Showing ${filteredRequests.length} ${filteredRequests.length === 1 ? 'request' : 'requests'}`}</span></div>
            <div className="request-list"><div className="list-header"><span>REQUEST</span><span>LEAVE DATES</span><span>APPROVAL STATUS</span><span>UPDATED</span><span>TRACK REQUEST</span></div>{filteredRequests.length ? filteredRequests.map((request) => <article className="request-row" key={request.id}><div className="request-name"><span className="document-icon"><AppIcon name="file" /></span><span><strong>{request.applicationType === 'outpass' ? 'Outpass' : request.leaveType} <em className={`priority-tag priority-${request.priority || 'normal'}`}>{request.priority === 'urgent' ? 'Urgent' : 'Normal'}</em></strong><small>{request.reference || request.id} · {request.reason}</small></span></div><div className="date-cell"><strong>{formatDate(request.startDate)}</strong><small>{request.applicationType === 'outpass' ? `${request.departureTime}–${request.returnTime}` : `to ${formatDate(request.endDate)}`}</small></div><div className="approval-cell"><StatusBadge status={request.status} />{displayStatus(request.status) === 'In review' && <small>With {activeApprover(request.status)}</small>}{request.status === 'approved' && <small>{request.applicationType === 'outpass' ? 'Warden approval complete' : 'All 4 approvals complete'}</small>}{request.status === 'rejected' && <small>See decision details</small>}</div><div className="updated-cell">{formatUpdated(request.updatedAt)}</div><button className="row-action" aria-label={`View ${request.reference || request.id}`} onClick={() => setSelectedRequest(request)}>↗</button></article>) : <div className="empty-state">{loading ? 'Loading your requests…' : 'No requests in this view yet.'}</div>}</div>
          </section>
          </>}
          <footer className="page-footer"><span>© 2026 Campus Leave · Student portal</span><span>Need help? <button onClick={() => setNotice('Contact your student support office for assistance.')}>Contact support</button></span></footer>
        </div>
      </main>
      {selectedRequest && <RequestDetails request={selectedRequest} onClose={() => setSelectedRequest(null)} onDownload={downloadApproval} downloading={downloadingId === selectedRequest.id} onCancel={cancelRequest} cancelling={cancellingId === selectedRequest.id} onProof={downloadProof} onRespond={respondToRequest} responding={respondingId === selectedRequest.id} />}
      {showForm && <RequestForm onClose={() => setShowForm(false)} onSubmit={addRequest} submitting={submitting} approvers={approvers} approversLoading={approversLoading || leaveTypesLoading} leaveTypes={leaveTypes} />}
      {showPasswordChange && <PasswordChangeModal onClose={() => setShowPasswordChange(false)} onChanged={() => { setShowPasswordChange(false); onSignOut() }} />}
    </div>
  )
}

export default StudentDashboard
