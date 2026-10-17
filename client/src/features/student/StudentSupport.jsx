import { useState } from 'react'
import './StudentSupport.css'

const questions = [
  ['My requests are not loading', 'Check your internet connection and reload the page. If your session has expired, sign in again. If the problem continues, include the exact error message when contacting the college.'],
  ['My leave request is still pending', 'Open your request using the arrow in the Track request column. The approval progress shows the current reviewer. Contact your assigned reviewer for an update.'],
  ['I cannot submit a leave request or outpass', 'Complete all required fields, including the leave address, dates, reason, and approvers. Outpasses also require departure and return times, a destination, and a valid contact number. Read the error shown in the form before trying again.'],
  ['How do I download my approval?', 'Open the request details after it is approved. Use the approval download action there. Leave requests need all four approvals; outpasses need the Warden approval.'],
  ['How do I change my password?', 'Open Profile and select Change password. Enter your current password and confirm the new password. After changing it, sign in again. If you cannot sign in, contact your college administrator.'],
]

export default function StudentSupport({ user, onBack }) {
  const [topic, setTopic] = useState('Request submission')
  const [reference, setReference] = useState('')
  const [message, setMessage] = useState('')
  const [prepared, setPrepared] = useState(false)
  function contact(event) {
    event.preventDefault()
    const body = `Name: ${user?.name || ''}\nCollege email: ${user?.email || ''}\nTopic: ${topic}\nRequest reference: ${reference.trim() || 'Not applicable'}\n\n${message.trim()}`
    window.location.href = `mailto:ait@aitpune.edu.in?subject=${encodeURIComponent(`Smart Leave enquiry: ${topic}`)}&body=${encodeURIComponent(body)}`
    setPrepared(true)
  }
  return <section className="student-support" aria-labelledby="support-title">
    <button type="button" className="header-account-button profile-back" onClick={onBack}>← Back to dashboard</button>
    <div className="support-heading"><p className="date-line">STUDENT HELP</p><h1 id="support-title">Help &amp; support</h1><p>Find help with your account, leave requests, and outpasses.</p></div>
    <div className="support-layout">
      <section className="support-card" aria-labelledby="faq-title"><h2 id="faq-title">Common questions</h2>{questions.map(([title, answer]) => <details key={title}><summary>{title}</summary><p>{answer}</p></details>)}</section>
      <section className="support-card" aria-labelledby="contact-title"><h2 id="contact-title">Contact the college</h2><p>Use the college’s general enquiry email for assistance or ask your assigned reviewer about an approval.</p>
        <form onSubmit={contact}>
          <label>Problem category<select value={topic} onChange={event => setTopic(event.target.value)}>{['Request submission', 'Approval status', 'Account or password', 'Approval download', 'Other problem'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Request reference (optional)<input value={reference} onChange={event => setReference(event.target.value)} placeholder="e.g. LR-2026-ABC123" maxLength={100} /></label>
          <label>Describe the problem<textarea value={message} onChange={event => { setMessage(event.target.value); setPrepared(false) }} rows={5} minLength={10} maxLength={2000} required placeholder="What were you trying to do, and what happened? Include any error message." /></label>
          <p className="support-note">Do not include passwords. This opens a draft in your email app; send it there to contact the college.</p>
          <button type="submit" className="header-account-button">Open email draft</button>
          {prepared && <p role="status">Your email app was requested. If it did not open, email ait@aitpune.edu.in with the details above.</p>}
        </form>
        <a href="https://www.aitpune.com/Contact-Us.aspx" target="_blank" rel="noreferrer">College contact page ↗</a>
      </section>
    </div>
  </section>
}
