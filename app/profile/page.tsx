'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, Btn, Input, Select, Textarea, Grid3, ProgressBar, Toast, Divider } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'
import { calcBMR, calcTDEE, ACTIVITY_LEVELS } from '@/lib/utils'

export default function ProfilePage() {
  const [prof, setProf] = useState<Partial<Profile>>({})
  const [userId, setUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [whyLen, setWhyLen] = useState(0)
  const [latestW, setLatestW] = useState<number | null>(null)
  const supabase = createClient()
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const [{ data: p }, { data: logs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', data.user.id).single(),
        supabase.from('daily_logs').select('date,weight').eq('user_id', data.user.id).not('weight', 'is', null).order('date', { ascending: false }).limit(1),
      ])
      if (p) { setProf(p); setWhyLen(p.why?.length || 0) }
      if (logs?.[0]) setLatestW(logs[0].weight)
    })
  }, [])

  const wt = latestW || prof.start_weight
  const bmr = (wt && prof.height_cm && prof.age && prof.gender) ? calcBMR(wt, prof.height_cm, prof.age, prof.gender) : null
  const tdee = (bmr && prof.activity_level) ? calcTDEE(bmr, prof.activity_level) : null

  async function save() {
    if ((prof.why?.length || 0) < 100) { showToast('Your Why needs at least 100 characters'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({ ...prof, id: userId, bmr: bmr || prof.bmr, maintenance_cals: tdee || prof.maintenance_cals })
    if (error) showToast('Error: ' + error.message); else showToast('Profile saved ✓')
    setSaving(false)
  }

  const sw = prof.start_weight, gw = prof.goal_weight, cw = latestW
  const progress = sw && gw && cw ? Math.max(0, Math.min(100, (sw - cw) / (sw - gw) * 100)) : 0
  const whyOk = whyLen >= 100

  return (
    <AppLayout>
      <PageHeader title="MY" accent="PROFILE" sub="Personal stats and blueprint" />

      {prof.name && (
        <Panel style={{ marginBottom: '20px' }}>
          <PanelTitle>Your Blueprint</PanelTitle>
          <PanelSub>Current snapshot</PanelSub>
          <Grid3 mb>
            {[{label:'Start',val:sw,color:'var(--mu)'},{label:'Current',val:cw||sw,color:'var(--or)'},{label:'Goal',val:gw,color:'#4ade80'}].map(({ label, val, color }) => (
              <div key={label} style={{ background:'var(--s2)',padding:'16px',textAlign:'center' }}>
                <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'6px' }}>{label}</div>
                <div style={{ fontFamily:'Bebas Neue',fontSize:'40px',color,lineHeight:1 }}>{val ?? '—'}</div>
                <div style={{ fontSize:'9px',color:'var(--mu)' }}>kg</div>
                {label === 'Current' && cw && sw && <div style={{ fontSize:'9px',marginTop:'4px',color:(cw-sw)<=0?'#4ade80':'#fca5a5' }}>{(cw-sw)<=0?'↓ ':'↑ '}{Math.abs(cw-sw).toFixed(1)}kg since start</div>}
              </div>
            ))}
          </Grid3>
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'6px' }}>
            <span style={{ fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)' }}>Progress to Goal</span>
            <span style={{ fontSize:'10px',color:'var(--or2)' }}>{progress.toFixed(0)}%</span>
          </div>
          <ProgressBar value={progress} height={8} />
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1px',background:'var(--b1)',marginTop:'16px' }}>
            {[{l:'Name',v:prof.name},{l:'Age',v:prof.age?`${prof.age} yrs`:'—'},{l:'Gender',v:prof.gender||'—'},{l:'Height',v:prof.height_cm?`${prof.height_cm}cm`:'—'},{l:'Job',v:prof.job||'—'},{l:'Activity',v:ACTIVITY_LEVELS.find(a=>a.value===prof.activity_level)?.label||'—'},{l:'BMR',v:bmr?`${bmr.toLocaleString()} kcal`:'—'},{l:'TDEE',v:tdee?`${tdee.toLocaleString()} kcal`:'—'},{l:'Supplements',v:prof.supplements||'—'}].map(({l,v})=>(
              <div key={l} style={{ background:'var(--s2)',padding:'12px 14px' }}>
                <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'4px' }}>{l}</div>
                <div style={{ fontSize:'13px',letterSpacing:'0.5px' }}>{v}</div>
              </div>
            ))}
          </div>
          {prof.why && <div style={{ marginTop:'16px' }}><Divider label="Your Why" /><div style={{ fontFamily:'Instrument Serif',fontSize:'15px',lineHeight:1.7,borderLeft:'3px solid var(--or)',paddingLeft:'16px' }}>{prof.why}</div></div>}
          {prof.allergies && <div style={{ marginTop:'12px',padding:'10px 14px',background:'var(--amd)',border:'1px solid var(--am)',fontSize:'11px',color:'#fcd34d' }}>⚠ {prof.allergies}</div>}
        </Panel>
      )}

      <Panel>
        <PanelTitle>Edit Profile</PanelTitle>
        <PanelSub>Fill everything in — drives BMR, TDEE and all calculations</PanelSub>
        <div style={{ background:'rgba(249,115,22,.06)',border:'1px solid var(--or)',padding:'18px',marginBottom:'20px' }}>
          <div style={{ fontSize:'8px',letterSpacing:'3px',textTransform:'uppercase',color:'var(--or)',marginBottom:'8px' }}>⚡ Your Why — Required (100+ characters)</div>
          <textarea value={prof.why||''} onChange={e=>{setProf(p=>({...p,why:e.target.value}));setWhyLen(e.target.value.length)}} placeholder="Why are you doing this? What does achieving your goal mean to you? Be specific and honest." style={{ width:'100%',minHeight:'90px',background:'var(--s2)',border:`1px solid ${whyOk?'var(--gr)':'var(--b2)'}`,color:'var(--tx)',padding:'10px 12px',fontSize:'12px',fontFamily:'DM Mono',resize:'vertical',outline:'none' }} />
          <div style={{ display:'flex',justifyContent:'space-between',marginTop:'6px' }}>
            <span style={{ fontSize:'9px',color:'var(--mu)' }}>{whyLen} / 100</span>
            <span style={{ fontSize:'9px',color:whyOk?'#4ade80':'#fca5a5' }}>{whyOk?'✓ Good':`✗ ${100-whyLen} more needed`}</span>
          </div>
        </div>
        <Divider label="Demographics" />
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px' }}>
          <Input label="First Name" value={prof.name||''} onChange={v=>setProf(p=>({...p,name:v}))} placeholder="Jamie" />
          <Input label="Age" value={prof.age?.toString()||''} onChange={v=>setProf(p=>({...p,age:parseInt(v)||null}))} type="number" placeholder="25" />
          <Select label="Gender" value={prof.gender||''} onChange={v=>setProf(p=>({...p,gender:v}))} options={[{value:'',label:'Select'},{value:'Male',label:'Male'},{value:'Female',label:'Female'},{value:'Other',label:'Other'}]} />
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
          <Input label="Height (cm)" value={prof.height_cm?.toString()||''} onChange={v=>setProf(p=>({...p,height_cm:parseFloat(v)||null}))} type="number" placeholder="178" />
          <Input label="Job / Lifestyle" value={prof.job||''} onChange={v=>setProf(p=>({...p,job:v}))} placeholder="e.g. Office worker" />
        </div>
        <Divider label="Body Stats" />
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px' }}>
          <Input label="Start Weight (kg)" value={prof.start_weight?.toString()||''} onChange={v=>setProf(p=>({...p,start_weight:parseFloat(v)||null}))} type="number" placeholder="83.0" />
          <div>
            <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>Current Weight <span style={{ color:'var(--or2)' }}>AUTO from log</span></label>
            <div style={{ background:'var(--s3)',border:'1px solid var(--b2)',padding:'9px 12px',fontSize:'13px',color:latestW?'var(--or2)':'var(--mu)' }}>{latestW?`${latestW} kg`:'No weight logged yet'}</div>
          </div>
          <Input label="Goal Weight (kg)" value={prof.goal_weight?.toString()||''} onChange={v=>setProf(p=>({...p,goal_weight:parseFloat(v)||null}))} type="number" placeholder="75.0" />
        </div>
        <Divider label="Calculated Stats" />
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px' }}>
          <Select label="Activity Level" value={prof.activity_level?.toString()||''} onChange={v=>setProf(p=>({...p,activity_level:parseFloat(v)||null}))} options={[{value:'',label:'Select level'},...ACTIVITY_LEVELS.map(a=>({value:a.value.toString(),label:`${a.label} — ${a.desc}`}))]} />
          <div>
            <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>BMR <span style={{ color:'var(--or2)' }}>AUTO</span></label>
            <div style={{ background:'var(--s3)',border:'1px solid var(--b2)',padding:'9px 12px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--or)' }}>{bmr?.toLocaleString()||'—'}</span>
              <span style={{ fontSize:'9px',color:'var(--mu)' }}>kcal/day</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>Maintenance TDEE <span style={{ color:'var(--or2)' }}>AUTO</span></label>
            <div style={{ background:'var(--s3)',border:'1px solid var(--b2)',padding:'9px 12px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Bebas Neue',fontSize:'22px',color:'var(--or)' }}>{tdee?.toLocaleString()||(prof.activity_level?'—':'Pick activity')}</span>
              <span style={{ fontSize:'9px',color:'var(--mu)' }}>kcal/day</span>
            </div>
          </div>
        </div>
        <div style={{ background:'var(--s2)',border:'1px solid var(--b1)',padding:'10px 14px',fontSize:'9px',color:'var(--mu)',marginBottom:'16px',lineHeight:1.7 }}>BMR uses Mifflin-St Jeor formula · TDEE = BMR × activity multiplier</div>
        <Divider label="Health" />
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
          <Input label="Allergies / Restrictions" value={prof.allergies||''} onChange={v=>setProf(p=>({...p,allergies:v}))} placeholder="e.g. Lactose intolerant" />
          <Input label="Current Supplements" value={prof.supplements||''} onChange={v=>setProf(p=>({...p,supplements:v}))} placeholder="e.g. Creatine, Vitamin D" />
        </div>
        <Textarea label="Personal Notes" value={prof.notes||''} onChange={v=>setProf(p=>({...p,notes:v}))} placeholder="Goals, motivation, anything else..." />
        <div style={{ marginTop:'16px',display:'flex',gap:'12px',alignItems:'center' }}>
          <Btn variant="primary" onClick={save} disabled={saving||!whyOk}>{saving?'Saving...':'Save Profile'}</Btn>
          {!whyOk && <span style={{ fontSize:'9px',color:'var(--mu)' }}>Complete your Why to save</span>}
        </div>
      </Panel>
      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
