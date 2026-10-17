// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentDashboard from './StudentDashboard'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function setup(requests) {
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: true, json: async () =>
    url.endsWith('/approvers') ? { approvers: { warden: [], counsellor: [], hod: [], jointDirector: null } } :
    url.endsWith('/leave-types') ? { types: ['Personal leave'] } : { requests },
  })))
  render(<StudentDashboard user={{ name: 'Student', email: 'student_123456@aitpune.edu.in' }} onSignOut={() => {}} />)
}
const request = { id: 'one', reference: 'LR-ONE', applicationType: 'leave', leaveType: 'Personal leave', startDate: '2026-11-01', endDate: '2026-11-02', reason: 'Family visit', approvalHistory: [] }

test('request arrows open the selected request approval progress', async () => {
  setup([{ ...request, id: 'done', status: 'approved' }, { ...request, status: 'pending_hod' }])
  const user = userEvent.setup()
  await screen.findAllByRole('button', { name: 'View LR-ONE' })
  await user.click(screen.getByRole('tab', { name: 'In review' }))
  await user.click(screen.getByRole('button', { name: 'View LR-ONE' }))
  expect(screen.getByText('TRACK REQUEST').closest('.list-header')).toBeTruthy()
  expect(document.querySelector('.review-banner')).toBeNull()
  const dialog = screen.getByRole('dialog', { name: 'Request details' })
  expect(within(dialog).getByText('With HOD')).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Close details' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('request arrow opens completed approval history', async () => {
  setup([{ ...request, status: 'approved' }])
  await screen.findByRole('button', { name: 'View LR-ONE' })
  await userEvent.click(screen.getByRole('button', { name: 'View LR-ONE' }))
  expect(within(screen.getByRole('dialog')).getByText('4 of 4 complete')).toBeTruthy()
})

test('tracking heading is static and empty lists have no request arrows', async () => {
  setup([])
  await screen.findByText('No requests in this view yet.')
  expect(screen.getByText('TRACK REQUEST').tagName).toBe('SPAN')
  expect(screen.queryByRole('button', { name: /^View LR-/ })).toBeNull()
})

test('student sidebar can be closed and reopened without losing sign out', async () => {
  setup([])
  await screen.findByText('No requests in this view yet.')
  const user = userEvent.setup()
  expect(screen.getByRole('button', { name: 'Open sidebar' }).getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Open sidebar' }))
  await user.click(screen.getAllByRole('button', { name: 'Close sidebar' })[0])
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Open sidebar' }))
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
})

test('profile shows account information and can return to the overview', async () => {
  setup([])
  await screen.findByText('No requests in this view yet.')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Open sidebar' }))
  await user.click(screen.getByRole('button', { name: 'Profile', exact: true }))
  expect(screen.getByRole('heading', { name: 'Your profile' })).toBeTruthy()
  expect(screen.getByText('College email')).toBeTruthy()
  expect(screen.getAllByText('student_123456@aitpune.edu.in').length).toBeGreaterThan(0)
  expect(screen.queryByRole('heading', { name: 'Leave requests' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Overview', exact: true }))
  expect(screen.getByRole('heading', { name: 'Leave requests' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'View profile' }))
  expect(screen.getByRole('heading', { name: 'Your profile' })).toBeTruthy()
})

test('profile has a direct back action and the logo returns to dashboard', async () => {
  setup([])
  await screen.findByText('No requests in this view yet.')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'View profile' }))
  await user.click(screen.getByRole('button', { name: /Back to dashboard/ }))
  expect(screen.getByRole('heading', { name: 'Leave requests' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'View profile' }))
  await user.click(screen.getByRole('button', { name: 'Open sidebar' }))
  await user.click(screen.getByRole('button', { name: 'Smart Leave dashboard home' }))
  expect(screen.getByRole('heading', { name: 'Leave requests' })).toBeTruthy()
})

test('new leave request collects a phone number without a destination field', async () => {
  setup([])
  await screen.findByText('No requests in this view yet.')
  await userEvent.click(screen.getByRole('button', { name: /New leave request/ }))
  const dialog = screen.getByRole('dialog', { name: 'Request leave' })
  expect(within(dialog).getByLabelText('Student phone number')).toBeTruthy()
  expect(within(dialog).queryByLabelText('Destination')).toBeNull()
})
