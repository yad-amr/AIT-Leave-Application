// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })

test('home page opens the student and faculty portals without login', async () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Leave, without the paperwork.' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Open student portal' }).getAttribute('href')).toBe('/portal/student')
  expect(screen.getByRole('link', { name: 'Open faculty portal' }).getAttribute('href')).toBe('/portal/faculty')
  expect(screen.getByRole('link', { name: 'For an Enquiry' }).getAttribute('href')).toBe('https://www.aitpune.com/Contact-Us.aspx')
  expect(screen.getByText('Site Updated On :01 Mar 2026')).toBeTruthy()
  expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
})

test('student can submit a local demo token and find it in the faculty portal', async () => {
  window.history.replaceState({}, '', '/portal/student')
  render(<App />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'New leave request +' }))
  await user.type(screen.getByLabelText('Destination'), 'Pune')
  await user.type(screen.getByLabelText('From'), '2026-11-10')
  await user.type(screen.getByLabelText('To'), '2026-11-11')
  await user.type(screen.getByLabelText('Reason for leave'), 'Family visit')
  await user.click(screen.getByRole('button', { name: 'Submit demo request' }))
  expect((await screen.findAllByText(/AIT-DEMO-/)).length).toBeGreaterThan(0)
  expect(screen.getByText('Demo portal')).toBeTruthy()
  await user.click(screen.getByRole('link', { name: 'Faculty portal' }))
  expect((await screen.findAllByText(/AIT-DEMO-/)).length).toBeGreaterThan(0)
  expect(screen.getAllByRole('button', { name: 'Approve' }).length).toBeGreaterThan(0)
})

test('faculty can switch approval stage and see response logs', async () => {
  window.history.replaceState({}, '', '/portal/faculty')
  render(<App />)
  const user = userEvent.setup()
  expect(await screen.findByText('AIT-DEMO-2026-001')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Approve' }))
  expect(await screen.findByText('You’re all caught up.')).toBeTruthy()
  await user.selectOptions(screen.getByLabelText('Review as'), 'counsellor')
  expect(await screen.findByText('AIT-DEMO-2026-001')).toBeTruthy()
  await user.selectOptions(screen.getByLabelText('Review as'), 'warden')
  await user.click(screen.getByRole('button', { name: 'Logs' }))
  expect(await screen.findByText(/Approved · Warden/)).toBeTruthy()
})

test('legacy dashboard paths open the portal directly', async () => {
  window.history.replaceState({}, '', '/faculty/dashboard')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Warden portal' })).toBeTruthy()
  expect(window.location.pathname).toBe('/portal/faculty')
})
