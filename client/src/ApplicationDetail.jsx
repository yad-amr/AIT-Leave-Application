import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './ApplicationDetail.css'
const roles = { class_teacher: 'Class Teacher / Counselor', hod: 'HOD', warden: 'Warden', director: 'Director' }
const formatDate = value => value ? new Date(value).toLocaleString() : 'Not yet decided'
const states = { APPROVED: 'Approved', REJECTED: 'Rejected', CURRENT: 'Awaiting signature', PENDING: 'Not reached yet', STOPPED: 'Stopped' }
const icons = { APPROVED: '✓', REJECTED: '×', CURRENT: '●', PENDING: '○', STOPPED: '—' }
const fieldLabels = { leave_type: 'Leave type', from_date: 'From date', to_date: 'To date', days: 'Number of days', reason: 'Reason', out_at: 'Departure', return_at: 'Expected return', destination: 'Destination', contact: 'Contact number' }
export default function ApplicationDetail({ id, api }) {
  const [data,setData] = useState(null), [error,setError] = useState(null), [version,setVersion] = useState(0), [busy,setBusy] = useState(false), [confirm,setConfirm] = useState(false)
  useEffect(() => {
    let active = true
    api(`/applications/${id}`).then(value => { if(active) { setData(value); setError(null) } }).catch(e => { if(active) { setError(e) } })
    return () => { active = false }
  }, [id,api,version])
  if (!data && error) return <section className="student-section"><h1>{error.status === 404 ? 'Application not found' : 'Unable to load application'}</h1><p>{error.status === 404 ? 'This application could not be found.' : error.message}</p><Link to="/student/dashboard">← Back home</Link>{error.status !== 404 && <button onClick={() => { setError(null); setVersion(v=>v+1) }}>Retry</button>}</section>
  if (!data) return <section className="student-section detail-skeleton" role="status" aria-label="Loading application"><div /><div /><div /><span>Loading application…</span></section>
  const steps = data.steps
  const rejected = steps.find(s=>s.decision === 'REJECTED')
  const cancelled = data.status === 'CANCELLED', approved = data.status === 'APPROVED'
  const canCancel = data.can_cancel ?? (['SUBMITTED','DRAFT'].includes(data.status) && !steps.some(s=>s.decision))
  const finalDate = steps.at(-1)?.decided_at
  const nodes = [{ role:'submitted', name:'Submitted', display_state:'APPROVED' }, ...steps, { role:'complete', name:'Approved', display_state:approved ? 'APPROVED' : cancelled || rejected ? 'STOPPED' : 'PENDING' }]
  async function cancel() { setBusy(true); try { const value=await api(`/applications/${id}/cancel`,{}); setData(value); setConfirm(false); setError(null) } catch(e) { setError(e) } finally { setBusy(false) } }
  return <section className="student-section application-detail">
    <Link to="/student/dashboard">← Back home</Link>
    <header className="detail-header"><div><p className="eyebrow">APPLICATION STATUS</p><h1>{data.type === 'LEAVE' ? 'Leave' : 'Outpass'} application</h1><p className="reference">Reference: {data.id}</p><p>Submitted {formatDate(data.created_at)}</p></div><div><span className={`status ${data.status}`}>{data.status.replaceAll('_',' ')}</span> {data.is_urgent && <span className="urgent-badge">Urgent</span>}</div></header>
    {approved && <div className="result-banner approved-banner" role="status"><strong>All approvals complete ✓</strong><p>Approved on {formatDate(finalDate)}</p></div>}
    {rejected && <div className="result-banner rejected-banner"><strong>Rejected by {rejected.approver_name || roles[rejected.role]}</strong><p>{formatDate(rejected.decided_at)}</p><p>{rejected.comment || 'No reason recorded.'}</p></div>}
    {cancelled && <div className="result-banner cancelled-banner"><strong>Application cancelled</strong><p>The approval chain has stopped.</p></div>}
    <h2>Approval progress</h2>
    <ol className="approval-stepper" aria-label="Approval progress">{nodes.map((s,i) => {
      const state = s.display_state || (s.decision || (data.current_step === s.role ? 'CURRENT' : cancelled || rejected ? 'STOPPED' : 'PENDING'))
      return <li key={s.role} className={`progress-${state}`} aria-current={state === 'CURRENT' ? 'step' : undefined}>
        <span className="step-connector" aria-hidden="true" />
        {i === 0 || i === nodes.length-1 ? <><span className="step-node" aria-hidden="true">{icons[state]}</span><strong>{s.name}</strong><small>{i===0 ? formatDate(data.created_at) : approved ? formatDate(finalDate) : states[state]}</small></> : <details className="step-details"><summary><span className="step-node" aria-hidden="true">{icons[state]}</span><strong>{roles[s.role] || s.role}</strong><span>{s.approver_name || 'Unassigned'}</span><small>{s.department || 'Department not recorded'}</small><span className="step-state">{states[state]}</span></summary><div className="step-expanded"><p><strong>Decision:</strong> {states[state]}</p><p>{formatDate(s.decided_at)}</p>{s.comment && <p><strong>Comment:</strong> {s.comment}</p>}{s.signature_data && <p><strong>Typed signature:</strong> <span className="typed-signature">{s.signature_data}</span></p>}</div></details>}
      </li>
    })}</ol>
    <h2>Application summary</h2><dl className="details">{Object.entries(data.fields).map(([key,value])=><div key={key}><dt>{fieldLabels[key] || key}</dt><dd>{(['out_at','return_at'].includes(key) ? String(value).replace('T',' · ') : String(value))}</dd></div>)}</dl>
    {data.attachment?.size && <p><a href={`/api/applications/${id}/proof`}>Download proof: {data.attachment.name}</a></p>}
    <h2>Selected approvers</h2><ul className="assigned-list">{steps.map(s=><li key={s.role}><strong>{roles[s.role]}:</strong> {s.approver_name || 'Unassigned'}{s.department && ` — ${s.department}`}</li>)}</ul>
    {canCancel && <button onClick={()=>setConfirm(true)}>Cancel application</button>}
    {confirm && <CancelConfirmation busy={busy} cancel={cancel} close={()=>setConfirm(false)} />}
    {error && <p className="error" role="alert">{error.message}</p>}
    <History events={data.history} />
  </section>
}
function History({ events }) {
  const [open,setOpen] = useState(()=>!window.matchMedia || !window.matchMedia('(max-width: 767px)').matches)
  return <details className="status-history" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Status timeline</summary><ol>{[...events].sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).map((h,i)=><li key={i}><strong>{h.event.split(':').map(part=>roles[part.trim()] || part.trim().replaceAll('_',' ').toLowerCase()).join(' · ')}</strong><small>{formatDate(h.timestamp)}</small></li>)}</ol>{!events.length && <p>No history events recorded.</p>}</details>
}

function CancelConfirmation({ busy, cancel, close }) {
  const ref = useRef(null)
  useEffect(()=>{ const dialog = ref.current; dialog.showModal(); return ()=>dialog.close() },[])
  return <dialog ref={ref} className="cancel-confirm" aria-labelledby="cancel-title" onCancel={e=>{e.preventDefault();if(!busy)close()}}><h2 id="cancel-title">Cancel this application?</h2><p>This stops the approval process. You can submit a new application later.</p><div><button autoFocus disabled={busy} onClick={close}>Keep application</button><button disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Yes, cancel application'}</button></div></dialog>
}
