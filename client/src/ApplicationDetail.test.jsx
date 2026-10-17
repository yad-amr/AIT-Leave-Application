// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ApplicationDetail from './ApplicationDetail'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
function application(status='SUBMITTED') {
  return { id:'test-id',type:'OUTPASS',status,display_state:status==='SUBMITTED'?'IN_PROGRESS':status,can_cancel:status==='SUBMITTED',created_at:'2026-10-16T12:00:00Z',fields:{reason:'Visit family'},steps:[{role:'warden',approver_name:'Demo Warden',department:'Hostel A',display_state:status==='SUBMITTED'?'CURRENT':status==='CANCELLED'?'STOPPED':status,decision:['APPROVED','REJECTED'].includes(status)?status:undefined,decided_at:status==='SUBMITTED'?undefined:'2026-10-16T13:00:00Z',comment:status==='REJECTED'?'Please revise the dates':'Reviewed',signature_data:status==='SUBMITTED'?undefined:'Demo Warden'}],history:[{event:'SUBMITTED',timestamp:'2026-10-16T12:00:00Z'}] }
}
function mount(api) { return render(<MemoryRouter><ApplicationDetail id="test-id" api={api} /></MemoryRouter>) }
test('outpass shows assigned current node, expands details and confirms cancellation',async()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','')}})
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open')}})
  const api=vi.fn(async(path,body)=>application(body?'CANCELLED':'SUBMITTED'))
  const {container}=mount(api);const user=userEvent.setup()
  await screen.findByText('Outpass application')
  expect(container.querySelectorAll('.approval-stepper > li').length).toBe(3)
  expect(container.querySelector('[aria-current="step"]').textContent).toContain('Demo Warden')
  await user.click(container.querySelector('.step-details summary'))
  expect(container.querySelector('.step-details').open).toBe(true)
  await user.click(screen.getByRole('button',{name:'Cancel application'}))
  expect(api).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button',{name:'Keep application'}))
  expect(api).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button',{name:'Cancel application'}))
  await user.click(screen.getByRole('button',{name:'Yes, cancel application'}))
  await screen.findByText('Application cancelled')
  expect(screen.queryByRole('button',{name:'Cancel application'})).toBeNull()
})
test.each(['APPROVED','REJECTED','CANCELLED'])('%s has a terminal banner and no cancel action',async status=>{
  const {container}=mount(vi.fn(async()=>application(status)))
  await screen.findByText('Outpass application')
  expect(screen.queryByRole('button',{name:'Cancel application'})).toBeNull()
  expect(container.querySelector('[aria-current="step"]')).toBeNull()
  if(status==='APPROVED') expect(screen.getByText('All approvals complete ✓')).toBeTruthy()
  if(status==='REJECTED') expect(screen.getByText('Rejected by Demo Warden')).toBeTruthy()
  if(status==='CANCELLED') expect(screen.getByText('Application cancelled')).toBeTruthy()
})
test('not found response has a neutral message',async()=>{
  mount(vi.fn(async()=>{throw Object.assign(new Error('Application not found.'),{status:404})}))
  await screen.findByRole('heading',{name:'Application not found'})
  expect(screen.queryByRole('button',{name:'Retry'})).toBeNull()
})
test('timeline is initially collapsed on mobile',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true}))
  const {container}=mount(vi.fn(async()=>application()))
  await waitFor(()=>expect(container.querySelector('.status-history')).toBeTruthy())
  expect(container.querySelector('.status-history').open).toBe(false)
  vi.unstubAllGlobals()
})
