// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })
function mock(handler) { vi.stubGlobal('fetch', vi.fn(async (url, options) => ({ ok: true, json: async () => handler(url, options) }))) }
test('login validates college domain and supports full-code paste with auto submit', async () => {
  window.history.replaceState({}, '', '/login/student')
  mock(url => url.endsWith('/config') ? { domain: 'aitpune.edu.in' } : url.endsWith('/request-otp') ? { expiresAt: Date.now()+300000, resendAt: Date.now()+30000, attemptsLeft: 5 } : { user: { role: 'student', email: 'student_123456@aitpune.edu.in', name: 'Demo student' } })
  render(<App />); const user = userEvent.setup()
  const email = await screen.findByLabelText('College email address')
  await user.type(email, 'someone@gmail.com'); await user.click(screen.getByRole('button', { name: /Send OTP/ }))
  expect(screen.getByText('Use name_123456@aitpune.edu.in with a six-digit registration number.')).toBeTruthy()
  await user.clear(email); await user.type(email,'student_123456@aitpune.edu.in'); await user.click(screen.getByRole('button', { name: /Send OTP/ }))
  const digit = await screen.findByLabelText('Code digit 1'); await user.click(digit); await user.paste('123456')
  await screen.findByText('Welcome, Demo student')
  expect(fetch.mock.calls.some(([url, options]) => url.endsWith('/verify-otp') && JSON.parse(options.body).otp === '123456')).toBe(true)
})
test('student navigating to faculty page is redirected to student dashboard', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  mock(url => url.endsWith('/config') ? { domain: 'aitpune.edu.in' } : { user: { role: 'student', name: 'Student', email: 'student_123456@aitpune.edu.in' } })
  render(<App />)
  await waitFor(() => expect(window.location.pathname).toBe('/student/dashboard'))
  expect(fetch.mock.calls.some(([url]) => url === '/api/faculty/dashboard')).toBe(false)
})
test('expired sessions redirect to matching login', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: url.endsWith('/config'), status: 401, json: async () => url.endsWith('/config') ? { domain:'aitpune.edu.in' } : { error:'Session expired' } })))
  render(<App />); await screen.findByLabelText('College email address')
  expect(window.location.pathname).toBe('/login/faculty')
})
test('student submits an urgent leave without proof and sees its tracker', async () => {
  window.history.replaceState({}, '', '/student/apply/leave')
  const application = { id: 'abc', type:'LEAVE', status:'SUBMITTED', is_urgent:true, current_step:'class_teacher', fields:{ reason:'A family appointment', leave_type:'Personal' }, steps:[{ role:'class_teacher' },{ role:'hod' },{ role:'warden' },{ role:'director' }], history:[] }
  mock((url, options) => {
    if (url.endsWith('/config')) return { domain:'aitpune.edu.in' }
    if (url.endsWith('/session')) return { user:{ role:'student', name:'Student',email:'student_123456@aitpune.edu.in' } }
    if (url.endsWith('/leave-types')) return { types:['Personal'] }
    if (url.endsWith('/applications/leave')) { expect(options.body.get('is_urgent')).toBe('true'); expect(options.body.has('proof')).toBe(false); return application }
    return application
  })
  render(<App />); const user = userEvent.setup()
  await user.selectOptions(await screen.findByLabelText('Leave type'),'Personal')
  await user.type(screen.getByLabelText('From date'),'2026-10-20')
  await user.type(screen.getByLabelText('To date'),'2026-10-21')
  await user.type(screen.getByLabelText('Reason'),'A family appointment')
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button',{name:'Submit leave →'}))
  await screen.findByText('Leave application')
  expect(screen.getByText('Awaiting signature')).toBeTruthy()
  expect(window.location.pathname).toBe('/student/applications/abc')
})
