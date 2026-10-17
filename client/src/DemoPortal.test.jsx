// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DemoPortal from './DemoPortal'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })

test('home page links to student and faculty sign in', async () => {
  render(<DemoPortal />)
  expect(screen.getByRole('heading', { name: 'Leave, without the paperwork.' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Student demo' })).toBeNull()
  expect(screen.queryByText('Explore the local demo')).toBeNull()
  expect(screen.getByRole('link', { name: 'For an Enquiry' }).getAttribute('href')).toBe('https://www.aitpune.com/Contact-Us.aspx')
  expect(screen.getByText('Site Updated On :01 Mar 2026')).toBeTruthy()
  expect(screen.getAllByRole('link', { name: 'Student sign in' })).toHaveLength(2)
})

test('faculty can switch approval stage and see response logs', async () => {
  window.history.replaceState({}, '', '/portal/faculty')
  render(<DemoPortal />)
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

test('faculty demo route remains available separately from signed-in pages', async () => {
  window.history.replaceState({}, '', '/portal/faculty')
  render(<DemoPortal />)
  expect(await screen.findByRole('heading', { name: 'Warden portal' })).toBeTruthy()
  expect(window.location.pathname).toBe('/portal/faculty')
})
