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
      if (error) showToast('Error: ' + error.message); else showToast('Plan saved ✓')
    } else {
      const { data, error } = await supabase.from('plans').insert(payload).select().single()
      if (error) showToast('Error: ' + error.message); else { setPlan(data); showToast('Plan saved ✓') }
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

  let goalDate: string | null = null
  if (latestW && goalW && wkLoss && wkLoss > 0) {
    const weeksLeft = (latestW - goalW) / wkLoss
    const d = new Date(); d.setDate(d.getDate() + weeksLeft * 7)
    goalDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const weeklySummaries = plan.start_date ? buildWeekSummaries(logs, plan.start_date) : []
  const phaseBadgeColor: Record<string,string> = { cut: 'var(--re)', gain: 'var(--gr)', reverse: 'var(--am)', maintain: 'var(--bl)' }
  const bc = phaseBadgeColor[plan.phase || 'cut']

  return (
    <AppLayout>
      <PageHeader title="CURRENT" accent="PLAN" sub="Phase progress and results"
        right={<div style={{ fontSize:'8px',letterSpacing:'3px',textTransform:'uppercase',padding:'4px 14px',border:`1px solid ${bc}`,color:bc,background:`${bc}20` }}>{PHASE_LABELS[plan.phase||'cut']}</div>} />

      <StatGrid cols={4}>
        <StatCard label="Weeks In" value={weeksIn ?? '—'} tag={weeksIn != null ? `since start` : 'set start date'} tagVariant="neutral" />
        <StatCard label="Weight Lost" value={weightLost != null ? Math.abs(weightLost).toFixed(2) : '—'} unit="kg" tag={weightLost != null ? (weightLost >= 0 ? '↓ lost' : '↑ gained') : 'need start weight'} tagVariant={weightLost != null && weightLost > 0 ? 'good' : weightLost != null && weightLost < 0 ? 'bad' : 'neutral'} />
        <StatCard label="Avg Weekly Loss" value={wkLoss != null ? Math.abs(wkLoss).toFixed(2) : '—'} unit="kg/wk" tag={wkLoss != null ? (wkLoss > 0 ? '↓ on track' : '↑ gaining') : 'need more data'} tagVariant={wkLoss != null && wkLoss > 0 ? 'good' : 'neutral'} />
        <StatCard label="Goal Weight" value={goalW ?? '—'} unit="kg" tag={goalDate ? `Est. ${goalDate}` : 'set goal'} tagVariant="blue" />
      </StatGrid>

      <Grid2>
        <Panel>
          <PanelTitle>7-Day Adherence</PanelTitle>
          <PanelSub>Calories under target = good · Protein and steps over = good</PanelSub>
          {[
            { label: 'Calories (under = good)', a: avgCal, target: ct, lo: true },
            { label: 'Protein (over = good)', a: avgProt, target: pt, lo: false },
            { label: 'Steps (over = good)', a: avgSteps, target: st, lo: false },
          ].map(({ label, a, target, lo }) => {
            const pct = a && target ? Math.min(100, Math.round(a / target * 100)) : 0
            const good = a != null && target != null ? (lo ? a <= target : a >= target) : false
            const diff = a != null && target != null ? Math.abs(Math.round(a - target)) : 0
            const txt = a != null && target != null ? `${Math.round(a).toLocaleString()} / ${target.toLocaleString()} (${pct}%)${good ? ' ✓' : lo ? ` ✗ over by ${diff}` : ` ↓ under by ${diff}`}` : '—'
            return (
              <div key={label} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '8px', letterSpacing: '1px', color: 'var(--mu)', textTransform: 'uppercase' }}>{label}</span>
                  <span style={{ fontSize: '9px', color: a != null ? (good ? '#4ade80' : '#fca5a5') : 'var(--mu)' }}>{txt}</span>
                </div>
                <ProgressBar value={pct} variant={good ? 'good' : pct > 85 ? 'warn' : 'bad'} />
              </div>
            )
          })}
          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {ct && ch.length ? (() => {
              const calGood = days7.filter(d => logMap[d]?.calories != null && logMap[d].calories! <= ct).length
              const protGood = pt ? days7.filter(d => logMap[d]?.protein != null && logMap[d].protein! >= pt).length : ch.length
              const stepsGood = st ? days7.filter(d => logMap[d]?.steps != null && logMap[d].steps! >= st).length : ch.length
              const ov = Math.round(((calGood + protGood + stepsGood) / (ch.length * 3)) * 100)
              return <>
                <div>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: '50px', lineHeight: 1, color: ov >= 80 ? '#4ade80' : ov >= 60 ? 'var(--or)' : 'var(--re)' }}>{ov}%</div>
                  <div style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)' }}>Overall</div>
                </div>
                <div style={{ fontSize: '11px', color: ov >= 80 ? '#4ade80' : ov >= 60 ? '#fcd34d' : '#fca5a5' }}>
                  {ov >= 80 ? 'Strong week 💪' : ov >= 60 ? 'Good — tighten up' : 'Focus on targets'}
                </div>
              </>
            })() : <div style={{ fontSize: '10px', color: 'var(--mu)' }}>Set plan targets to calculate</div>}
          </div>
        </Panel>

        <Panel>
          <PanelTitle>Deeper Calculations</PanelTitle>
          <PanelSub>Cut phase — fat burnt and projections</PanelSub>
          <KVRow label="Expected Goal Date" value={goalDate || 'Need weight data'} valueColor="var(--or2)" />
          <KVRow label="Total Fat Burnt" value={fatDays > 0 ? `${Math.round(totalFatG).toLocaleString()}g` : '—'} valueColor="#4ade80" />
          <KVRow label="Avg Fat Burnt / Day" value={avgFatG ? `${Math.round(avgFatG)}g / day` : '—'} valueColor="#4ade80" />
          <KVRow label="Expected Weight Now" value={expWt ? `${expWt.toFixed(2)}kg` : '—'} valueColor="#93c5fd" />
          <KVRow label="Actual Weight Now" value={latestW ? `${latestW}kg` : '—'} />
          {expWt != null && latestW != null && <KVRow label="Difference" value={`${(latestW-expWt) > 0 ? '+' : ''}${(latestW-expWt).toFixed(2)}kg vs expected`} valueColor={(latestW-expWt) <= 0 ? '#4ade80' : '#fca5a5'} />}
          <div style={{ marginTop: '14px', padding: '12px', background: 'var(--s2)', border: '1px solid var(--b1)', fontSize: '9px', color: 'var(--mu)', lineHeight: 1.7 }}>
            {(!maint || !calT) ? 'Set calorie target and maintenance calories to calculate.' :
             expWt != null && latestW != null ? (latestW > expWt ?
               `${(latestW-expWt).toFixed(2)}kg heavier than deficit math predicts. Likely water retention or logging gaps.` :
               `${(expWt-latestW).toFixed(2)}kg lighter than predicted — your true maintenance may be higher. Great sign.`) :
             'Log more data to see the comparison.'}
          </div>
        </Panel>
      </Grid2>

      <Panel style={{ marginBottom: '20px' }}>
        <PanelTitle>Plan Setup</PanelTitle>
        <PanelSub>Configure your phase — drives all calculations</PanelSub>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <Select label="Phase" value={plan.phase || 'cut'} onChange={v => setPlan(p => ({ ...p, phase: v as any }))} options={[{value:'cut',label:'Cut (Deficit)'},{value:'gain',label:'Gain (Surplus)'},{value:'reverse',label:'Reverse Diet'},{value:'maintain',label:'Maintenance'}]} />
          <Input label="Plan Name" value={plan.name || ''} onChange={v => setPlan(p => ({ ...p, name: v }))} placeholder="e.g. PPB 16-Week Cut" />
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
        <Textarea label="Plan Notes" value={plan.notes || ''} onChange={v => setPlan(p => ({ ...p, notes: v }))} placeholder="Training split, coach notes..." />
        <div style={{ marginTop: '16px' }}><Btn variant="primary" onClick={savePlan} disabled={saving}>{saving ? 'Saving...' : 'Save Plan'}</Btn></div>
      </Panel>

      <Panel>
        <PanelTitle>Weekly Breakdown</PanelTitle>
        <PanelSub>Week-by-week results since plan start</PanelSub>
        {!weeklySummaries.length ? (
          <div style={{ fontSize: '10px', color: 'var(--mu)', letterSpacing: '2px', padding: '14px 0', textTransform: 'uppercase' }}>Set a plan start date and log data to see breakdown</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead><tr>{['Week','Avg Cal','Avg Prot','Avg Steps','Start Wt','End Wt','Change','Creatine'].map(h => (
                <th key={h} style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', textAlign: 'left', padding: '8px 8px 8px 0', borderBottom: '1px solid var(--b1)' }}>{h}</th>
              ))}</tr></thead>
              <tbody>{weeklySummaries.map(w => (
                <tr key={w.weekNum}>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>Wk {w.weekNum}<br /><span style={{ fontSize: '8px', color: 'var(--mu)' }}>{formatDate(w.startDate)}</span></td>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: 'var(--or2)' }}>{w.avgCal ? Math.round(w.avgCal).toLocaleString() : '—'}</td>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>{w.avgProt ? `${Math.round(w.avgProt)}g` : '—'}</td>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>{w.avgSteps ? `${(w.avgSteps/1000).toFixed(1)}k` : '—'}</td>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>{w.startWeight ? `${w.startWeight}kg` : '—'}</td>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>{w.endWeight ? `${w.endWeight}kg` : '—'}</td>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: w.change == null ? 'var(--mu)' : w.change <= 0 ? '#4ade80' : '#fca5a5' }}>{w.change != null ? `${w.change <= 0 ? '' : '+'}${w.change.toFixed(2)}kg` : '—'}</td>
                  <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: 'var(--mu)' }}>{w.creatineDays}/{w.loggedDays}d</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
