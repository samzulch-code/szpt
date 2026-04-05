'use client'
import { useEffect, useState, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, StatGrid, StatCard, PageHeader, Toast } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { DailyLog, Plan } from '@/types'
import { last7Days, last28Days, avg, formatDate } from '@/lib/utils'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export default function Dashboard() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [toast, setToast] = useState('')
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

  const days7 = last7Days()
  const days28 = last28Days()
  const logMap = Object.fromEntries(logs.map(l => [l.date, l]))

  // 7-day averages
  const week = days7.map(d => logMap[d]).filter(Boolean)
  const avgCal  = avg(week.filter(l => l.calories != null).map(l => l.calories!))
  const avgProt = avg(week.filter(l => l.protein  != null).map(l => l.protein!))
  const avgSteps= avg(week.filter(l => l.steps    != null).map(l => l.steps!))
  const avgWt   = avg(week.filter(l => l.weight   != null).map(l => l.weight!))

  // Previous week avg weight
  const prevWeek7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 7 - (6 - i)); return d.toISOString().split('T')[0]
  })
  const prevWt = avg(prevWeek7.map(d => logMap[d]).filter(Boolean).filter(l => l.weight != null).map(l => l.weight!))
  const wtDiff = avgWt && prevWt ? avgWt - prevWt : null

  // Creatine streak
  let streak = 0
  for (let i = 0; i < 90; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if (logMap[ds]?.creatine === true) streak++
    else break
  }

  // Tag helpers
  function calTag(val: number | null, target: number | null): [string, 'good'|'bad'|'neutral'] {
    if (!val) return ['No data', 'neutral']
    if (!target) return ['Set target', 'neutral']
    const p = Math.round(val / target * 100)
    return val <= target ? [`✓ ${p}% of target`, 'good'] : [`✗ over by ${Math.round(val - target)} kcal`, 'bad']
  }
  function hiTag(val: number | null, target: number | null): [string, 'good'|'warn'|'neutral'] {
    if (!val) return ['No data', 'neutral']
    if (!target) return ['Set target', 'neutral']
    const p = Math.round(val / target * 100)
    return val >= target ? [`✓ ${p}% of target`, 'good'] : [`↓ ${p}% of target`, 'warn']
  }

  const [calText, calVar]   = calTag(avgCal, plan?.cal_target ?? null)
  const [protText, protVar] = hiTag(avgProt, plan?.prot_target ?? null)
  const [stepsText, stepsVar] = hiTag(avgSteps, plan?.steps_target ?? null)

  // Progress bar: start → current → goal
  const allWeights = logs
    .filter(l => l.weight != null && l.weight > 0)
    .sort((a,b) => a.date.localeCompare(b.date))
  const latestW = allWeights.length ? allWeights[allWeights.length - 1].weight! : null
  // Debug
  if (typeof window !== 'undefined') {
    console.log('allWeights count:', allWeights.length, 'first:', allWeights[0]?.date, allWeights[0]?.weight, 'last:', allWeights[allWeights.length-1]?.date, allWeights[allWeights.length-1]?.weight)
  }
  const startW = plan?.start_weight ?? null
  const goalW  = plan?.goal_weight ?? null
  const progress = startW && goalW && latestW ? Math.max(0, Math.min(100, (startW - latestW) / (startW - goalW) * 100)) : 0
  const currentMarker = startW && goalW && latestW ? Math.max(2, Math.min(98, (startW - latestW) / (startW - goalW) * 100)) : null

  // Weekly avg rate of loss (kg/day) — use T12:00:00 to avoid timezone issues
  let ratePerDay = 0
  if (allWeights.length >= 2) {
    const firstDate = new Date(allWeights[0].date + 'T12:00:00')
    const lastDate  = new Date(allWeights[allWeights.length-1].date + 'T12:00:00')
    const span = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / 86400000)
    const totalLost = allWeights[0].weight! - allWeights[allWeights.length-1].weight!
    ratePerDay = totalLost / span
  }

  // Weight chart — full history from plan start + projection to goal
  const today = new Date()
  const daysToGoal = (latestW && goalW && ratePerDay > 0) ? Math.ceil((latestW - goalW) / ratePerDay) : 180
  const planStartDate = plan?.start_date ? new Date(plan.start_date + 'T12:00:00') : new Date(today.getTime() - 28 * 86400000)
  const daysOfHistory = Math.max(28, Math.floor((today.getTime() - planStartDate.getTime()) / 86400000))
  const totalChartDays = daysOfHistory + daysToGoal + 7
  const allDays = Array.from({ length: Math.min(totalChartDays, 400) }, (_, i) => {
    const d = new Date(planStartDate); d.setDate(planStartDate.getDate() + i); return d.toISOString().split('T')[0]
  })
  const actualData = allDays.map(d => logMap[d]?.weight ?? null)
  const projData = allDays.map(d => {
    const daysFromToday = (new Date(d + 'T12:00:00').getTime() - today.getTime()) / 86400000
    if (!latestW || !goalW || ratePerDay <= 0 || daysFromToday < -1) return null
    const proj = latestW - ratePerDay * daysFromToday
    return proj >= goalW ? parseFloat(proj.toFixed(2)) : null
  })

  // Cal:protein ratio
  const cprNumerator = avgCal, cprDenominator = avgProt
  const cpr = cprNumerator && cprDenominator && cprDenominator > 0 ? (cprNumerator / cprDenominator).toFixed(1) : null
  const cprGood = cpr ? parseFloat(cpr) <= 10 : null

  // 7-day rolling weight for mini trend
  const last56 = Array.from({ length: 56 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 55 + i); return d.toISOString().split('T')[0]
  })
  const rollingData = last56.map((_, i) => {
    const window = last56.slice(Math.max(0, i - 6), i + 1).filter(d => logMap[d]?.weight != null).map(d => logMap[d].weight!)
    return window.length >= 3 ? parseFloat((window.reduce((a,b) => a+b,0)/window.length).toFixed(2)) : null
  })
  const actualRolling = last56.map(d => logMap[d]?.weight ?? null)

  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: '#7b8fb8', font: { family: 'DM Mono', size: 9 }, boxWidth: 10 } },
      tooltip: {
        backgroundColor: '#091428', borderColor: '#f97316', borderWidth: 1,
        titleColor: '#f0f4ff', bodyColor: '#7b8fb8',
        callbacks: { label: (ctx: any) => ctx.raw != null ? `${ctx.raw}kg` : '' }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#3d5070', font: { family: 'DM Mono', size: 8 }, maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#7b8fb8', font: { family: 'DM Mono', size: 9 }, callback: (v: any) => v + 'kg' } }
    }
  }

  return (
    <AppLayout>
      <PageHeader title="7-DAY" accent="OVERVIEW" sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} />

      {/* PROGRESS BAR */}
      {startW && goalW && latestW && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', padding: '20px 24px', marginBottom: '20px' }}>
          <div style={{ fontSize: '8px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: '14px' }}>Phase Progress</div>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            {/* Track */}
            <div style={{ height: '6px', background: 'var(--s3)', position: 'relative' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--or)', transition: 'width .6s ease' }} />
            </div>
            {/* Current marker */}
            {currentMarker !== null && (
              <div style={{ position: 'absolute', top: '-4px', left: `${currentMarker}%`, transform: 'translateX(-50%)' }}>
                <div style={{ width: '14px', height: '14px', background: 'var(--or)', borderRadius: '50%', border: '2px solid var(--bg)', boxShadow: '0 0 8px rgba(249,115,22,.5)' }} />
              </div>
            )}
          </div>
          {/* Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '8px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)' }}>Start</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--mu)', lineHeight: 1 }}>{startW}kg</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)' }}>Current</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: 'var(--or)', lineHeight: 1 }}>{latestW}kg</div>
              <div style={{ fontSize: '9px', color: (latestW - startW) <= 0 ? '#4ade80' : '#fca5a5', marginTop: '2px' }}>
                {(latestW - startW) <= 0 ? '↓ ' : '↑ '}{Math.abs(latestW - startW).toFixed(1)}kg
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)' }}>Goal</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: '#4ade80', lineHeight: 1 }}>{goalW}kg</div>
            </div>
          </div>
        </div>
      )}

      {/* STAT CARDS */}
      <StatGrid cols={5}>
        <StatCard label="7-Day Avg Calories" value={avgCal ? Math.round(avgCal).toLocaleString() : '—'} unit="kcal" tag={calText} tagVariant={calVar} />
        <StatCard label="7-Day Avg Protein"  value={avgProt  ? Math.round(avgProt)  : '—'} unit="g"    tag={protText}  tagVariant={protVar} />
        <StatCard label="7-Day Avg Steps"    value={avgSteps ? (avgSteps/1000).toFixed(1) : '—'} unit="k" tag={stepsText} tagVariant={stepsVar} />
        <StatCard label="7-Day Avg Weight"   value={avgWt    ? avgWt.toFixed(1)     : '—'} unit="kg"
          tag={wtDiff != null ? `${wtDiff <= 0 ? '↓' : '↑'} ${Math.abs(wtDiff).toFixed(2)}kg vs last week` : 'rolling avg'}
          tagVariant={wtDiff != null ? (wtDiff <= 0 ? 'good' : 'bad') : 'neutral'} />
        <StatCard label="Creatine Streak" value={streak} unit="days"
          tag={streak >= 7 ? '🔥 On fire' : streak >= 3 ? 'Building' : 'Start streak'}
          tagVariant={streak >= 7 ? 'good' : streak >= 3 ? 'default' : 'neutral'} />
      </StatGrid>

      {/* WEIGHT CHART — projection to goal */}
      <Panel style={{ marginBottom: '20px' }}>
        <PanelTitle>Weight Trend</PanelTitle>
        <PanelSub>Actual weights · dotted line = projected path to goal based on your avg weekly loss · hover to see predicted weight</PanelSub>
        <div style={{ height: '220px' }}>
          <Line
            data={{
              labels: allDays.map((d, i) => i % 7 === 0 ? formatDate(d) : ''),
              datasets: [
                { label: 'Actual', data: actualData, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#f97316', tension: 0.3, spanGaps: true },
                { label: 'Projected to Goal', data: projData, borderColor: 'rgba(100,160,255,.6)', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, tension: 0.2, spanGaps: true },
              ],
            }}
            options={chartOpts}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--b1)', marginTop: '14px' }}>
          <div style={{ background: 'var(--s2)', padding: '12px 14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '4px' }}>Avg Weekly Loss</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: 'var(--or)', lineHeight: 1 }}>
              {ratePerDay > 0 ? (ratePerDay * 7).toFixed(2) + 'kg' : '—'}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--mu)', marginTop: '2px' }}>per week avg</div>
          </div>
          <div style={{ background: 'var(--s2)', padding: '12px 14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '4px' }}>Current Weight</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: 'var(--tx)', lineHeight: 1 }}>
              {latestW ? latestW + 'kg' : '—'}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--mu)', marginTop: '2px' }}>latest weigh-in</div>
          </div>
          <div style={{ background: 'var(--s2)', padding: '12px 14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '4px' }}>To Goal</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: '#4ade80', lineHeight: 1 }}>
              {latestW && goalW ? (latestW - goalW).toFixed(1) + 'kg' : '—'}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--mu)', marginTop: '2px' }}>remaining</div>
          </div>
          <div style={{ background: 'var(--s2)', padding: '12px 14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '4px' }}>Est. Goal Date</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: '#93c5fd', lineHeight: 1 }}>
              {ratePerDay > 0 && latestW && goalW ? (() => { const d = new Date(); d.setDate(d.getDate() + daysToGoal); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })() : '—'}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--mu)', marginTop: '2px' }}>at current rate</div>
          </div>
        </div>
      </Panel>

      {/* BOTTOM ROW — CPR + Rolling + Creatine */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px' }}>

        {/* Cal:Protein Ratio */}
        <Panel>
          <PanelTitle>Cal:Protein Ratio</PanelTitle>
          <PanelSub>7-day avg · target 10:1</PanelSub>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '56px', lineHeight: 1, color: cprGood === true ? '#4ade80' : cprGood === false ? '#fca5a5' : 'var(--mu)' }}>
              {cpr ?? '—'}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--mu)', letterSpacing: '1px', marginTop: '4px' }}>: 1 ratio</div>
          </div>
          <div style={{ height: '8px', background: 'var(--s3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: cprGood ? 'var(--gr)' : 'var(--re)', width: cpr ? `${Math.min(100, parseFloat(cpr) / 20 * 100)}%` : '0%', transition: 'width .6s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '7px', color: 'var(--mu2)' }}>0</span>
            <span style={{ fontSize: '7px', color: 'var(--or)' }}>10 target</span>
            <span style={{ fontSize: '7px', color: 'var(--mu2)' }}>20</span>
          </div>
          <div style={{ marginTop: '10px', fontSize: '9px', color: cprGood ? '#4ade80' : '#fca5a5', lineHeight: 1.6 }}>
            {cpr ? (cprGood ? '✓ Good protein density' : `✗ ${(parseFloat(cpr) - 10).toFixed(1)} above target — increase protein`) : 'Log calories and protein to calculate'}
          </div>
        </Panel>

        {/* 7-day rolling weight trend */}
        <Panel>
          <PanelTitle>7-Day Rolling Weight</PanelTitle>
          <PanelSub>Smoothed trend · removes daily fluctuations · last 56 days</PanelSub>
          <div style={{ height: '160px' }}>
            <Line
              data={{
                labels: last56.map((d, i) => i % 7 === 0 ? formatDate(d) : ''),
                datasets: [
                  { label: 'Daily', data: actualRolling, borderColor: 'rgba(249,115,22,.3)', backgroundColor: 'transparent', borderWidth: 1, pointRadius: 1, tension: 0.2, spanGaps: true },
                  { label: '7-Day Avg', data: rollingData, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.06)', borderWidth: 2, pointRadius: 0, tension: 0.4, spanGaps: true, fill: true },
                ],
              }}
              options={chartOpts}
            />
          </div>
        </Panel>

        {/* Creatine */}
        <Panel style={{ display: 'flex', flexDirection: 'column' }}>
          <PanelTitle>Creatine</PanelTitle>
          <PanelSub>Daily streak</PanelSub>
          <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '62px', color: 'var(--or)', lineHeight: 1, textShadow: '0 0 24px rgba(249,115,22,.3)' }}>{streak}</div>
            <div style={{ fontSize: '8px', letterSpacing: '4px', color: 'var(--mu)', textTransform: 'uppercase', marginTop: '4px' }}>Day Streak</div>
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
            {Array.from({ length: 14 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (13 - i))
              const ds = d.toISOString().split('T')[0]
              const e = logMap[ds]
              return <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: e?.creatine === true ? '#f97316' : e?.creatine === false ? 'var(--mu2)' : 'var(--s3)', boxShadow: e?.creatine === true ? '0 0 6px rgba(249,115,22,.5)' : undefined }} />
            })}
          </div>
        </Panel>
      </div>

      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
