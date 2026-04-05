'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, StatGrid, StatCard, Btn, Toast } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { DailyLog } from '@/types'
import { last30Days, formatDate, formatDateLong } from '@/lib/utils'

export default function AdherencePage() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [userId, setUserId] = useState('')
  const [toast, setToast] = useState('')
  const [excuseDate, setExcuseDate] = useState<string|null>(null)
  const [excuseText, setExcuseText] = useState('')
  const supabase = createClient()
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      supabase.from('daily_logs').select('*').eq('user_id', data.user.id)
        .gte('date', last30Days()[0]).order('date', { ascending: false })
        .then(({ data: l }) => { if (l) setLogs(l) })
    })
  }, [])

  const days = last30Days()
  const logMap = Object.fromEntries(logs.map(l => [l.date, l]))

  const wiCount = days.filter(d => logMap[d]?.weight != null || logMap[d]?.excuse_wi).length
  const logCount = days.filter(d => logMap[d]?.calories != null || logMap[d]?.excuse_log).length
  const suppCount = days.filter(d => logMap[d]?.creatine === true || logMap[d]?.excuse_supp).length

  async function saveExcuse() {
    if (!excuseDate || !excuseText.trim()) return
    const { error } = await supabase.from('daily_logs').upsert({
      user_id: userId, date: excuseDate,
      excuse_wi: excuseText, excuse_log: excuseText, excuse_supp: true,
    }, { onConflict: 'user_id,date' })
    if (!error) {
      const { data } = await supabase.from('daily_logs').select('*').eq('user_id', userId).gte('date', last30Days()[0]).order('date', { ascending: false })
      if (data) setLogs(data)
      showToast('Excuse saved ✓')
    }
    setExcuseDate(null); setExcuseText('')
  }

  const pct = (n:number) => Math.round(n/30*100)
  const variant = (n:number) => pct(n) >= 90 ? 'good' : pct(n) >= 70 ? 'warn' : 'bad'

  return (
    <AppLayout>
      <PageHeader title="ADHERENCE" accent="TRACKER" sub="30-day daily habits" />

      <StatGrid cols={3}>
        <StatCard label="Weigh-ins (30d)" value={wiCount} unit="/30" tag={`${pct(wiCount)}% adherence`} tagVariant={variant(wiCount)} />
        <StatCard label="Days Logged (30d)" value={logCount} unit="/30" tag={`${pct(logCount)}% adherence`} tagVariant={variant(logCount)} />
        <StatCard label="Supplements (30d)" value={suppCount} unit="/30" tag={`${pct(suppCount)}% adherence`} tagVariant={variant(suppCount)} />
      </StatGrid>

      <Panel>
        <PanelTitle>Daily Habit Log</PanelTitle>
        <PanelSub>Last 30 days · tap Mark to log · add Excuse to rectify a missed day</PanelSub>

        <div style={{ display:'grid',gridTemplateColumns:'1fr 80px 80px 90px 100px',gap:'0',marginBottom:'8px',paddingBottom:'8px',borderBottom:'1px solid var(--b1)' }}>
          {['Date','Weigh-in','Logged','Supps',''].map(h=>(
            <div key={h} style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',padding:'0 4px 0 0' }}>{h}</div>
          ))}
        </div>

        {days.map(d => {
          const e = logMap[d] || {}
          const hasWi = e.weight != null
          const hasLog = e.calories != null
          const hasSupp = e.creatine === true
          const hasWiEx = !!e.excuse_wi
          const hasLogEx = !!e.excuse_log
          const hasSuppEx = !!e.excuse_supp
          const isToday = d === new Date().toISOString().split('T')[0]
          const anyMissed = !hasWi && !hasWiEx || !hasLog && !hasLogEx || !hasSupp && !hasSuppEx
          return (
            <div key={d} style={{ display:'grid',gridTemplateColumns:'1fr 80px 80px 90px 100px',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--b1)' }}>
              <div>
                <span style={{ fontSize:'11px',letterSpacing:'1px' }}>{formatDate(d)}</span>
                {isToday && <span style={{ fontSize:'8px',color:'var(--or2)',marginLeft:'6px' }}>today</span>}
              </div>
              {[
                { has: hasWi, hasEx: hasWiEx, label: 'wi' },
                { has: hasLog, hasEx: hasLogEx, label: 'log' },
                { has: hasSupp, hasEx: hasSuppEx, label: 'supp' },
              ].map(({ has, hasEx }) => (
                <div key={has+hasEx.toString()}>
                  {has ? <span style={{ color:'#4ade80',fontSize:'12px' }}>✓</span> :
                   hasEx ? <span style={{ color:'#fcd34d',fontSize:'9px',letterSpacing:'1px' }}>~exc</span> :
                   <span style={{ color:'var(--mu2)',fontSize:'9px' }}>—</span>}
                </div>
              ))}
              <div>
                {anyMissed && (
                  <button onClick={()=>setExcuseDate(d)} style={{ fontFamily:'DM Mono',fontSize:'8px',letterSpacing:'1px',textTransform:'uppercase',color:'var(--am)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline' }}>
                    + Excuse
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </Panel>

      {/* Excuse modal */}
      {excuseDate && (
        <div style={{ position:'fixed',inset:0,background:'rgba(5,13,26,.85)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ background:'var(--s1)',border:'1px solid var(--b2)',padding:'28px',width:'90%',maxWidth:'420px' }}>
            <div style={{ fontFamily:'Bebas Neue',fontSize:'20px',letterSpacing:'2px',marginBottom:'6px' }}>Rectify Missed Day</div>
            <div style={{ fontSize:'9px',color:'var(--mu)',letterSpacing:'1px',marginBottom:'16px' }}>{formatDateLong(excuseDate)}</div>
            <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>Reason / Excuse</label>
            <textarea value={excuseText} onChange={e=>setExcuseText(e.target.value)} placeholder="e.g. Travelling — no scale access" style={{ width:'100%',minHeight:'80px',background:'var(--s2)',border:'1px solid var(--b2)',color:'var(--tx)',padding:'10px',fontSize:'12px',fontFamily:'DM Mono',resize:'vertical',outline:'none',marginBottom:'16px' }} />
            <div style={{ display:'flex',gap:'10px' }}>
              <Btn variant="primary" onClick={saveExcuse}>Save Excuse</Btn>
              <Btn variant="ghost" onClick={()=>{setExcuseDate(null);setExcuseText('')}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
