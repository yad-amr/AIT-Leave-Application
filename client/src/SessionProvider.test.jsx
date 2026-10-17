// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import SessionProvider from './SessionProvider'
import { useSession } from './session'
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
function Probe(){const session=useSession();return <p>{session.status}</p>}
test('one initial check in StrictMode; activity resets idle deadline and only session 401 signs out',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T12:00:00Z'))
  const idleMs=30*60000,expiresAt=Date.now()+8*3600000;let idleExpiresAt=Date.now()+idleMs
  vi.stubGlobal('fetch',vi.fn(async url=>{
    if(url.endsWith('/activity'))idleExpiresAt=Date.now()+idleMs
    const expired=Date.now()>=Math.min(idleExpiresAt,expiresAt)
    return {ok:!expired,status:expired?401:200,json:async()=>expired?{error:'Session expired'}:{user:{role:'student',name:'Student'},expiresAt,idleExpiresAt,idleTimeoutMs:idleMs}}
  }))
  render(<StrictMode><SessionProvider><Probe /></SessionProvider></StrictMode>)
  await act(async()=>{})
  expect(screen.getByText('authenticated')).toBeTruthy()
  expect(fetch.mock.calls.filter(([url])=>url.endsWith('/session')).length).toBe(1)
  await act(async()=>vi.advanceTimersByTime(29*60000))
  await act(async()=>fireEvent.pointerDown(window))
  await act(async()=>vi.advanceTimersByTime(29*60000))
  expect(screen.getByText('authenticated')).toBeTruthy()
  await act(async()=>vi.advanceTimersByTime(60001+100))
  expect(screen.getByText('anonymous')).toBeTruthy()
})
