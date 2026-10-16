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
test('home page provides the AIT enquiry and footer links', async () => {
  mock(url => url.endsWith('/config') ? { domain: 'aitpune.edu.in' } : {})
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Leave, without the paperwork.' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'For an Enquiry' }).getAttribute('href')).toBe('https://www.aitpune.com/Contact-Us.aspx')
  expect(screen.getByRole('link', { name: 'Computer Engg' }).getAttribute('href')).toBe('https://www.aitpune.com/Computer-Engg.aspx')
  expect(screen.getByText('Site Updated On :01 Mar 2026')).toBeTruthy()
})
test('faculty portal exposes pending, approved, and response log views', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  mock(url => {
    if (url.endsWith('/config')) return { domain: 'aitpune.edu.in' }
    if (url.endsWith('/auth/session')) return { user: { role: 'faculty', approvalRole: 'warden', name: 'Demo Warden' } }
    if (url.endsWith('/faculty/dashboard')) return {}
    if (url.endsWith('/faculty/logs')) return { logs: [] }
    if (url.startsWith('/api/faculty/requests')) return { requests: [] }
    return {}
  })
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Welcome, Demo Warden' })).toBeTruthy()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Approved requests' }))
  expect(await screen.findByRole('heading', { name: 'Approved requests' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Logs' }))
  expect(await screen.findByRole('heading', { name: 'Your response log' })).toBeTruthy()
})
