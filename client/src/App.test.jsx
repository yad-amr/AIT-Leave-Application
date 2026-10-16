// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })
function mock(handler) { vi.stubGlobal('fetch', vi.fn(async (url, options) => ({ ok: true, json: async () => handler(url, options) }))) }
test('login validates college domain and supports full-code paste with auto submit', async () => {
  window.history.replaceState({}, '', '/login/student')
  mock(url => url.endsWith('/config') ? { domain: 'ait.edu' } : url.endsWith('/request-otp') ? { expiresAt: Date.now()+300000, resendAt: Date.now()+30000, attemptsLeft: 5 } : { user: { role: 'student', email: 'student@ait.edu', name: 'Demo student' } })
  render(<App />); const user = userEvent.setup()
  const email = await screen.findByLabelText('College email address')
  await user.type(email, 'someone@gmail.com'); await user.click(screen.getByRole('button', { name: /Send OTP/ }))
  expect(screen.getByText('Enter a valid college email ending in @ait.edu.')).toBeTruthy()
  await user.clear(email); await user.type(email,'student@ait.edu'); await user.click(screen.getByRole('button', { name: /Send OTP/ }))
  const digit = await screen.findByLabelText('Code digit 1'); await user.click(digit); await user.paste('123456')
  await screen.findByText('Welcome, Demo student')
  expect(fetch.mock.calls.some(([url, options]) => url.endsWith('/verify-otp') && JSON.parse(options.body).otp === '123456')).toBe(true)
})
test('student navigating to faculty page is redirected to student dashboard', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  mock(url => url.endsWith('/config') ? { domain: 'ait.edu' } : { user: { role: 'student', name: 'Student', email: 'student@ait.edu' } })
  render(<App />)
  await waitFor(() => expect(window.location.pathname).toBe('/student/dashboard'))
  expect(fetch.mock.calls.some(([url]) => url === '/api/faculty/dashboard')).toBe(false)
})
test('expired sessions redirect to matching login', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: url.endsWith('/config'), status: 401, json: async () => url.endsWith('/config') ? { domain:'ait.edu' } : { error:'Session expired' } })))
  render(<App />); await screen.findByLabelText('College email address')
  expect(window.location.pathname).toBe('/login/faculty')
})
