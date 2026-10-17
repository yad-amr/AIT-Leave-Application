import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { SessionContext } from './session'
export default function SessionProvider({ children }) {
  const [session,setSession] = useState({ status:'loading',user:null,error:'' })
  const pending = useRef(null), generation = useRef(0)
  const check = useCallback(() => {
    if (pending.current) return pending.current
    const current = generation.current
    pending.current = api('/auth/session').then(data=>{ if(current===generation.current) setSession({ ...data,status:'authenticated',error:'' }) }).catch(e=>{ if(current===generation.current) setSession(s=>e.status===401 ? {status:'anonymous',user:null,error:''} : {...s,status:s.user?'authenticated':'error',error:e.message}) }).finally(()=>{pending.current=null})
    return pending.current
  },[])
  useEffect(()=>{ void check() },[check])
  const signIn = async (path,body) => { const data = await api(path,body); generation.current++; setSession({...data,status:'authenticated',error:''}); return data }
  const logout = async () => { await api('/auth/logout',{}); generation.current++; setSession({status:'anonymous',user:null,error:''}) }
  useEffect(()=>{
    if(session.status!=='authenticated') return
    let timer, trailing, activityPending=false, lastSent=0, stopped=false
    const idleMs=session.idleTimeoutMs || 30*60000
    const activityInterval=Math.min(60000,idleMs/2)
    let idleDeadline=session.idleExpiresAt || Date.now()+idleMs
    const absoluteDeadline=session.expiresAt || Date.now()+8*3600000
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void check(),Math.max(0,Math.min(idleDeadline,absoluteDeadline)-Date.now()+50))}
    const sendActivity=()=>{
      if(stopped)return
      if(activityPending){trailing=setTimeout(sendActivity,1000);return}
      activityPending=true; lastSent=Date.now()
      api('/auth/activity',{}).then(data=>{if(stopped)return;idleDeadline=data.idleExpiresAt || idleDeadline;schedule()}).catch(e=>{if(stopped)return;if(e.status===401)void check();else setSession(s=>({...s,error:e.message}))}).finally(()=>{activityPending=false})
    }
    const activity=()=>{
      if(Date.now()>=Math.min(idleDeadline,absoluteDeadline)) {void check();return}
      idleDeadline=Date.now()+idleMs; schedule()
      clearTimeout(trailing)
      if(Date.now()-lastSent<activityInterval) {trailing=setTimeout(sendActivity,activityInterval-(Date.now()-lastSent));return}
      sendActivity()
    }
    const events=['pointerdown','keydown','touchstart','scroll']
    for(const event of events)window.addEventListener(event,activity,{passive:true})
    schedule()
    return ()=>{stopped=true;clearTimeout(trailing);clearTimeout(timer);for(const event of events)window.removeEventListener(event,activity)}
  },[session.status,session.expiresAt,session.idleExpiresAt,session.idleTimeoutMs,check])
  return <SessionContext.Provider value={{...session,signIn,logout,retry:check}}>{children}</SessionContext.Provider>
}
