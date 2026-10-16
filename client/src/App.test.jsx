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
    if (url.endsWith('/approvers')) return { approvers: [{id:'c',role:'COUNSELOR',name:'Counselor A',department:'Computing'},{id:'h',role:'HOD',name:'HOD A',department:'Computing'},{id:'w',role:'WARDEN',name:'Warden A',department:'Hostel'},{id:'d',role:'DIRECTOR',name:'Director A',department:'Administration'}] }
    if (url.endsWith('/applications/leave')) { expect(options.body.get('is_urgent')).toBe('true'); expect(options.body.get('class_teacher_id')).toBe('c'); expect(options.body.get('hod_id')).toBe('h'); expect(options.body.get('warden_id')).toBe('w'); expect(options.body.has('proof')).toBe(false); return application }
    return application
  })
  render(<App />); const user = userEvent.setup()
  await user.selectOptions(await screen.findByLabelText('Leave type'),'Personal')
  expect(screen.getByRole('button',{name:'Submit leave →'}).disabled).toBe(true)
  await user.selectOptions(screen.getByLabelText('Class Teacher / Counselor'),'c')
  await user.selectOptions(screen.getByLabelText('HOD'),'h')
  await user.selectOptions(screen.getByLabelText('Warden'),'w')
  await user.type(screen.getByLabelText('From date'),'2026-10-20')
  await user.type(screen.getByLabelText('To date'),'2026-10-21')
  await user.type(screen.getByLabelText('Reason'),'A family appointment')
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button',{name:'Submit leave →'}))
  await screen.findByText('Leave application')
  expect(screen.getAllByText('Awaiting signature').length).toBeGreaterThan(0)
  expect(window.location.pathname).toBe('/applications/abc')
})
test('protected routes wait for the cached session and unrelated 401 stays inline', async()=>{
  window.history.replaceState({},'','/student/dashboard')
  let resolveSession
  const session=new Promise(resolve=>{resolveSession=resolve})
  vi.stubGlobal('fetch',vi.fn(async url=>{
    if(url.endsWith('/session'))return {ok:true,json:async()=>session}
    if(url.endsWith('/config'))return {ok:true,json:async()=>({domain:'aitpune.edu.in'})}
    if(url.endsWith('/activity'))return {ok:true,json:async()=>({idleExpiresAt:Date.now()+1800000})}
    return {ok:false,status:401,json:async()=>({error:'Home summary unavailable'})}
  }))
  render(<App />)
  await screen.findByText('Checking your session…')
  expect(window.location.pathname).toBe('/student/dashboard')
  resolveSession({user:{name:'Student',role:'student',email:'student_123456@aitpune.edu.in'}})
  await screen.findByText(/Home summary unavailable/)
  expect(window.location.pathname).toBe('/student/dashboard')
  const user=userEvent.setup();await user.click(screen.getAllByRole('link',{name:'Profile',exact:true})[0])
  await screen.findByText('Your profile')
  expect(fetch.mock.calls.filter(([url])=>url.endsWith('/session')).length).toBe(1)
})
test('logout clears cached session and returns to login',async()=>{
  window.history.replaceState({},'','/student/profile')
  mock(url=>url.endsWith('/config')?{domain:'aitpune.edu.in',directLogin:true}:url.endsWith('/logout')?{message:'Signed out'}:{user:{role:'student',name:'Student',email:'student_123456@aitpune.edu.in'}})
  render(<App />);await screen.findByText('Your profile');const user=userEvent.setup()
  await user.click(screen.getByLabelText('Account menu'))
  await user.click(screen.getByRole('button',{name:'Logout'}))
  await screen.findByLabelText('College email address')
  expect(window.location.pathname).toBe('/login/student')
  expect(fetch.mock.calls.some(([url])=>url.endsWith('/logout'))).toBe(true)
})
