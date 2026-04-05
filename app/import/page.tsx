'use client'
import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Panel, PanelTitle, PanelSub, PageHeader, Btn, Toast, Divider } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import { parseCSVImport, formatDateLong } from '@/lib/utils'
import { DailyLog } from '@/types'

type PreviewRow = Partial<DailyLog> & { valid: boolean; error?: string }

export default function ImportPage() {
  const [step, setStep] = useState<'paste' | 'preview' | 'done'>('paste')
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function handleParse() {
    const rows = parseCSVImport(raw)
    if (!rows.length) { showToast('Could not parse any rows — check format'); return }
    const previewed: PreviewRow[] = rows.map(r => ({
      ...r,
      valid: !!r.date,
      error: !r.date ? 'Could not parse date' : undefined,
    }))
    setPreview(previewed)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const validRows = preview.filter(r => r.valid && r.date)
    let count = 0

    for (const row of validRows) {
      const { error } = await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date: row.date,
        calories: row.calories ?? null,
        protein: row.protein ?? null,
        steps: row.steps ?? null,
        weight: row.weight ?? null,
        creatine: row.creatine ?? null,
      }, { onConflict: 'user_id,date' })
      if (!error) count++
    }

    setImportedCount(count)
    setStep('done')
    setImporting(false)
  }

  return (
    <AppLayout>
      <PageHeader title="IMPORT" accent="DATA" sub="Bulk import from CSV or Google Sheets" />

      {step === 'paste' && (
        <>
          <Panel style={{ marginBottom: '20px' }}>
            <PanelTitle>How to import from Google Sheets / Excel</PanelTitle>
            <PanelSub>Step by step</PanelSub>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', padding: '16px' }}>
                <div style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--or)', marginBottom: '10px' }}>Option A — From Google Sheets</div>
                <ol style={{ fontSize: '10px', color: 'var(--mu)', lineHeight: '2', paddingLeft: '16px' }}>
                  <li>Open your coaching log sheet</li>
                  <li>Select the columns: <strong style={{ color: 'var(--tx)' }}>Date, Calories, Protein, Steps, Weight</strong></li>
                  <li>Copy the cells (Cmd+C)</li>
                  <li>Paste into the box below</li>
                </ol>
              </div>
              <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', padding: '16px' }}>
                <div style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--or)', marginBottom: '10px' }}>Option B — Type manually</div>
                <div style={{ fontSize: '10px', color: 'var(--mu)', lineHeight: '2' }}>
                  Paste one row per line:<br />
                  <code style={{ color: 'var(--or2)', fontSize: '9px' }}>date, cal, protein, steps, weight</code><br /><br />
                  Example:<br />
                  <code style={{ color: 'var(--mu2)', fontSize: '9px' }}>
                    01/04/2026, 1850, 175, 9500, 83.2<br />
                    02/04/2026, 1920, 182, 11200, 83.0
                  </code>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--s2)', border: '1px solid var(--or)', padding: '14px', marginBottom: '20px' }}>
              <div style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--or)', marginBottom: '8px' }}>Accepted date formats</div>
              <div style={{ fontSize: '10px', color: 'var(--mu)', lineHeight: '2' }}>
                DD/MM/YYYY &nbsp;·&nbsp; MM/DD/YYYY &nbsp;·&nbsp; YYYY-MM-DD &nbsp;·&nbsp; Tabs or commas as separators both work
              </div>
            </div>

            <Divider label="Paste your data here" />
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder={`Paste from Google Sheets or type manually:\n\n01/04/2026\t1850\t175\t9500\t83.2\n02/04/2026\t1920\t182\t11200\t83.0\n03/04/2026\t1780\t168\t8700\t82.8`}
              style={{
                width: '100%', minHeight: '220px', background: 'var(--s3)',
                border: '1px solid var(--b2)', color: 'var(--tx)', padding: '14px',
                fontSize: '12px', letterSpacing: '0.5px', fontFamily: 'DM Mono',
                resize: 'vertical', outline: 'none', lineHeight: '1.8',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--or)'}
              onBlur={e => e.target.style.borderColor = 'var(--b2)'}
            />
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Btn variant="primary" onClick={handleParse} disabled={!raw.trim()}>
                Preview Import →
              </Btn>
              <Btn variant="ghost" onClick={() => setRaw('')}>Clear</Btn>
              <span style={{ fontSize: '9px', color: 'var(--mu)', letterSpacing: '1px' }}>
                {raw.trim().split('\n').filter(Boolean).length} rows detected
              </span>
            </div>
          </Panel>
        </>
      )}

      {step === 'preview' && (
        <Panel>
          <PanelTitle>Preview — {preview.filter(r => r.valid).length} valid rows</PanelTitle>
          <PanelSub>Review before importing — existing entries for the same date will be updated</PanelSub>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {['Status','Date','Calories','Protein','Steps','Weight','Creatine'].map(h => (
                    <th key={h} style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu2)', textAlign: 'left', padding: '8px 8px 8px 0', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)' }}>
                      {row.valid
                        ? <span style={{ color: '#4ade80', fontSize: '10px' }}>✓</span>
                        : <span style={{ color: '#fca5a5', fontSize: '9px' }}>{row.error}</span>}
                    </td>
                    <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: 'var(--tx)' }}>{row.date || '—'}</td>
                    <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: row.calories ? 'var(--tx)' : 'var(--mu)' }}>{row.calories?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: row.protein ? 'var(--tx)' : 'var(--mu)' }}>{row.protein ? `${row.protein}g` : '—'}</td>
                    <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: row.steps ? 'var(--tx)' : 'var(--mu)' }}>{row.steps?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: row.weight ? 'var(--tx)' : 'var(--mu)' }}>{row.weight ? `${row.weight}kg` : '—'}</td>
                    <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px solid var(--b1)', color: 'var(--mu)' }}>{row.creatine === true ? '✓' : row.creatine === false ? '✗' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
            <Btn variant="primary" onClick={handleImport} disabled={importing || preview.filter(r => r.valid).length === 0}>
              {importing ? 'Importing...' : `Import ${preview.filter(r => r.valid).length} Rows →`}
            </Btn>
            <Btn variant="ghost" onClick={() => setStep('paste')}>← Back</Btn>
          </div>
        </Panel>
      )}

      {step === 'done' && (
        <Panel style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '80px', color: 'var(--gr)', lineHeight: 1, textShadow: '0 0 40px rgba(34,197,94,.3)' }}>
            {importedCount}
          </div>
          <div style={{ fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--mu)', marginTop: '8px', marginBottom: '32px' }}>
            Rows imported successfully
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Btn variant="primary" onClick={() => { setStep('paste'); setRaw(''); setPreview([]) }}>
              Import More
            </Btn>
            <a href="/dashboard" style={{ textDecoration: 'none' }}>
              <Btn variant="outline">View Dashboard →</Btn>
            </a>
          </div>
        </Panel>
      )}

      <Toast message={toast} visible={!!toast} />
    </AppLayout>
  )
}
