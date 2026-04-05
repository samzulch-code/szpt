'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, Grid2, Btn, Toast } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { ProgressPhoto } from '@/types'
import { formatDate } from '@/lib/utils'

export default function PhotosPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [userId, setUserId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [label, setLabel] = useState('Front')
  const [note, setNote] = useState('')
  const [cmpA, setCmpA] = useState('')
  const [cmpB, setCmpB] = useState('')
  const supabase = createClient()
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      loadPhotos(data.user.id)
    })
  }, [])

  async function loadPhotos(uid: string) {
    const { data } = await supabase.from('progress_photos').select('*').eq('user_id', uid).order('date', { ascending: false })
    if (!data) return
    const withUrls = await Promise.all(data.map(async p => {
      const { data: url } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 3600)
      return { ...p, url: url?.signedUrl }
    }))
    setPhotos(withUrls)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    const path = `${userId}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file)
    if (upErr) { showToast('Upload error: '+upErr.message); setUploading(false); return }
    const { data: log } = await supabase.from('daily_logs').select('weight').eq('user_id', userId).eq('date', date).single()
    const { error } = await supabase.from('progress_photos').insert({ user_id: userId, date, label, note, storage_path: path, weight_on_day: log?.weight ?? null })
    if (error) showToast('Save error: '+error.message); else { showToast('Photo saved ✓'); setNote(''); loadPhotos(userId) }
    setUploading(false)
    e.target.value = ''
  }

  async function deletePhoto(photo: ProgressPhoto) {
    await supabase.storage.from('photos').remove([photo.storage_path])
    await supabase.from('progress_photos').delete().eq('id', photo.id)
    loadPhotos(userId)
    showToast('Photo deleted')
  }

  const photoA = photos.find(p => p.id === cmpA)
  const photoB = photos.find(p => p.id === cmpB)

  return (
    <AppLayout>
      <PageHeader title="PROGRESS" accent="PHOTOS" sub="Visual record of your transformation" />
      <Grid2>
        <Panel>
          <PanelTitle>Add Photo</PanelTitle>
          <PanelSub>Upload a check-in photo</PanelSub>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px' }}>
            <div>
              <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ width:'100%',background:'var(--s2)',border:'1px solid var(--b2)',color:'var(--tx)',padding:'9px 12px',fontSize:'12px',fontFamily:'DM Mono',outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>Angle</label>
              <select value={label} onChange={e=>setLabel(e.target.value)} style={{ width:'100%',background:'var(--s2)',border:'1px solid var(--b2)',color:'var(--tx)',padding:'9px 12px',fontSize:'12px',fontFamily:'DM Mono',outline:'none',cursor:'pointer' }}>
                {['Front','Side','Back','Flexing','Other'].map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:'12px' }}>
            <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>Note (optional)</label>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Week 8 check-in" style={{ width:'100%',background:'var(--s2)',border:'1px solid var(--b2)',color:'var(--tx)',padding:'9px 12px',fontSize:'12px',fontFamily:'DM Mono',outline:'none' }} />
          </div>
          <label style={{ display:'block',background:'var(--or)',color:'#050d1a',fontFamily:'DM Mono',fontSize:'9px',letterSpacing:'2px',textTransform:'uppercase',padding:'12px',textAlign:'center',cursor:'pointer' }}>
            {uploading ? 'Uploading...' : '📷 Choose & Upload Photo'}
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} style={{ display:'none' }} />
          </label>
        </Panel>

        <Panel>
          <PanelTitle>Compare</PanelTitle>
          <PanelSub>Side-by-side comparison</PanelSub>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px' }}>
            {['Before','After'].map((lbl,i) => (
              <div key={lbl}>
                <label style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)',display:'block',marginBottom:'5px' }}>{lbl}</label>
                <select value={i===0?cmpA:cmpB} onChange={e=>i===0?setCmpA(e.target.value):setCmpB(e.target.value)} style={{ width:'100%',background:'var(--s2)',border:'1px solid var(--b2)',color:'var(--tx)',padding:'9px 12px',fontSize:'11px',fontFamily:'DM Mono',outline:'none',cursor:'pointer' }}>
                  <option value="">Select</option>
                  {photos.map(p=><option key={p.id} value={p.id}>{formatDate(p.date)} — {p.label}{p.weight_on_day?` (${p.weight_on_day}kg)`:''}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px',background:'var(--b1)' }}>
            {[{photo:photoA,label:'Before',color:'var(--or)'},{photo:photoB,label:'After',color:'#4ade80'}].map(({photo,label,color})=>(
              <div key={label} style={{ background:'var(--s2)',aspectRatio:'3/4',position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center' }}>
                {photo?.url ? <>
                  <img src={photo.url} alt={label} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                  <div style={{ position:'absolute',top:'8px',left:'8px',fontSize:'8px',letterSpacing:'2px',textTransform:'uppercase',background:'rgba(5,13,26,.8)',padding:'3px 8px',color }}>{label}</div>
                </> : <span style={{ fontSize:'8px',letterSpacing:'2px',color:'var(--mu2)',textTransform:'uppercase' }}>{label}</span>}
              </div>
            ))}
          </div>
          {photoA && photoB && photoA.weight_on_day && photoB.weight_on_day && (
            <div style={{ marginTop:'12px',background:'var(--s2)',border:'1px solid var(--b1)',padding:'12px',display:'flex',justifyContent:'space-around',alignItems:'center' }}>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)' }}>Before</div><div style={{ fontFamily:'Bebas Neue',fontSize:'26px',color:'var(--mu)' }}>{photoA.weight_on_day}kg</div></div>
              <div style={{ color:'var(--mu2)',fontSize:'16px' }}>→</div>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)' }}>After</div><div style={{ fontFamily:'Bebas Neue',fontSize:'26px',color:'var(--or)' }}>{photoB.weight_on_day}kg</div></div>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu)' }}>Change</div>
                <div style={{ fontFamily:'Bebas Neue',fontSize:'26px',color:(photoB.weight_on_day-photoA.weight_on_day)<=0?'#4ade80':'#fca5a5' }}>
                  {(photoB.weight_on_day-photoA.weight_on_day)>0?'+':''}{(photoB.weight_on_day-photoA.weight_on_day).toFixed(1)}kg
                </div>
              </div>
            </div>
          )}
        </Panel>
      </Grid2>

      <Panel>
        <PanelTitle>All Photos</PanelTitle>
        <PanelSub>Full check-in history</PanelSub>
        {!photos.length ? (
          <div style={{ fontSize:'10px',color:'var(--mu)',letterSpacing:'2px',padding:'20px 0',textTransform:'uppercase' }}>No photos yet — upload your first check-in above</div>
        ) : (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'12px' }}>
            {photos.map(p => (
              <div key={p.id} style={{ background:'var(--s2)',border:'1px solid var(--b1)',position:'relative',aspectRatio:'3/4',overflow:'hidden',cursor:'pointer' }}>
                {p.url && <img src={p.url} alt={p.label||''} style={{ width:'100%',height:'100%',objectFit:'cover',display:'block' }} />}
                <div style={{ position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(5,13,26,.9))',padding:'20px 8px 8px' }}>
                  <div style={{ fontSize:'9px',letterSpacing:'1px',textTransform:'uppercase',color:'var(--tx)' }}>{p.label}{p.note?` — ${p.note}`:''}</div>
                  <div style={{ fontSize:'8px',color:'var(--or2)',marginTop:'2px' }}>{formatDate(p.date)}{p.weight_on_day?` · ${p.weight_on_day}kg`:''}</div>
                </div>
                <button onClick={()=>deletePhoto(p)} style={{ position:'absolute',top:'6px',right:'6px',background:'rgba(239,68,68,.85)',border:'none',color:'#fff',width:'22px',height:'22px',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
