import { useState } from 'react'
import './PasswordChangeModal.css'

export default function PasswordChangeModal({ onClose, onChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (form.newPassword.length < 8) return setError('Use at least 8 characters for your new password.')
    if (form.newPassword !== form.confirmPassword) return setError('The new passwords do not match.')
    setSaving(true)
    try {
      const response = await fetch('/api/auth/change-password', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not change your password.')
      onChanged(data.message)
    } catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }

  return <div className="password-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title"><div className="password-modal-heading"><div><span>ACCOUNT SECURITY</span><h2 id="password-modal-title">Change password</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={submit}><label>Current password<input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required /></label><label>New password<input type="password" autoComplete="new-password" minLength="8" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength="8" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required /></label>{error && <p className="password-modal-error" role="alert">{error}</p>}<div className="password-modal-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Update password'}</button></div></form></section></div>
}
