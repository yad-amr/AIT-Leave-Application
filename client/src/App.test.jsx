// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })
function mock(handler) {
  vi.stubGlobal('fetch', vi.fn(async (url, options) => ({ ok: true, json: async () => handler(url, options) })))
}

test('password login validates college domain and opens the student dashboard', async () => {
  window.history.replaceState({}, '', '/login/student')
  mock((url) => url.endsWith('/config') ? { domain: 'aitpune.edu.in' } : { user: { role: 'student', email: 'student_123456@aitpune.edu.in', name: 'Demo student' } })
  render(<App />)
  const user = userEvent.setup()
  const email = await screen.findByLabelText('College email address')
  await user.type(email, 'someone@gmail.com')
  await user.type(screen.getByLabelText('Password'), 'DemoPass123!')
  await user.click(screen.getByRole('button', { name: /Sign in/ }))
  expect(screen.getByText('Use name_123456@aitpune.edu.in with a six-digit registration number.')).toBeTruthy()
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/login'))).toBe(false)
  await user.clear(email)
  await user.type(email, 'student_123456@aitpune.edu.in')
  await user.click(screen.getByRole('button', { name: /Sign in/ }))
  await screen.findByText('Good afternoon, Demo student')
  expect(fetch.mock.calls.some(([url, options]) => url.endsWith('/login') && JSON.parse(options.body).password === 'DemoPass123!')).toBe(true)
})

test('student navigating to faculty page is redirected to the student dashboard', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  mock((url) => url.endsWith('/config') ? { domain: 'aitpune.edu.in' } : { user: { role: 'student', name: 'Student', email: 'student_123456@aitpune.edu.in' } })
  render(<App />)
  await waitFor(() => expect(window.location.pathname).toBe('/student/dashboard'))
  expect(fetch.mock.calls.some(([url]) => url === '/api/faculty/dashboard')).toBe(false)
})

test('expired sessions redirect to the matching login', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: url.endsWith('/config'), status: 401, json: async () => url.endsWith('/config') ? { domain: 'aitpune.edu.in' } : { error: 'Session expired' } })))
  render(<App />)
  await screen.findByLabelText('College email address')
  expect(window.location.pathname).toBe('/login/faculty')
})


test('root opens login directly and students can switch to faculty sign in', async () => {
  window.history.replaceState({}, '', '/')
  mock(() => ({ domain: 'aitpune.edu.in' }))
  render(<App />)
  await screen.findByLabelText('College email address')
  expect(window.location.pathname).toBe('/login/student')
  expect(screen.queryByText('Leave, without the paperwork.')).toBeNull()
  await userEvent.click(screen.getByRole('link', { name: 'Faculty' }))
  expect(window.location.pathname).toBe('/login/faculty')
  expect(screen.getByLabelText('Password')).toBeTruthy()
})

test('old faculty portal URL opens faculty login', async () => {
  window.history.replaceState({}, '', '/portal/faculty')
  mock(() => ({ domain: 'aitpune.edu.in' }))
  render(<App />)
  await screen.findByLabelText('College email address')
  expect(window.location.pathname).toBe('/login/faculty')
})
