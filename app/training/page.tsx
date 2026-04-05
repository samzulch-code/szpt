'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, StatGrid, StatCard, Btn, Input, Select, Toast } from '@/components/ui'
import { createClient } from '@/lib/supabase'

interface HevyWorkout { name: string; start_time: number; duration: number; exercises: { sets: { weight_kg: number; reps: number }[] }[] }

export default function TrainingPage() {
  const [apiKey, setApiKey] = useState('')
  const [method, setMethod] = useState('direct')
  const [connected, setConnected] = useState(false)
  const [workouts, setWorkouts] = useState<HevyWorkout[]>([])
  const [status, setStatus] = useState('')
  const [userId, setUserId] = useState('')
  const [toast, setToast] = useState('')
  const supabase = createClient()
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: p } = await supabase.from('profiles').select('hevy_api_key').eq('id', data.user.id).single()
      if (p?.hevy_api_key) { setApiKey(p.hevy_api_key); fetchWorkouts(p.hevy_api_key, 'direct') }
    })
  }, [])

  async function connect() {
    if (!apiKey) return
    await supabase.from('profiles').update({ hevy_api_key: apiKey }).eq('id', userId)
    fetchWorkouts(apiKey, method)
  }

  async function fetchWorkouts(key: string, m: string) {
    setStatus('Connecting to Hevy...')
    const base = 'https://api.hevyapp.com/v1/workouts?page=1&pageSize=20'
    let url = base, opts: RequestInit = { headers: { 'api-key': key, 'Accept': 'application/json' } }
    if (m === 'proxy1') { url = 'https://corsproxy.io/?' + encodeURIComponent(base); opts = { headers: { 'api-key': key, 'Accept': 'application/json', 'x-requested-with': 'XMLHttpRequest' } } }
    if (m === 'proxy2') { url = 'https://api.allorigins.win/get?url=' + encodeURIComponent(base); opts = {} }
    try {
      const r = await fetch(url, opts)
      if (r.status === 401 || r.status === 403) throw new Error('Invalid API key — check Hevy Settings → Developer API')
      if (!r.ok) throw new Error(`Error ${r.status} — try a proxy method`)
      const j = await r.json()
      const wkts = m === 'proxy2' ? JSON.parse(j.contents).workouts || [] : j.workouts || []
      setWorkouts(wkts); setConnected(true)
      setStatus(wkts.length + ' workouts loaded')
    } catch (err: any) {
      setStatus('⚠ ' + err.message)
      setConnected(false)
    }
  }

  const totalVol = workouts.reduce((acc, w) => acc + w.exercises.reduce((ea, ex) => ea + ex.sets.reduce((sa, s) => sa + (s.weight_kg * s.reps || 0), 0), 0), 0)
  const totalDur = workouts.reduce((acc, w) => acc + (w.duration || 0), 0)

  return (
    <AppLayout>
      <PageHeader title="HEVY" accent="TRAINING" sub="Synced from your Hevy account" />

      {!connected ? (
        <div style={{ maxWidth:'520px',margin:'0 auto' }}>
          <Panel>
            <PanelTitle>Connect Hevy</PanelTitle>
            <PanelSub>Sync your training data</PanelSub>

            <div style={{ background:'var(--s2)',border:'1px solid var(--b2)',padding:'16px',marginBottom:'16px' }}>
              <div style={{ fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--or)',marginBottom:'8px' }}>Get your API key</div>
              <div style={{ fontSize:'10px',color:'var(--mu)',lineHeight:1.8 }}>
                Open Hevy → <strong style={{ color:'var(--tx)' }}>Settings</strong> → <strong style={{ color:'var(--tx)' }}>Developer API</strong> → Copy key<br />
                <span style={{ color:'var(--am)' }}>⚠ Requires Hevy Pro subscription</span>
              </div>
            </div>

            <div style={{ background:'var(--s2)',border:'1px solid var(--b2)',padding:'16px',marginBottom:'16px' }}>
              <div style={{ fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--or)',marginBottom:'8px' }}>If you get a CORS error</div>
              <div style={{ fontSize:'10px',color:'var(--mu)',lineHeight:1.8 }}>
                Run in Terminal: <code style={{ background:'var(--s3)',padding:'2px 6px',color:'var(--or2)',fontSize:'9px' }}>cd ~/Downloads && python3 -m http.server 8080</code><br />
                Then open <a href="http://localhost:8080" target="_blank" style={{ color:'var(--bl)' }}>localhost:8080</a> instead of opening the file directly.
              </div>
            </div>

            <Input label="API Key" value={apiKey} onChange={setApiKey} placeholder="e1c5f07d-a86a-41e9-af02-..." />
            <Select label="Connection Method" value={method} onChange={setMethod} options={[{value:'direct',label:'Direct — use when on localhost'},{value:'proxy1',label:'corsproxy.io — try if Direct fails'},{value:'proxy2',label:'allorigins.win — backup proxy'}]} />
            {status && <div style={{ marginBottom:'12px',fontSize:'10px',color:status.startsWith('⚠')?'#fca5a5':'var(--mu)' }}>{status}</div>}
            <Btn variant="primary" onClick={connect} fullWidth>Connect Hevy →</Btn>
          </Panel>
        </div>
      ) : (
        <>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px' }}>
            <div>
              <div style={{ fontSize:'8px',letterSpacing:'2px',color:'var(--gr)',textTransform:'uppercase' }}>● Connected</div>
              <div style={{ fontSize:'11px',color:'var(--mu)',marginTop:'3px' }}>{status}</div>
            </div>
            <div style={{ display:'flex',gap:'10px' }}>
              <Btn variant="outline" onClick={()=>fetchWorkouts(apiKey,method)}>↻ Refresh</Btn>
              <Btn variant="danger" onClick={()=>{setConnected(false);setWorkouts([])}}>Disconnect</Btn>
            </div>
          </div>

          <StatGrid cols={4}>
            <StatCard label="Workouts Loaded" value={workouts.length} />
            <StatCard label="Total Volume" value={totalVol > 0 ? (totalVol/1000).toFixed(1) : '—'} unit="t" />
            <StatCard label="Avg Duration" value={workouts.length ? Math.round(totalDur/workouts.length/60) : '—'} unit="min" />
            <StatCard label="Last Session" value={workouts[0] ? new Date(workouts[0].start_time*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'} />
          </StatGrid>

          <Panel>
            <PanelTitle>Recent Workouts</PanelTitle>
            <PanelSub>From Hevy</PanelSub>
            {workouts.slice(0,10).map((w,i) => {
              const d = new Date(w.start_time*1000)
              const vol = w.exercises.reduce((a,ex)=>a+ex.sets.reduce((b,s)=>b+(s.weight_kg*s.reps||0),0),0)
              return (
                <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:'16px',padding:'12px 0',borderBottom:'1px solid var(--b1)' }}>
                  <div style={{ width:'52px' }}>
                    <div style={{ fontSize:'8px',letterSpacing:'1px',color:'var(--mu)',textTransform:'uppercase' }}>{d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
                    <div style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--or)',lineHeight:1.1 }}>{d.toLocaleDateString('en-GB',{weekday:'short'}).toUpperCase()}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'12px',letterSpacing:'1px',marginBottom:'3px' }}>{w.name||'Workout'}</div>
                    <div style={{ fontSize:'9px',color:'var(--mu)',letterSpacing:'1px' }}>{w.exercises.length} exercises · {Math.round((w.duration||0)/60)} min</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'Bebas Neue',fontSize:'22px' }}>{vol?(vol/1000).toFixed(1):'—'}</div>
                    <div style={{ fontSize:'8px',color:'var(--mu)' }}>tonnes</div>
                  </div>
                </div>
              )
            })}
          </Panel>
        </>
      )}
      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
