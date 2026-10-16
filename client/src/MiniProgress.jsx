export default function MiniProgress({ application }) {
  const steps = application.steps || []
  const completed = application.completed_steps ?? steps.filter(s => s.decision === 'APPROVED').length
  return <div className="mini-progress"><span className="mini-segments" aria-hidden="true">{steps.map(s => <span key={s.role} className={`progress-${s.display_state || (s.decision === 'APPROVED' ? 'APPROVED' : 'PENDING')}`} />)}</span><small>{completed} of {steps.length} approvals · {application.display_state === 'REJECTED' ? 'Stopped — rejected' : application.display_state === 'CANCELLED' ? 'Cancelled' : application.status === 'APPROVED' ? 'Approved' : 'In progress'}</small></div>
}
