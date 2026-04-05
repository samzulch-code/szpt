'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, Grid2 } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { DailyLog } from '@/types'
import { last28Days, last56Days, avg, formatDate } from '@/lib/utils'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('daily_logs').select('*').eq('user_id', data.user.id).order('date')
        .then(({ data: l }) => { if (l) setLogs(l) })
    })
  }, [])

  const logMap = Object.fromEntries(logs.map(l => [l.date, l]))
  const days28 = last28Days()
  const days56 = last56Days()

  // Cal:Protein ratio
  const days7 = days28.slice(-7)
  const cals7 = days7.filter(d=>logMap[d]?.calories&&logMap[d]?.protein).map(d=>logMap[d].calories!)
  const prots7 = days7.filter(d=>logMap[d]?.calories&&logMap[d]?.protein).map(d=>logMap[d].protein!)
  const avgCPR = (avg(cals7)&&avg(prots7)&&avg(prots7)!>0) ? (avg(cals7)!/avg(prots7)!).toFixed(1) : null
  const cprPct = avgCPR ? Math.min(100, Math.max(0, (1-(parseFloat(avgCPR)-10)/20)*100)) : 0

  // Rolling 7-day avg
  const rollingData = days56.map((_, i) => {
    const window = days56.slice(Math.max(0,i-6),i+1).filter(d=>logMap[d]?.weight!=null).map(d=>logMap[d].weight!)
    return window.length >= 3 ? parseFloat((window.reduce((a,b)=>a+b,0)/window.length).toFixed(2)) : null
  })
  const actualWts = days56.map(d => logMap[d]?.weight ?? null)

  // Rolling summary
  const last7wts = days56.slice(-7).filter(d=>logMap[d]?.weight).map(d=>logMap[d].weight!)
  const prev7wts = days56.slice(-14,-7).filter(d=>logMap[d]?.weight).map(d=>logMap[d].weight!)
  const curAvg = avg(last7wts), prevAvg = avg(prev7wts)
  const change = curAvg && prevAvg ? curAvg - prevAvg : null

  // CPR history
  const cprHistory = days28.map(d => {
    if (!logMap[d]?.calories || !logMap[d]?.protein || logMap[d].protein! <= 0) return null
    return parseFloat((logMap[d].calories! / logMap[d].protein!).toFixed(2))
  })

  const chartOpts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:true, labels:{color:'#7b8fb8',font:{family:'DM Mono',size:9},boxWidth:10}}, tooltip:{backgroundColor:'#091428',borderColor:'#f97316',borderWidth:1,titleColor:'#f0f4ff',bodyColor:'#7b8fb8'}}, scales:{ x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#3d5070',font:{family:'DM Mono',size:8},maxTicksLimit:7}}, y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#7b8fb8',font:{family:'DM Mono',size:9}}} } }

  return (
    <AppLayout>
      <PageHeader title="DEEP" accent="ANALYTICS" sub="Performance levers and data insights" />

      {/* Levers */}
      <Panel style={{ marginBottom:'20px' }}>
        <PanelTitle>Levers of Muscle Growth</PanelTitle>
        <PanelSub>Two key variables — max out both for optimal results</PanelSub>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px' }}>
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'8px' }}>
              <span style={{ fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase' }}>Calorie:Protein Ratio</span>
              <div><span style={{ fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--or)' }}>{avgCPR||'—'}</span><span style={{ fontSize:'9px',color:'var(--mu)',marginLeft:'4px' }}>/ 10 max</span></div>
            </div>
            <div style={{ background:'var(--s3)',height:'10px',overflow:'hidden' }}>
              <div style={{ height:'100%',width:`${cprPct}%`,background:'linear-gradient(90deg,var(--or),var(--gr))',transition:'width .8s ease' }} />
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',marginTop:'4px' }}>
              {['0','2.5','5','7.5','10'].map(t=><span key={t} style={{ fontSize:'7px',color:'var(--mu2)' }}>{t}</span>)}
            </div>
            <div style={{ fontSize:'9px',color:'var(--mu)',marginTop:'8px',lineHeight:1.6 }}>Target: <strong style={{ color:'var(--tx)' }}>10:1</strong> (10 kcal per 1g protein). Lower ratio = better protein density for muscle.</div>
            <div style={{ marginTop:'8px',background:'var(--s2)',border:'1px solid var(--b1)',padding:'10px 12px' }}>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'6px' }}>Last 7 days</div>
              {days7.filter(d=>logMap[d]?.calories&&logMap[d]?.protein).length === 0
                ? <div style={{ fontSize:'9px',color:'var(--mu)' }}>Log calories and protein to see breakdown.</div>
                : days7.filter(d=>logMap[d]?.calories&&logMap[d]?.protein).map(d=>{
                    const r = (logMap[d].calories!/logMap[d].protein!).toFixed(1)
                    return <div key={d} style={{ fontSize:'9px',color:'var(--mu)',lineHeight:1.9 }}>{formatDate(d)}: <span style={{ color:parseFloat(r)<=10?'#4ade80':'#fca5a5' }}>{r}:1</span> ({logMap[d].calories} kcal / {logMap[d].protein}g)</div>
                  })
              }
            </div>
          </div>
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'8px' }}>
              <span style={{ fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase' }}>Volume (Sets/Muscle)</span>
              <div><span style={{ fontFamily:'Bebas Neue',fontSize:'28px',color:'var(--bl)' }}>—</span><span style={{ fontSize:'9px',color:'var(--mu)',marginLeft:'4px' }}>/ 20 max</span></div>
            </div>
            <div style={{ background:'var(--s3)',height:'10px',overflow:'hidden' }}>
              <div style={{ height:'100%',width:'0%',background:'linear-gradient(90deg,var(--bl),var(--gr))',transition:'width .8s ease' }} />
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',marginTop:'4px' }}>
              {['0','5','10','15','20'].map(t=><span key={t} style={{ fontSize:'7px',color:'var(--mu2)' }}>{t}</span>)}
            </div>
            <div style={{ fontSize:'9px',color:'var(--mu)',marginTop:'8px',lineHeight:1.6 }}>Target: <strong style={{ color:'var(--tx)' }}>20 sets</strong> per muscle group per week. Connect Hevy to track automatically.</div>
            <div style={{ marginTop:'8px',background:'var(--s2)',border:'1px solid var(--b1)',padding:'10px 12px',fontSize:'9px',color:'var(--mu)' }}>
              Connect Hevy Training to track weekly sets per muscle group automatically.
            </div>
          </div>
        </div>
      </Panel>

      {/* Rolling weight */}
      <Panel style={{ marginBottom:'20px' }}>
        <PanelTitle>7-Day Rolling Weight Trend</PanelTitle>
        <PanelSub>Rolling average smooths daily fluctuations · shows true trajectory · last 56 days</PanelSub>
        <div style={{ height:'240px' }}>
          <Line data={{ labels:days56.map((d,i)=>i%7===0?formatDate(d):''), datasets:[
            {label:'Daily Weight',data:actualWts,borderColor:'rgba(249,115,22,.35)',backgroundColor:'transparent',borderWidth:1,pointRadius:2,tension:.2,spanGaps:true},
            {label:'7-Day Rolling Avg',data:rollingData,borderColor:'#f97316',backgroundColor:'rgba(249,115,22,.06)',borderWidth:2.5,pointRadius:0,tension:.4,spanGaps:true,fill:true},
          ]}} options={{...chartOpts,scales:{...chartOpts.scales,y:{...chartOpts.scales.y,ticks:{...chartOpts.scales.y.ticks,callback:(v:any)=>v+'kg'}}}}} />
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1px',background:'var(--b1)',border:'1px solid var(--b1)',marginTop:'16px' }}>
          {[
            {label:'7-Day Avg (current)',val:curAvg?`${curAvg.toFixed(2)}kg`:'—',color:'var(--or)'},
            {label:'vs Prior Week',val:change?`${change>0?'+':''}${change.toFixed(2)}kg`:'—',color:change&&change<=0?'#4ade80':'#fca5a5'},
            {label:'Trend Direction',val:change==null?'—':change<-0.1?'↓ Losing':change>0.1?'↑ Gaining':'→ Stable',color:change==null?'var(--mu)':change<-0.1?'#4ade80':change>0.1?'#fca5a5':'#7b8fb8'},
          ].map(({label,val,color})=>(
            <div key={label} style={{ background:'var(--s2)',padding:'14px' }}>
              <div style={{ fontSize:'7px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--mu2)',marginBottom:'5px' }}>{label}</div>
              <div style={{ fontFamily:'Bebas Neue',fontSize:'28px',color,lineHeight:1 }}>{val}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* CPR chart */}
      <Panel>
        <PanelTitle>Daily Cal:Protein Ratio — Last 28 Days</PanelTitle>
        <PanelSub>Green bars = at or under 10:1 target · Orange = over</PanelSub>
        <div style={{ height:'200px' }}>
          <Bar data={{ labels:days28.map((d,i)=>i%4===0?formatDate(d):''), datasets:[
            {label:'Cal:Protein Ratio',data:cprHistory,backgroundColor:cprHistory.map(r=>r===null?'transparent':r<=10?'rgba(34,197,94,.6)':'rgba(249,115,22,.6)'),borderColor:cprHistory.map(r=>r===null?'transparent':r<=10?'#22c55e':'#f97316'),borderWidth:1},
            {label:'Target (10:1)',data:Array(28).fill(10),type:'line' as any,borderColor:'rgba(59,130,246,.7)',borderDash:[4,4],borderWidth:1.5,pointRadius:0,fill:false},
          ]}} options={{...chartOpts,scales:{...chartOpts.scales,y:{...chartOpts.scales.y,ticks:{...chartOpts.scales.y.ticks,callback:(v:any)=>v+':1'}}}}} />
        </div>
      </Panel>
    </AppLayout>
  )
}
