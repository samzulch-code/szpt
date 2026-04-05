'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, Btn, Toast, Grid2 } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { DailyLog, Plan } from '@/types'
import { today, daysAgo, formatDate } from '@/lib/utils'

interface Snapshot {
  date: string
  calories: number | null
  protein: number | null
  weight: number | null
  plan: Plan | null
  allLogs: DailyLog[]
}

function DailySnapshot({ snap, onClose }: { snap: Snapshot; onClose: () => void }) {
  const { calories, protein, weight, plan, allLogs, date } = snap
  const maint = plan?.maintenance_cals ?? null
  const calTarget = plan?.cal_target ?? null
  const protTarget = plan?.prot_target ?? null

  // Fat burnt today
  const deficit = maint && calories ? maint - calories : null
  const fatBurntG = deficit ? Math.round((deficit / 7700) * 1000) : null

  // Cal:protein ratio
  const cpr = calories && protein && protein > 0 ? (calories / protein).toFixed(1) : null
  const cprGood = cpr ? parseFloat(cpr) <= 10 : null

  // vs targets
  const calStatus = calories && calTarget ? (calories <= calTarget ? 'good' : 'bad') : null
  const protStatus = protein && protTarget ? (protein >= protTarget ? 'good' : 'bad') : null

  // Weekly average impact
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i); return d.toISOString().split('T')[0]
  })
  const logMap = Object.fromEntries(allLogs.map(l => [l.date, l]))
  const weekWts = days7.filter(d => logMap[d]?.weight != null).map(d => logMap[d].weight!)
  const weekAvg = weekWts.length ? weekWts.reduce((a,b) => a+b,0) / weekWts.length : null

  // All-time phase low
  const phaseLogs = plan?.start_date ? allLogs.filter(l => l.date >= plan.start_date! && l.weight != null) : []
  const phaseMinWt = phaseLogs.length ? Math.min(...phaseLogs.map(l => l.weight!)) : null
  const isAllTimeLow = weight && phaseMinWt ? weight <= phaseMinWt : false

  // Predicted next weigh-in (rolling 7-day avg change)
  const allWeights = allLogs.filter(l => l.weight != null).sort((a,b) => a.date.localeCompare(b.date))
  let ratePerDay = 0
  if (allWeights.length >= 2) {
    const span = Math.max(1, (new Date(allWeights[allWeights.length-1].date).getTime() - new Date(allWeights[0].date).getTime()) / 86400000)
    ratePerDay = (allWeights[0].weight! - allWeights[allWeights.length-1].weight!) / span
  }
  const latestW = allWeights.length ? allWeights[allWeights.length-1].weight! : null
  const predictedNext = latestW ? (latestW - ratePerDay).toFixed(2) : null
  const predictedLow  = latestW ? (latestW - ratePerDay * 1.3).toFixed(2) : null
  const predictedHigh = latestW ? (latestW - ratePerDay * 0.7).toFixed(2) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,13,26,.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--or)', maxWidth: '480px', width: '100%', padding: '28px', position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '22px', letterSpacing: '2px', color: 'var(--or)' }}>Day Logged</div>
            <div style={{ fontSize: '9px', color: 'var(--mu)', letterSpacing: '2px', textTransform: 'uppercase' }}>{formatDate(date)}</div>
          </div>
          {isAllTimeLow && weight && (
            <div style={{ background: 'var(--grd)', border: '1px solid var(--gr)', padding: '6px 12px', fontSize: '9px', color: '#4ade80', letterSpacing: '1px', textTransform: 'uppercase' }}>
              🏆 Phase Low — {weight}kg
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--b1)', marginBottom: '16px' }}>
          {/* Fat burnt */}
          <div style={{ background: 'var(--s2)', padding: '14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '4px' }}>Fat Burnt Today</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: fatBurntG && fatBurntG > 0 ? '#4ade80' : '#fca5a5', lineHeight: 1 }}>
              {fatBurntG != null ? `${fatBurntG > 0 ? fatBurntG : 0}g` : '—'}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--mu)', marginTop: '3px' }}>
              {deficit != null ? (deficit > 0 ? `${deficit} kcal deficit` : `${Math.abs(deficit)} kcal surplus`) : 'Set maintenance to calculate'}
            </div>
          </div>

          {/* Cal:Protein */}
          <div style={{ background: 'var(--s2)', padding: '14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '4px' }}>Cal:Protein Ratio</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: cprGood ? '#4ade80' : cpr ? '#fca5a5' : 'var(--mu)', lineHeight: 1 }}>
              {cpr ? `${cpr}:1` : '—'}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--mu)', marginTop: '3px' }}>
              {cprGood === true ? '✓ On target (≤10:1)' : cprGood === false ? '✗ Over — lift protein' : 'Log calories & protein'}
            </div>
          </div>

          {/* vs targets */}
          <div style={{ background: 'var(--s2)', padding: '14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '8px' }}>vs Targets</div>
            <div style={{ fontSize: '10px', lineHeight: 2 }}>
              {calories && calTarget ? (
                <div style={{ color: calStatus === 'good' ? '#4ade80' : '#fca5a5' }}>
                  {calStatus === 'good' ? '✓' : '✗'} Cals: {calories} / {calTarget}
                </div>
              ) : <div style={{ color: 'var(--mu)' }}>— Calories</div>}
              {protein && protTarget ? (
                <div style={{ color: protStatus === 'good' ? '#4ade80' : '#fca5a5' }}>
                  {protStatus === 'good' ? '✓' : '↓'} Protein: {protein}g / {protTarget}g
                </div>
              ) : <div style={{ color: 'var(--mu)' }}>— Protein</div>}
            </div>
          </div>

          {/* Weekly avg impact */}
          <div style={{ background: 'var(--s2)', padding: '14px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '4px' }}>Weekly Avg Weight</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', color: 'var(--or)', lineHeight: 1 }}>
              {weekAvg ? `${weekAvg.toFixed(2)}kg` : '—'}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--mu)', marginTop: '3px' }}>
              {weekWts.length} weigh-ins this week
            </div>
          </div>
        </div>

        {/* Predicted next weigh-in */}
        {predictedNext && ratePerDay > 0 && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', marginBottom: '6px' }}>Predicted Next Weigh-In</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '32px', color: '#93c5fd', lineHeight: 1 }}>{predictedNext}kg</div>
              <div style={{ fontSize: '9px', color: 'var(--mu)' }}>range: {predictedLow} – {predictedHigh}kg</div>
            </div>
            <div style={{ fontSize: '9px', color: 'var(--mu)', marginTop: '4px' }}>Based on your avg daily loss of {(ratePerDay * 1000).toFixed(0)}g/day</div>
          </div>
        )}

        <Btn variant="primary" onClick={onClose} fullWidth>Done →</Btn>
      </div>
    </div>
  )
}

export default function LogPage() {
  const [date, setDate] = useState(today())
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [steps, setSteps] = useState('')
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [recent, setRecent] = useState<DailyLog[]>([])
  const [allLogs, setAllLogs] = useState<DailyLog[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [userId, setUserId] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const [{ data: l }, { data: all }, { data: p }] = await Promise.all([
        supabase.from('daily_logs').select('*').eq('user_id', data.user.id).order('date', { ascending: false }).limit(14),
        supabase.from('daily_logs').select('*').eq('user_id', data.user.id).order('date'),
        supabase.from('plans').select('*').eq('user_id', data.user.id).eq('is_active', true).single(),
      ])
      if (l) setRecent(l)
      if (all) setAllLogs(all)
      if (p) setPlan(p)
      loadDay(data.user.id, today())
    })
  }, [])

  async function loadDay(uid: string, d: string) {
    const { data } = await supabase.from('daily_logs').select('*').eq('user_id', uid).eq('date', d).single()
    if (data) {
      setCalories(data.calories?.toString() ?? '')
      setProtein(data.protein?.toString() ?? '')
      setSteps(data.steps?.toString() ?? '')
      setWeight(data.weight?.toString() ?? '')
    } else {
      setCalories(''); setProtein(''); setSteps(''); setWeight('')
    }
  }

  async function handleDateChange(d: string) {
    setDate(d)
    if (userId) loadDay(userId, d)
  }

  async function saveAll() {
    setSaving(true)
    const payload = {
      user_id: userId, date,
      calories: calories ? parseInt(calories) : null,
      protein: protein ? parseInt(protein) : null,
      steps: steps ? parseInt(steps) : null,
      weight: weight ? parseFloat(weight) : null,
    }
    const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,date' })
    if (error) { showToast('Error: ' + error.message); setSaving(false); return }

    // Refresh all logs for snapshot
    const { data: all } = await supabase.from('daily_logs').select('*').eq('user_id', userId).order('date')
    if (all) setAllLogs(all)

    // Show snapshot
    setSnapshot({
      date,
      calories: payload.calories,
      protein: payload.protein,
      weight: payload.weight,
      plan,
      allLogs: all || allLogs,
    })

    const { data: l } = await supabase.from('daily_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(14)
    if (l) setRecent(l)
    setSaving(false)
  }

  async function saveCreatine(d: string, val: boolean) {
    await supabase.from('daily_logs').upsert({ user_id: userId, date: d, creatine: val }, { onConflict: 'user_id,date' })
    const { data } = await supabase.from('daily_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(14)
    if (data) setRecent(data)
    showToast(val ? 'Creatine logged ✓' : 'Missed logged')
  }

  const inputStyle = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)',
    color: 'var(--tx)', padding: '9px 12px', fontSize: '13px',
    letterSpacing: '1px', outline: 'none', fontFamily: 'DM Mono',
  }

  return (
    <AppLayout>
      <PageHeader title="LOG" accent="DATA" sub="Enter your daily metrics" />

      <Grid2>
        <Panel>
          <PanelTitle>Daily Metrics</PanelTitle>
          <PanelSub>Calories · Protein · Steps · Weight</PanelSub>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <label style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)', whiteSpace: 'nowrap' }}>Date</label>
            <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} style={{ ...inputStyle, maxWidth: '200px' }} />
          </div>

          {[
            { label: 'Calories (kcal)', val: calories, set: setCalories, placeholder: '1800' },
            { label: 'Protein (g)', val: protein, set: setProtein, placeholder: '175' },
            { label: 'Steps', val: steps, set: setSteps, placeholder: '10000' },
            { label: 'Weight (kg)', val: weight, set: setWeight, placeholder: '83.2', step: '0.1' },
          ].map(({ label, val, set, placeholder, step }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--b1)' }}>
              <span style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)' }}>{label}</span>
              <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={placeholder} step={step || '1'} style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--or)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--b2)'} />
            </div>
          ))}

          <div style={{ marginTop: '16px' }}>
            <Btn variant="primary" onClick={saveAll} disabled={saving} fullWidth>
              {saving ? 'Saving...' : '↓ Save All for This Day'}
            </Btn>
          </div>
        </Panel>

        <Panel>
          <PanelTitle>Creatine Log</PanelTitle>
          <PanelSub>Last 7 days — tap to toggle</PanelSub>
          {Array.from({ length: 7 }, (_, i) => {
            const d = daysAgo(i)
            const entry = recent.find(r => r.date === d)
            return (
              <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--b1)' }}>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '1px' }}>
                    {formatDate(d)} {i === 0 && <span style={{ fontSize: '8px', color: 'var(--or2)', letterSpacing: '1px' }}>today</span>}
                  </div>
                  {entry?.calories != null && (
                    <div style={{ fontSize: '9px', color: 'var(--mu)', marginTop: '2px' }}>
                      {entry.calories} kcal{entry.weight ? ` · ${entry.weight}kg` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex' }}>
                  {[true, false].map(val => (
                    <button key={val.toString()} onClick={() => saveCreatine(d, val)} style={{
                      padding: '6px 14px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                      borderRight: val ? 'none' : undefined,
                      background: entry?.creatine === val ? (val ? 'var(--grd)' : 'var(--red)') : 'transparent',
                      border: entry?.creatine === val ? `1px solid ${val ? 'var(--gr)' : 'var(--re)'}` : '1px solid var(--b2)',
                      color: entry?.creatine === val ? (val ? '#4ade80' : '#fca5a5') : 'var(--mu)',
                    }}>
                      {val ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </Panel>
      </Grid2>

      {snapshot && <DailySnapshot snap={snapshot} onClose={() => setSnapshot(null)} />}
      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
