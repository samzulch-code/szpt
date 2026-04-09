'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, StatGrid, StatCard, Btn, Input, Select, Textarea, KVRow, Grid2, ProgressBar, Toast } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { DailyLog, Plan } from '@/types'
import { last7Days, avg, formatDate, buildWeekSummaries, PHASE_LABELS } from '@/lib/utils'

export default function PlanPage() {
  const [plan, setPlan] = useState<Partial<Plan>>({ phase: 'cut', is_active: true })
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [userId, setUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const supabase = createClient()
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      supabase.from('plans').select('*').eq('user_id', data.user.id).eq('is_active', true).single()
        .then(({ data: p }) => { if (p) setPlan(p) })
      supabase.from('daily_logs').select('*').eq('user_id', data.user.id).order('date')
        .then(({ data: l }) => { if (l) setLogs(l) })
    })
  }, [])

  async function savePlan() {
    setSaving(true)
    const payload = { ...plan, user_id: userId, is_active: true }
    if (plan.id) {
      const { error } = await supabase.from('plans').update(payload).eq('id', plan.id)
      if (error) showToast('Error: ' + error.message); else showToast('Phase saved ✓')
    } else {
      const { data, error } = await supabase.from('plans').insert(payload).select().single()
      if (error) showToast('Error: ' + error.message); else { setPlan(data); showToast('Phase saved ✓') }
    }
    setSaving(false)
  }

  const logMap = Object.fromEntries(logs.map(l => [l.date, l]))
  const days7 = last7Days()
  const allWeights = logs.filter(l => l.weight != null).sort((a, b) => a.date.localeCompare(b.date))
  const latestW = allWeights.length ? allWeights[allWeights.length - 1].weight! : null
  const startW = plan.start_weight ?? null
  const goalW = plan.goal_weight ?? null
  const maint = plan.maintenance_cals ?? null
  const calT = plan.cal_target ?? null

  const weightLost = startW != null && latestW != null ? startW - latestW : null
  const weeksIn = plan.start_date ? Math.max(0, Math.floor((Date.now() - new Date(plan.start_date).getTime()) / (7 * 86400000))) : null

  let wkLoss: number | null = null
  if (allWeights.length >= 2) {
    const span = Math.max(1, (new Date(allWeights[allWeights.length-1].date).getTime() - new Date(allWeights[0].date).getTime()) / (7 * 86400000))
    wkLoss = (allWeights[0].weight! - latestW!) / span
  }

  const ct = plan.cal_target, pt = plan.prot_target, st = plan.steps_target
  const ch = days7.filter(d => logMap[d]?.calories != null && ct).map(d => logMap[d].calories!)
  const ph = days7.filter(d => logMap[d]?.protein != null && pt).map(d => logMap[d].protein!)
  const sh = days7.filter(d => logMap[d]?.steps != null && st).map(d => logMap[d].steps!)
  const avgCal = avg(ch), avgProt = avg(ph), avgSteps = avg(sh)

  // Deeper calculations
  let totalFatG = 0, fatDays = 0
  if (maint && calT && plan.start_date) {
    const start = new Date(plan.start_date)
    for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      const cal = logMap[ds]?.calories
      if (cal != null) { totalFatG += ((maint - cal) / 7700) * 1000; fatDays++ }
    }
  }
  const avgFatG = fatDays > 0 ? totalFatG / fatDays : null
  const expWt = startW ? startW - totalFatG / 1000 : null
  const ahead = expWt != null && latestW != null ? expWt - latestW : null // positive = ahead of schedule

  // True maintenance estimate: avg intake + deficit implied by actual weight loss
  const trueMaintEst = (() => {
    const weekAvgCal = avg(ch)
    if (!weekAvgCal || !wkLoss) return null
    return Math.round(weekAvgCal + (wkLoss * 7700 / 7))
  })()

  // Expected deficit per day
  const expectedDeficit = maint && calT ? maint - calT : null
  const actualDeficit = maint && avgCal ? Math.round(maint - avgCal) : null

  // Log accuracy estimate
  const logAccuracy = trueMaintEst && maint ? Math.round((trueMaintEst / maint) * 100) : null

  let goalDate: string | null = null
  let daysToGoal: number | null = null
  if (latestW && goalW && wkLoss && wkLoss > 0) {
    const weeksLeft = (latestW - goalW) / wkLoss
    daysToGoal = Math.round(weeksLeft * 7)
    const d = new Date(); d.setDate(d.getDate() + daysToGoal)
    goalDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const weeklySummaries = plan.start_date ? buildWeekSummaries(logs, plan.start_date) : []
  const phaseBadgeColor: Record<string,string> = { cut: 'var(--re)', gain: 'var(--gr)', reverse: 'var(--am)', maintain: 'var(--bl)' }
  const bc = phaseBadgeColor[plan.phase || 'cut']

  // Adherence
  const adherenceMetrics = [
    { key: 'cal',   label: 'Calories',   a: avgCal,   target: ct, lo: true,  icon: '🔥' },
    { key: 'prot',  label: 'Protein',    a: avgProt,  target: pt, lo: false, icon: '💪' },
    { key: 'steps', label: 'Steps',      a: avgSteps, target: st, lo: false, icon: '👟' },
  ]

  return (
    <AppLayout>
      <PageHeader title="CURRENT" accent="PHASE" sub="Phase progress and results"
        right={<div style={{ fontSize:'8px',letterSpacing:'3px',textTransform:'uppercase',padding:'4px 14px',border:`1px solid ${bc}`,color:bc,background:`${bc}20` }}>{PHASE_LABELS[plan.phase||'cut']}</div>} />

      {/* ── STAT CARDS — enhanced ── */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1px',background:'var(--b1)',border:'1px solid var(--b1)',marginBottom:'20px' }}>
        {[
          { label:'Weeks In', val:weeksIn??'—', unit:'', sub:weeksIn!=null?`since ${plan.start_date?new Date(plan.start_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'start'}`:'set start date', color:'var(--tx)' },
          { label:'Weight Lost', val:weightLost!=null?Math.abs(weightLost).toFixed(2):'—', unit:'kg', sub:weightLost!=null?(weightLost>=0?'↓ lost':'↑ gained'):'need start weight', color:weightLost!=null&&weightLost>0?'#4ade80':weightLost!=null&&weightLost<0?'#fca5a5':'var(--tx)' },
          { label:'Avg Weekly Loss', val:wkLoss!=null?Math.abs(wkLoss).toFixed(2):'—', unit:'kg/wk', sub:wkLoss!=null?(wkLoss>=0.5&&wkLoss<=1.0?'✓ ideal range':wkLoss>0?'↓ on track':'↑ gaining'):'need more data', color:wkLoss!=null&&wkLoss>=0.5&&wkLoss<=1.0?'#4ade80':wkLoss!=null&&wkLoss>0?'var(--or)':'var(--tx)' },
          { label:'Goal Weight', val:goalW??'—', unit:'kg', sub:goalDate?`Est. ${goalDate}`:'set goal weight', color:'#93c5fd' },
        ].map(({label,val,unit,sub,color})=>(
          <div key={label} style={{ background:'var(--s1)',padding:'20px 18px',position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:'2px',background:color,opacity:0.6 }} />
            <div style={{ fontSize:'7px',letterSpacing:'3px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'8px' }}>{label}</div>
            <div style={{ display:'flex',alignItems:'baseline',gap:'4px',marginBottom:'6px' }}>
              <span style={{ fontFamily:'Bebas Neue',fontSize:'40px',color,lineHeight:1 }}>{val}</span>
              {unit && <span style={{ fontSize:'11px',color:'var(--mu)',letterSpacing:'1px' }}>{unit}</span>}
            </div>
            <div style={{ fontSize:'8px',color:sub?.startsWith('✓')?'#4ade80':sub?.startsWith('↑')?'#fca5a5':'var(--mu)',letterSpacing:'1px' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── ADHERENCE + DEEPER CALCS ── */}
      <Grid2>

        {/* Adherence — visual at-a-glance */}
        <Panel>
          <PanelTitle>7-Day Targets</PanelTitle>
          <PanelSub>At a glance — how are you tracking this week?</PanelSub>

          {adherenceMetrics.map(({ key, label, a, target, lo, icon }) => {
            if (!target || a == null) return (
              <div key={key} style={{ display:'flex',alignItems:'center',gap:'12px',padding:'12px 0',borderBottom:'1px solid var(--b1)' }}>
                <div style={{ fontSize:'18px',width:'28px',textAlign:'center' }}>{icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'9px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)' }}>{label}</div>
                  <div style={{ fontSize:'10px',color:'var(--mu)',marginTop:'2px' }}>No data — set target in Phase Setup</div>
                </div>
              </div>
            )
            const diff = Math.round(a - target)
            const good = lo ? a <= target : a >= target
            const pctOff = Math.abs(Math.round((diff / target) * 100))
            const isClose = pctOff <= 5
            const isFar = pctOff > 20

            return (
              <div key={key} style={{ display:'flex',alignItems:'center',gap:'12px',padding:'14px 0',borderBottom:'1px solid var(--b1)' }}>
                <div style={{ fontSize:'20px',width:'28px',textAlign:'center' }}>{icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px' }}>
                    <div style={{ fontSize:'9px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)' }}>{label}</div>
                    <div style={{ fontFamily:'Bebas Neue',fontSize:'18px',color:good?'#4ade80':isFar?'#fca5a5':'#fcd34d',lineHeight:1 }}>
                      {good ? (lo ? `✓ ${Math.abs(diff)} under` : `✓ ${Math.abs(diff)} over`) : (lo ? `+${Math.abs(diff)} over` : `${Math.abs(diff)} short`)}
                    </div>
                  </div>
                  {/* Visual gap bar */}
                  <div style={{ position:'relative',height:'8px',background:'var(--s3)',overflow:'hidden' }}>
                    {lo ? (
                      // Calories: fill shows actual vs target, orange if over
                      <div style={{ height:'100%',width:`${Math.min(100,Math.round(a/target*100))}%`,background:good?'#4ade80':isClose?'#fcd34d':'#fca5a5',transition:'width .4s' }} />
                    ) : (
                      // Protein/Steps: fill shows actual vs target, green if over
                      <div style={{ height:'100%',width:`${Math.min(100,Math.round(a/target*100))}%`,background:good?'#4ade80':isClose?'#fcd34d':'#fca5a5',transition:'width .4s' }} />
                    )}
                    {/* Target marker */}
                    <div style={{ position:'absolute',top:0,bottom:0,left:'calc(100% * 1)',width:'2px',background:'var(--or)',opacity:0.6 }} />
                  </div>
                  <div style={{ display:'flex',justifyContent:'space-between',marginTop:'3px' }}>
                    <span style={{ fontSize:'7px',color:'var(--mu2)' }}>0</span>
                    <span style={{ fontSize:'7px',color:'var(--mu)' }}>{Math.round(a).toLocaleString()} / {target.toLocaleString()}</span>
                    <span style={{ fontSize:'7px',color:'var(--or)' }}>target</span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Overall score */}
          {ct && ch.length > 0 && (
            <div style={{ marginTop:'14px',display:'flex',alignItems:'center',gap:'16px' }}>
              {(() => {
                const calGood = days7.filter(d => logMap[d]?.calories!=null && ct && logMap[d].calories!<=ct).length
                const protGood = pt ? days7.filter(d => logMap[d]?.protein!=null && logMap[d].protein!>=(pt??0)).length : ch.length
                const stepsGood = st ? days7.filter(d => logMap[d]?.steps!=null && logMap[d].steps!>=(st??0)).length : ch.length
                const ov = Math.round(((calGood+protGood+stepsGood)/(ch.length*3))*100)
                return <>
                  <div>
                    <div style={{ fontFamily:'Bebas Neue',fontSize:'48px',lineHeight:1,color:ov>=80?'#4ade80':ov>=60?'var(--or)':'#fca5a5' }}>{ov}%</div>
                    <div style={{ fontSize:'7px',letterSpacing:'3px',textTransform:'uppercase',color:'var(--mu)' }}>This Week</div>
                  </div>
                  <div>
                    <div style={{ fontSize:'11px',color:ov>=80?'#4ade80':ov>=60?'#fcd34d':'#fca5a5',marginBottom:'4px' }}>
                      {ov>=80?'Strong week 💪':ov>=60?'Good — tighten up':'Focus on targets'}
                    </div>
                    <div style={{ fontSize:'9px',color:'var(--mu)',lineHeight:1.6 }}>
                      {calGood} of {ch.length} days on calories<br/>
                      {pt?`${protGood} of ${ch.length} days on protein`:''}
                    </div>
                  </div>
                </>
              })()}
            </div>
          )}
        </Panel>

        {/* Deeper Calculations */}
        <Panel>
          <PanelTitle>Deeper Calculations</PanelTitle>
          <PanelSub>Cut phase — deficit, projections, and log accuracy</PanelSub>

          {/* Expected goal date */}
          <div style={{ marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid var(--b1)' }}>
            <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'4px' }}>Expected Goal Date</div>
            <div style={{ fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--or)',lineHeight:1 }}>{goalDate||'—'}</div>
            {daysToGoal && <div style={{ fontSize:'8px',color:'var(--mu)',marginTop:'2px' }}>{daysToGoal} days from today</div>}
          </div>

          {/* Expected deficit */}
          {maint && calT && (
            <div style={{ marginBottom:'14px',paddingBottom:'14px',borderBottom:'1px solid var(--b1)' }}>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'6px' }}>Expected Deficit</div>
              <div style={{ fontSize:'9px',color:'var(--mu)',lineHeight:1.8,fontFamily:'DM Mono' }}>
                {maint.toLocaleString()} maintenance<br/>
                − {calT.toLocaleString()} cal target<br/>
                <div style={{ borderTop:'1px solid var(--b2)',paddingTop:'4px',marginTop:'2px' }}>
                  = <span style={{ color:'#93c5fd',fontFamily:'Bebas Neue',fontSize:'16px' }}>{expectedDeficit?.toLocaleString()} kcal/day</span>
                  <span style={{ color:'var(--mu)',fontSize:'8px' }}> ({Math.round((expectedDeficit??0)/7700*1000)}g fat/day)</span>
                </div>
                {actualDeficit!=null && <div style={{ marginTop:'4px',color:actualDeficit>=(expectedDeficit??0)*0.9?'#4ade80':'#fcd34d' }}>Actual avg: {actualDeficit.toLocaleString()} kcal/day</div>}
              </div>
            </div>
          )}

          {/* Potential true maintenance */}
          {trueMaintEst && (
            <div style={{ marginBottom:'14px',paddingBottom:'14px',borderBottom:'1px solid var(--b1)' }}>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'6px' }}>Potential True Maintenance</div>
              <div style={{ fontSize:'9px',color:'var(--mu)',lineHeight:1.8,fontFamily:'DM Mono' }}>
                {avgCal?Math.round(avgCal).toLocaleString():'—'} avg intake<br/>
                + {avgCal&&wkLoss?Math.round(wkLoss*7700/7):0} implied deficit<br/>
                <div style={{ borderTop:'1px solid var(--b2)',paddingTop:'4px',marginTop:'2px' }}>
                  ≈ <span style={{ color:'var(--or)',fontFamily:'Bebas Neue',fontSize:'16px' }}>{trueMaintEst.toLocaleString()} kcal/day</span>
                  {maint && <span style={{ color:Math.abs(trueMaintEst-maint)<150?'#4ade80':'#fcd34d',fontSize:'8px' }}> ({trueMaintEst>maint?'+':''}{trueMaintEst-maint} vs profile)</span>}
                </div>
              </div>
            </div>
          )}

          {/* Expected weight vs actual */}
          {expWt != null && latestW != null && (
            <div style={{ marginBottom:'14px',paddingBottom:'14px',borderBottom:'1px solid var(--b1)' }}>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'6px' }}>Expected vs Actual Weight</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px' }}>
                <div style={{ background:'var(--s2)',padding:'10px' }}>
                  <div style={{ fontSize:'7px',color:'var(--mu2)',marginBottom:'3px' }}>Expected</div>
                  <div style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'#93c5fd' }}>{expWt.toFixed(2)}kg</div>
                </div>
                <div style={{ background:'var(--s2)',padding:'10px' }}>
                  <div style={{ fontSize:'7px',color:'var(--mu2)',marginBottom:'3px' }}>Actual</div>
                  <div style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--tx)' }}>{latestW}kg</div>
                </div>
              </div>
              {ahead != null && (
                <div style={{ marginTop:'8px',padding:'8px 10px',background:ahead>0?'rgba(74,222,128,.08)':'rgba(249,115,22,.08)',border:`1px solid ${ahead>0?'rgba(74,222,128,.2)':'rgba(249,115,22,.2)'}`,fontSize:'9px',color:ahead>0?'#4ade80':'#fcd34d',lineHeight:1.6 }}>
                  {ahead>0
                    ? `✓ ${ahead.toFixed(2)}kg ahead of schedule`
                    : `${Math.abs(ahead).toFixed(2)}kg behind schedule`}
                </div>
              )}
            </div>
          )}

          {/* Log accuracy estimate */}
          {logAccuracy && (
            <div>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'6px' }}>Estimated Log Accuracy</div>
              <div style={{ display:'flex',alignItems:'center',gap:'12px' }}>
                <div style={{ fontFamily:'Bebas Neue',fontSize:'32px',color:logAccuracy>=90?'#4ade80':logAccuracy>=75?'#fcd34d':'#fca5a5',lineHeight:1 }}>{logAccuracy}%</div>
                <div style={{ fontSize:'9px',color:'var(--mu)',lineHeight:1.6 }}>
                  {logAccuracy>=90?'Logs appear accurate':'Your true maintenance may differ from profile — logs may be slightly off'}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </Grid2>

      {/* ── WEEKLY BREAKDOWN ── */}
      <Panel style={{ marginBottom:'20px' }}>
        <PanelTitle>Weekly Breakdown</PanelTitle>
        <PanelSub>Week-by-week — avg weight compared to previous week</PanelSub>
        {!weeklySummaries.length ? (
          <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '2px', padding: '14px 0', textTransform: 'uppercase' }}>Set a phase start date and log data to see breakdown</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>{['Week','Avg Cal','Avg Prot','Avg Steps','Avg Weight','Change','Creatine'].map(h => (
                  <th key={h} style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', textAlign: 'left', padding: '8px 8px 8px 0', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {weeklySummaries.map((w, i) => {
                  const prevAvgW = i === 0 ? startW : weeklySummaries[i-1].avgWeight
                  const wkChange = w.avgWeight != null && prevAvgW != null ? w.avgWeight - prevAvgW : null
                  return (
                    <tr key={w.weekNum}>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>
                        Wk {w.weekNum}<br /><span style={{ fontSize: '8px', color: 'var(--mu)' }}>{formatDate(w.startDate)}</span>
                      </td>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: ct && w.avgCal ? (w.avgCal <= ct ? '#4ade80' : '#fca5a5') : 'var(--or2)' }}>
                        {w.avgCal ? Math.round(w.avgCal).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: pt && w.avgProt ? (w.avgProt >= pt ? '#4ade80' : '#fca5a5') : 'var(--tx)' }}>
                        {w.avgProt ? `${Math.round(w.avgProt)}g` : '—'}
                      </td>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>
                        {w.avgSteps ? `${(w.avgSteps/1000).toFixed(1)}k` : '—'}
                      </td>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', fontFamily:'DM Mono' }}>
                        {w.avgWeight ? `${w.avgWeight}kg` : '—'}
                      </td>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: wkChange == null ? 'var(--mu)' : wkChange <= 0 ? '#4ade80' : '#fca5a5', fontFamily:'DM Mono' }}>
                        {wkChange != null ? `${wkChange <= 0 ? '' : '+'}${wkChange.toFixed(2)}kg` : '—'}
                      </td>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: 'var(--mu)' }}>
                        {w.creatineDays}/{w.loggedDays}d
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── PHASE SETUP — collapsible at bottom ── */}
      <div style={{ border:'1px solid var(--b1)',marginBottom:'20px' }}>
        <button
          onClick={() => setShowSetup(s => !s)}
          style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',background:'var(--s1)',border:'none',cursor:'pointer',textAlign:'left' }}
        >
          <div>
            <div style={{ fontFamily:'Bebas Neue',fontSize:'16px',letterSpacing:'2px',color:'var(--tx)' }}>Phase Setup</div>
            <div style={{ fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',marginTop:'2px' }}>Configure targets and phase details</div>
          </div>
          <div style={{ fontFamily:'Bebas Neue',fontSize:'20px',color:'var(--or)',transform:showSetup?'rotate(180deg)':'none',transition:'transform .2s' }}>▼</div>
        </button>
        {showSetup && (
          <div style={{ padding:'20px',borderTop:'1px solid var(--b1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <Select label="Phase" value={plan.phase || 'cut'} onChange={v => setPlan(p => ({ ...p, phase: v as any }))} options={[{value:'cut',label:'Cut (Deficit)'},{value:'gain',label:'Gain (Surplus)'},{value:'reverse',label:'Reverse Diet'},{value:'maintain',label:'Maintenance'}]} />
              <Input label="Phase Name" value={plan.name || ''} onChange={v => setPlan(p => ({ ...p, name: v }))} placeholder="e.g. PPB 16-Week Cut" />
              <Input label="Start Date" value={plan.start_date || ''} onChange={v => setPlan(p => ({ ...p, start_date: v }))} type="date" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <Input label="Calorie Target (daily)" value={plan.cal_target?.toString() || ''} onChange={v => setPlan(p => ({ ...p, cal_target: parseInt(v)||null }))} type="number" placeholder="1500" />
              <Input label="Protein Target (g)" value={plan.prot_target?.toString() || ''} onChange={v => setPlan(p => ({ ...p, prot_target: parseInt(v)||null }))} type="number" placeholder="175" />
              <Input label="Step Target (daily)" value={plan.steps_target?.toString() || ''} onChange={v => setPlan(p => ({ ...p, steps_target: parseInt(v)||null }))} type="number" placeholder="10000" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <Input label="Start Weight (kg)" value={plan.start_weight?.toString() || ''} onChange={v => setPlan(p => ({ ...p, start_weight: parseFloat(v)||null }))} type="number" placeholder="83.0" />
              <Input label="Goal Weight (kg)" value={plan.goal_weight?.toString() || ''} onChange={v => setPlan(p => ({ ...p, goal_weight: parseFloat(v)||null }))} type="number" placeholder="75.0" />
              <Input label="Maintenance Calories" value={plan.maintenance_cals?.toString() || ''} onChange={v => setPlan(p => ({ ...p, maintenance_cals: parseInt(v)||null }))} type="number" placeholder="2400" />
              <Input label="Cal:Protein Target (ratio)" value={plan.cpr_target?.toString() || ''} onChange={v => setPlan(p => ({ ...p, cpr_target: parseFloat(v)||null }))} type="number" placeholder="10" />
            </div>
            <Textarea label="Phase Notes" value={plan.notes || ''} onChange={v => setPlan(p => ({ ...p, notes: v }))} placeholder="Training split, coach notes..." />
            <div style={{ marginTop: '16px' }}><Btn variant="primary" onClick={savePlan} disabled={saving}>{saving ? 'Saving...' : 'Save Phase'}</Btn></div>
          </div>
        )}
      </div>

      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
