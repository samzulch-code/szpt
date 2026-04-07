'use client'
import { useEffect, useState, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, StatGrid, StatCard, PageHeader, Toast } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { DailyLog, Plan } from '@/types'
import { last7Days, avg, formatDate } from '@/lib/utils'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

// ── Journey unlock thresholds ──────────────────────────
const UNLOCKS = [
  { id: 'cal',     label: 'Avg Calories',      day: 1  },
  { id: 'prot',    label: 'Avg Protein',        day: 3  },
  { id: 'cpr',     label: 'Cal:Protein Ratio',  day: 7  },
  { id: 'creatine',label: 'Creatine Streak',    day: 11 },
  { id: 'trend',   label: 'Weight Trend',       day: 14 },
]

function calcJourneyStreak(logs: DailyLog[]): number {
  // Consecutive days with calories logged, working back from yesterday
  // Miss 2 in a row = reset
  let streak = 0
  let missedInRow = 0
  for (let i = 1; i <= 90; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const logged = logs.find(l => l.date === ds && l.calories != null)
    if (logged) { streak++; missedInRow = 0 }
    else {
      missedInRow++
      if (missedInRow >= 2) break
    }
  }
  return streak
}

function getUnlocked(streak: number): Set<string> {
  const s = new Set<string>()
  for (const u of UNLOCKS) { if (streak >= u.day) s.add(u.id) }
  return s
}

// ── Daily prompt modal ─────────────────────────────────
function DailyPrompt({ onLog, onDismiss }: { onLog: () => void; onDismiss: () => void }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(5,13,26,.92)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px' }}>
      <div style={{ background:'var(--s1)',border:'1px solid var(--or)',maxWidth:'420px',width:'100%',padding:'32px',textAlign:'center' }}>
        <div style={{ fontFamily:'Bebas Neue',fontSize:'48px',letterSpacing:'4px',color:'var(--or)',lineHeight:1,marginBottom:'8px' }}>LOG TODAY</div>
        <div style={{ fontSize:'9px',letterSpacing:'3px',textTransform:'uppercase',color:'var(--mu)',marginBottom:'24px' }}>
          {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
        </div>
        <div style={{ background:'var(--s2)',border:'1px solid var(--b1)',padding:'16px',marginBottom:'24px',textAlign:'left' }}>
          <div style={{ fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'10px' }}>Today's check-in</div>
          {['Calories','Protein (g)','Weight (kg)','Steps','Creatine'].map(item => (
            <div key={item} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--b1)',fontSize:'10px',color:'var(--mu)' }}>
              <span>{item}</span>
              <span style={{ color:'var(--mu2)' }}>→ log now</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex',gap:'10px' }}>
          <button onClick={onLog} style={{ flex:1,padding:'12px',background:'var(--or)',border:'none',color:'#050d1a',fontFamily:'DM Mono',fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',cursor:'pointer' }}>
            Log Now →
          </button>
          <button onClick={onDismiss} style={{ padding:'12px 16px',background:'transparent',border:'1px solid var(--b2)',color:'var(--mu)',fontFamily:'DM Mono',fontSize:'9px',cursor:'pointer' }}>
            Later
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Locked card ────────────────────────────────────────
function LockedCard({ label, unlockDay, currentStreak }: { label: string; unlockDay: number; currentStreak: number }) {
  const daysLeft = unlockDay - currentStreak
  return (
    <div style={{ background:'var(--s1)',padding:'18px 16px',position:'relative',overflow:'hidden',opacity:0.6 }}>
      <div style={{ fontSize:'7px',letterSpacing:'3px',textTransform:'uppercase',color:'var(--mu)',marginBottom:'7px' }}>{label}</div>
      <div style={{ fontFamily:'Bebas Neue',fontSize:'36px',lineHeight:1,color:'var(--mu2)' }}>🔒</div>
      <div style={{ display:'inline-block',marginTop:'6px',fontSize:'8px',letterSpacing:'1px',padding:'2px 6px',borderLeft:'2px solid var(--mu2)',background:'rgba(100,120,160,.1)',color:'var(--mu)' }}>
        {daysLeft} day{daysLeft !== 1 ? 's' : ''} to unlock
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [toast, setToast] = useState('')
  const [journeyMode, setJourneyMode] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: logsData }, { data: planData }] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id', user.id).order('date'),
      supabase.from('plans').select('*').eq('user_id', user.id).eq('is_active', true).single(),
    ])
    if (logsData) setLogs(logsData)
    if (planData) setPlan(planData)
  }, [])

  useEffect(() => { load() }, [load])

  // Check if today is logged — show prompt in journey mode
  useEffect(() => {
    if (!journeyMode) return
    const todayStr = new Date().toISOString().split('T')[0]
    const todayLogged = logs.find(l => l.date === todayStr && l.calories != null)
    if (!todayLogged && logs.length > 0) setShowPrompt(true)
    else setShowPrompt(false)
  }, [journeyMode, logs])

  const days7 = last7Days()
  const logMap = Object.fromEntries(logs.map(l => [l.date, l]))

  // 7-day averages
  const week = days7.map(d => logMap[d]).filter(Boolean)
  const avgCal   = avg(week.filter(l => l.calories != null).map(l => l.calories!))
  const avgProt  = avg(week.filter(l => l.protein  != null).map(l => l.protein!))
  const avgSteps = avg(week.filter(l => l.steps    != null).map(l => l.steps!))
  const avgWt    = avg(week.filter(l => l.weight   != null).map(l => l.weight!))

  // Previous week avg weight
  const prevWeek7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 7 - (6 - i)); return d.toISOString().split('T')[0]
  })
  const prevWt = avg(prevWeek7.map(d => logMap[d]).filter(Boolean).filter(l => l.weight != null).map(l => l.weight!))
  const wtDiff = avgWt && prevWt ? avgWt - prevWt : null

  // Creatine streak
  let creatineStreak = 0
  for (let i = 0; i < 90; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if (logMap[ds]?.creatine === true) creatineStreak++
    else break
  }

  // Journey streak & unlocks
  const journeyStreak = calcJourneyStreak(logs)
  const unlocked = getUnlocked(journeyStreak)

  // Tag helpers
  function calTag(val: number | null, target: number | null): [string, 'good'|'bad'|'neutral'] {
    if (!val) return ['No data', 'neutral']
    if (!target) return ['Set target', 'neutral']
    return val <= target ? [`✓ ${Math.round(val/target*100)}% of target`, 'good'] : [`✗ over by ${Math.round(val-target)} kcal`, 'bad']
  }
  function hiTag(val: number | null, target: number | null): [string, 'good'|'warn'|'neutral'] {
    if (!val) return ['No data', 'neutral']
    if (!target) return ['Set target', 'neutral']
    return val >= target ? [`✓ ${Math.round(val/target*100)}% of target`, 'good'] : [`↓ ${Math.round(val/target*100)}% of target`, 'warn']
  }

  const [calText, calVar]     = calTag(avgCal, plan?.cal_target ?? null)
  const [protText, protVar]   = hiTag(avgProt, plan?.prot_target ?? null)
  const [stepsText, stepsVar] = hiTag(avgSteps, plan?.steps_target ?? null)

  // Progress bar
  const allWeights = logs.filter(l => l.weight != null && l.weight > 0).sort((a,b) => a.date.localeCompare(b.date))
  const latestW  = allWeights.length ? allWeights[allWeights.length-1].weight! : null
  const startW   = plan?.start_weight ?? null
  const goalW    = plan?.goal_weight ?? null
  const progress = startW && goalW && latestW ? Math.max(0, Math.min(100, (startW-latestW)/(startW-goalW)*100)) : 0
  const currentMarker = startW && goalW && latestW ? Math.max(2, Math.min(98, (startW-latestW)/(startW-goalW)*100)) : null

  // Rate of loss
  let ratePerDay = 0
  if (allWeights.length >= 2) {
    const firstDate = new Date(allWeights[0].date + 'T12:00:00')
    const lastDate  = new Date(allWeights[allWeights.length-1].date + 'T12:00:00')
    const span = Math.max(1, (lastDate.getTime()-firstDate.getTime())/86400000)
    ratePerDay = (allWeights[0].weight! - allWeights[allWeights.length-1].weight!) / span
  }

  // Chart
  const today = new Date()
  const daysToGoal = (latestW && goalW && ratePerDay > 0) ? Math.ceil((latestW-goalW)/ratePerDay) : 180
  const planStartDate = plan?.start_date ? new Date(plan.start_date+'T12:00:00') : new Date(today.getTime()-28*86400000)
  const daysOfHistory = Math.max(28, Math.floor((today.getTime()-planStartDate.getTime())/86400000))
  const allDays = Array.from({ length: Math.min(daysOfHistory+daysToGoal+7, 400) }, (_, i) => {
    const d = new Date(planStartDate); d.setDate(planStartDate.getDate()+i); return d.toISOString().split('T')[0]
  })
  const actualData = allDays.map(d => logMap[d]?.weight ?? null)
  const projData = allDays.map(d => {
    const daysFromToday = (new Date(d+'T12:00:00').getTime()-today.getTime())/86400000
    if (!latestW || !goalW || ratePerDay<=0 || daysFromToday<-1) return null
    const proj = latestW - ratePerDay*daysFromToday
    return proj>=goalW ? parseFloat(proj.toFixed(2)) : null
  })

  // Cal:protein ratio
  const cpr = avgCal && avgProt && avgProt>0 ? (avgCal/avgProt).toFixed(1) : null
  const cprGood = cpr ? parseFloat(cpr)<=10 : null

  // Rolling 7-day avg
  const last56 = Array.from({ length:56 }, (_, i) => { const d=new Date(); d.setDate(d.getDate()-55+i); return d.toISOString().split('T')[0] })
  const rollingData = last56.map((_,i) => {
    const w = last56.slice(Math.max(0,i-6),i+1).filter(d=>logMap[d]?.weight!=null).map(d=>logMap[d].weight!)
    return w.length>=3 ? parseFloat((w.reduce((a,b)=>a+b,0)/w.length).toFixed(2)) : null
  })
  const actualRolling = last56.map(d => logMap[d]?.weight ?? null)

  const chartOpts: any = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:true,labels:{color:'#7b8fb8',font:{family:'DM Mono',size:9},boxWidth:10}}, tooltip:{backgroundColor:'#091428',borderColor:'#f97316',borderWidth:1,titleColor:'#f0f4ff',bodyColor:'#7b8fb8',callbacks:{label:(ctx:any)=>ctx.raw!=null?`${ctx.raw}kg`:''}} },
    scales:{ x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#3d5070',font:{family:'DM Mono',size:8},maxTicksLimit:8}}, y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#7b8fb8',font:{family:'DM Mono',size:9},callback:(v:any)=>v+'kg'}} }
  }

  // ── Journey mode banner ────────────────────────────────
  const nextUnlock = UNLOCKS.find(u => !unlocked.has(u.id))
  const daysToNext = nextUnlock ? nextUnlock.day - journeyStreak : null

  return (
    <AppLayout>
      <PageHeader
        title="7-DAY" accent="OVERVIEW"
        sub={new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
        right={
          <button
            onClick={() => setJourneyMode(j => !j)}
            style={{
              fontFamily:'DM Mono', fontSize:'8px', letterSpacing:'2px', textTransform:'uppercase',
              padding:'8px 16px', cursor:'pointer', transition:'all .15s',
              background: journeyMode ? 'var(--or)' : 'transparent',
              border: journeyMode ? '1px solid var(--or)' : '1px solid var(--b2)',
              color: journeyMode ? '#050d1a' : 'var(--mu)',
            }}
          >
            {journeyMode ? '◈ Journey Mode ON' : '◈ Journey Mode'}
          </button>
        }
      />

      {/* Journey mode header */}
      {journeyMode && (
        <div style={{ background:'var(--s2)',border:'1px solid var(--or)',padding:'14px 20px',marginBottom:'20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'20px' }}>
            <div>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'3px' }}>Consistency Streak</div>
              <div style={{ fontFamily:'Bebas Neue',fontSize:'32px',color:'var(--or)',lineHeight:1 }}>{journeyStreak} day{journeyStreak!==1?'s':''}</div>
            </div>
            <div style={{ width:'1px',height:'40px',background:'var(--b2)' }} />
            <div>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'3px' }}>Unlocked</div>
              <div style={{ fontSize:'11px',color:'var(--tx)' }}>{unlocked.size} / {UNLOCKS.length} metrics</div>
            </div>
            {daysToNext && nextUnlock && (
              <>
                <div style={{ width:'1px',height:'40px',background:'var(--b2)' }} />
                <div>
                  <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'3px' }}>Next Unlock</div>
                  <div style={{ fontSize:'10px',color:'#fcd34d' }}>{nextUnlock.label} in {daysToNext} day{daysToNext!==1?'s':''}</div>
                </div>
              </>
            )}
            {!nextUnlock && (
              <>
                <div style={{ width:'1px',height:'40px',background:'var(--b2)' }} />
                <div style={{ fontSize:'10px',color:'#4ade80' }}>🏆 All metrics unlocked!</div>
              </>
            )}
          </div>
          <div style={{ display:'flex',gap:'6px' }}>
            {UNLOCKS.map(u => (
              <div key={u.id} style={{ width:'8px',height:'8px',borderRadius:'50%',background:unlocked.has(u.id)?'var(--or)':'var(--s4)',border:`1px solid ${unlocked.has(u.id)?'var(--or)':'var(--mu2)'}` }} title={u.label} />
            ))}
          </div>
        </div>
      )}

      {/* PROGRESS BAR */}
      {startW && goalW && latestW && (
        <div style={{ background:'var(--s1)',border:'1px solid var(--b1)',padding:'20px 24px',marginBottom:'20px' }}>
          <div style={{ fontSize:'8px',letterSpacing:'3px',textTransform:'uppercase',color:'var(--mu)',marginBottom:'14px' }}>Phase Progress</div>
          <div style={{ position:'relative',marginBottom:'10px' }}>
            <div style={{ height:'6px',background:'var(--s3)',position:'relative' }}>
              <div style={{ height:'100%',width:`${progress}%`,background:'var(--or)',transition:'width .6s ease' }} />
            </div>
            {currentMarker!==null && (
              <div style={{ position:'absolute',top:'-4px',left:`${currentMarker}%`,transform:'translateX(-50%)' }}>
                <div style={{ width:'14px',height:'14px',background:'var(--or)',borderRadius:'50%',border:'2px solid var(--bg)',boxShadow:'0 0 8px rgba(249,115,22,.5)' }} />
              </div>
            )}
          </div>
          <div style={{ display:'flex',justifyContent:'space-between',marginTop:'8px' }}>
            <div><div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)' }}>Start</div><div style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--mu)',lineHeight:1 }}>{startW}kg</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)' }}>Current</div><div style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--or)',lineHeight:1 }}>{latestW}kg</div><div style={{ fontSize:'9px',color:(latestW-startW)<=0?'#4ade80':'#fca5a5',marginTop:'2px' }}>{(latestW-startW)<=0?'↓ ':'↑ '}{Math.abs(latestW-startW).toFixed(1)}kg</div></div>
            <div style={{ textAlign:'right' }}><div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)' }}>Goal</div><div style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'#4ade80',lineHeight:1 }}>{goalW}kg</div></div>
          </div>
        </div>
      )}

      {/* STAT CARDS */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'1px',background:'var(--b1)',border:'1px solid var(--b1)',marginBottom:'20px' }}>
        {/* Calories — always unlocked (day 1) */}
        {!journeyMode || unlocked.has('cal')
          ? <StatCard label="7-Day Avg Calories" value={avgCal?Math.round(avgCal).toLocaleString():'—'} unit="kcal" tag={calText} tagVariant={calVar} />
          : <LockedCard label="7-Day Avg Calories" unlockDay={1} currentStreak={journeyStreak} />
        }
        {!journeyMode || unlocked.has('prot')
          ? <StatCard label="7-Day Avg Protein" value={avgProt?Math.round(avgProt):'—'} unit="g" tag={protText} tagVariant={protVar} />
          : <LockedCard label="7-Day Avg Protein" unlockDay={3} currentStreak={journeyStreak} />
        }
        <StatCard label="7-Day Avg Steps" value={avgSteps?(avgSteps/1000).toFixed(1):'—'} unit="k" tag={stepsText} tagVariant={stepsVar} />
        <StatCard label="7-Day Avg Weight" value={avgWt?avgWt.toFixed(1):'—'} unit="kg" tag={wtDiff!=null?`${wtDiff<=0?'↓':'↑'} ${Math.abs(wtDiff).toFixed(2)}kg vs last week`:'rolling avg'} tagVariant={wtDiff!=null?(wtDiff<=0?'good':'bad'):'neutral'} />
        {!journeyMode || unlocked.has('creatine')
          ? <StatCard label="Creatine Streak" value={creatineStreak} unit="days" tag={creatineStreak>=7?'🔥 On fire':creatineStreak>=3?'Building':'Start streak'} tagVariant={creatineStreak>=7?'good':creatineStreak>=3?'default':'neutral'} />
          : <LockedCard label="Creatine Streak" unlockDay={11} currentStreak={journeyStreak} />
        }
      </div>

      {/* WEIGHT CHART */}
      {!journeyMode || unlocked.has('trend') ? (
        <Panel style={{ marginBottom:'20px' }}>
          <PanelTitle>Weight Trend</PanelTitle>
          <PanelSub>Actual weights · dotted = projected path to goal based on avg weekly loss</PanelSub>
          <div style={{ height:'220px' }}>
            <Line data={{ labels:allDays.map((d,i)=>i%7===0?formatDate(d):''), datasets:[
              {label:'Actual',data:actualData,borderColor:'#f97316',backgroundColor:'rgba(249,115,22,.08)',borderWidth:2,pointRadius:3,pointBackgroundColor:'#f97316',tension:.3,spanGaps:true},
              {label:'Projected to Goal',data:projData,borderColor:'rgba(100,160,255,.6)',borderDash:[5,5],borderWidth:1.5,pointRadius:0,tension:.2,spanGaps:true},
            ]}} options={chartOpts} />
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'1px',background:'var(--b1)',marginTop:'14px' }}>
            {[
              {label:'Avg Weekly Loss',val:ratePerDay>0?(ratePerDay*7).toFixed(2)+'kg':'—',color:'var(--or)',sub:'per week avg'},
              {label:'Current Weight',val:latestW?latestW+'kg':'—',color:'var(--tx)',sub:'latest weigh-in'},
              {label:'To Goal',val:latestW&&goalW?(latestW-goalW).toFixed(1)+'kg':'—',color:'#4ade80',sub:'remaining'},
              {label:'Est. Goal Date',val:ratePerDay>0&&latestW&&goalW?(()=>{const d=new Date();d.setDate(d.getDate()+daysToGoal);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})})():'—',color:'#93c5fd',sub:'at current rate'},
            ].map(({label,val,color,sub})=>(
              <div key={label} style={{ background:'var(--s2)',padding:'12px 14px' }}>
                <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'4px' }}>{label}</div>
                <div style={{ fontFamily:'Bebas Neue',fontSize:'24px',color,lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:'8px',color:'var(--mu)',marginTop:'2px' }}>{sub}</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel style={{ marginBottom:'20px' }}>
          <div style={{ textAlign:'center',padding:'40px 20px' }}>
            <div style={{ fontSize:'36px',marginBottom:'12px' }}>🔒</div>
            <div style={{ fontFamily:'Bebas Neue',fontSize:'20px',letterSpacing:'2px',color:'var(--mu)',marginBottom:'6px' }}>Weight Trend</div>
            <div style={{ fontSize:'9px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)' }}>Unlocks at day 14 · {14-journeyStreak} days to go</div>
            <div style={{ marginTop:'16px',height:'6px',background:'var(--s3)',maxWidth:'300px',margin:'16px auto 0' }}>
              <div style={{ height:'100%',width:`${Math.min(100,(journeyStreak/14)*100)}%`,background:'var(--or)',transition:'width .6s' }} />
            </div>
          </div>
        </Panel>
      )}

      {/* BOTTOM ROW */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 2fr 1fr',gap:'16px' }}>
        {/* Cal:Protein Ratio */}
        {!journeyMode || unlocked.has('cpr') ? (
          <Panel>
            <PanelTitle>Cal:Protein Ratio</PanelTitle>
            <PanelSub>7-day avg · target 10:1</PanelSub>
            <div style={{ textAlign:'center',padding:'12px 0' }}>
              <div style={{ fontFamily:'Bebas Neue',fontSize:'56px',lineHeight:1,color:cprGood===true?'#4ade80':cprGood===false?'#fca5a5':'var(--mu)' }}>{cpr??'—'}</div>
              <div style={{ fontSize:'9px',color:'var(--mu)',letterSpacing:'1px',marginTop:'4px' }}>: 1 ratio</div>
            </div>
            <div style={{ height:'8px',background:'var(--s3)',overflow:'hidden' }}>
              <div style={{ height:'100%',background:cprGood?'var(--gr)':'var(--re)',width:cpr?`${Math.min(100,parseFloat(cpr)/20*100)}%`:'0%',transition:'width .6s' }} />
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',marginTop:'4px' }}>
              <span style={{ fontSize:'7px',color:'var(--mu2)' }}>0</span>
              <span style={{ fontSize:'7px',color:'var(--or)' }}>10 target</span>
              <span style={{ fontSize:'7px',color:'var(--mu2)' }}>20</span>
            </div>
            <div style={{ marginTop:'10px',fontSize:'9px',color:cprGood?'#4ade80':'#fca5a5',lineHeight:1.6 }}>
              {cpr?(cprGood?'✓ Good protein density':`✗ ${(parseFloat(cpr)-10).toFixed(1)} above target`):'Log calories and protein'}
            </div>
          </Panel>
        ) : (
          <Panel>
            <div style={{ textAlign:'center',padding:'30px 10px' }}>
              <div style={{ fontSize:'28px',marginBottom:'8px' }}>🔒</div>
              <div style={{ fontFamily:'Bebas Neue',fontSize:'14px',letterSpacing:'2px',color:'var(--mu)',marginBottom:'4px' }}>Cal:Protein</div>
              <div style={{ fontSize:'8px',letterSpacing:'1px',color:'var(--mu2)' }}>Day 7 · {7-journeyStreak}d left</div>
            </div>
          </Panel>
        )}

        {/* Rolling weight */}
        <Panel>
          <PanelTitle>7-Day Rolling Weight</PanelTitle>
          <PanelSub>Smoothed trend · last 56 days</PanelSub>
          <div style={{ height:'160px' }}>
            <Line data={{ labels:last56.map((d,i)=>i%7===0?formatDate(d):''), datasets:[
              {label:'Daily',data:actualRolling,borderColor:'rgba(249,115,22,.3)',backgroundColor:'transparent',borderWidth:1,pointRadius:1,tension:.2,spanGaps:true},
              {label:'7-Day Avg',data:rollingData,borderColor:'#f97316',backgroundColor:'rgba(249,115,22,.06)',borderWidth:2,pointRadius:0,tension:.4,spanGaps:true,fill:true},
            ]}} options={chartOpts} />
          </div>
        </Panel>

        {/* Creatine */}
        <Panel style={{ display:'flex',flexDirection:'column' }}>
          <PanelTitle>Creatine</PanelTitle>
          <PanelSub>Daily streak</PanelSub>
          <div style={{ textAlign:'center',flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
            <div style={{ fontFamily:'Bebas Neue',fontSize:'62px',color:'var(--or)',lineHeight:1,textShadow:'0 0 24px rgba(249,115,22,.3)' }}>{creatineStreak}</div>
            <div style={{ fontSize:'8px',letterSpacing:'4px',color:'var(--mu)',textTransform:'uppercase',marginTop:'4px' }}>Day Streak</div>
          </div>
          <div style={{ display:'flex',gap:'5px',flexWrap:'wrap',justifyContent:'center',marginTop:'8px' }}>
            {Array.from({length:14},(_,i)=>{
              const d=new Date(); d.setDate(d.getDate()-(13-i))
              const ds=d.toISOString().split('T')[0]
              const e=logMap[ds]
              return <div key={i} style={{ width:10,height:10,borderRadius:'50%',background:e?.creatine===true?'#f97316':e?.creatine===false?'var(--mu2)':'var(--s3)',boxShadow:e?.creatine===true?'0 0 6px rgba(249,115,22,.5)':undefined }} />
            })}
          </div>
        </Panel>
      </div>

      {showPrompt && <DailyPrompt onLog={() => { setShowPrompt(false); window.location.href='/log' }} onDismiss={() => setShowPrompt(false)} />}
      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
