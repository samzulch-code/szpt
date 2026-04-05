import { CSSProperties, ReactNode } from 'react'

// ── Panel ──────────────────────────────────────────────
export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: 'var(--s1)', border: '1px solid var(--b1)',
      padding: '22px', position: 'relative', ...style
    }}>
      {children}
    </div>
  )
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: 'Bebas Neue', fontSize: '17px', letterSpacing: '2px', color: 'var(--tx)', marginBottom: '3px' }}>
      {children}
    </div>
  )
}

export function PanelSub({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '8px', letterSpacing: '2px', color: 'var(--mu)', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--b1)' }}>
      {children}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────
type TagVariant = 'default' | 'good' | 'warn' | 'bad' | 'neutral' | 'blue'
const tagColors: Record<TagVariant, { bg: string; color: string; border: string }> = {
  default:  { bg: 'var(--ord)', color: 'var(--or2)', border: 'var(--or)' },
  good:     { bg: 'var(--grd)', color: '#4ade80',    border: 'var(--gr)' },
  warn:     { bg: 'var(--amd)', color: '#fcd34d',    border: 'var(--am)' },
  bad:      { bg: 'var(--red)', color: '#fca5a5',    border: 'var(--re)' },
  neutral:  { bg: 'rgba(100,120,160,.1)', color: 'var(--mu)', border: 'var(--mu2)' },
  blue:     { bg: 'var(--bld)', color: '#93c5fd',    border: 'var(--bl)' },
}

export function StatCard({
  label, value, unit, tag, tagVariant = 'neutral',
}: {
  label: string; value: string | number; unit?: string
  tag?: string; tagVariant?: TagVariant
}) {
  const tc = tagColors[tagVariant]
  return (
    <div style={{ background: 'var(--s1)', padding: '18px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: '7px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: '7px' }}>{label}</div>
      <div>
        <span style={{ fontFamily: 'Bebas Neue', fontSize: '36px', lineHeight: 1, color: 'var(--tx)' }}>{value}</span>
        {unit && <span style={{ fontSize: '11px', color: 'var(--mu)' }}> {unit}</span>}
      </div>
      {tag && (
        <div style={{
          display: 'inline-block', marginTop: '6px', fontSize: '8px', letterSpacing: '1px',
          padding: '2px 6px', borderLeft: `2px solid ${tc.border}`,
          background: tc.bg, color: tc.color,
        }}>{tag}</div>
      )}
    </div>
  )
}

// ── Stat Grid ──────────────────────────────────────────
export function StatGrid({ children, cols = 5 }: { children: ReactNode; cols?: number }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: '1px', background: 'var(--b1)', border: '1px solid var(--b1)', marginBottom: '20px',
    }}>
      {children}
    </div>
  )
}

// ── Button ─────────────────────────────────────────────
type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success'
export function Btn({
  children, onClick, variant = 'ghost', disabled, type = 'button', fullWidth, small,
}: {
  children: ReactNode; onClick?: () => void; variant?: BtnVariant
  disabled?: boolean; type?: 'button' | 'submit'; fullWidth?: boolean; small?: boolean
}) {
  const styles: Record<BtnVariant, CSSProperties> = {
    primary:  { background: 'var(--or)',  color: '#050d1a', border: '1px solid var(--or)' },
    outline:  { background: 'var(--ord)', color: 'var(--or)', border: '1px solid var(--or)' },
    ghost:    { background: 'transparent', color: 'var(--mu)', border: '1px solid var(--b2)' },
    danger:   { background: 'var(--red)', color: '#fca5a5', border: '1px solid var(--re)' },
    success:  { background: 'var(--grd)', color: '#4ade80', border: '1px solid var(--gr)' },
  }
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        fontFamily: 'DM Mono', fontSize: small ? '8px' : '9px',
        letterSpacing: '2px', textTransform: 'uppercase',
        padding: small ? '6px 12px' : '10px 18px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
        width: fullWidth ? '100%' : undefined,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  )
}

// ── Input ──────────────────────────────────────────────
export function Input({
  label, value, onChange, type = 'text', placeholder, required, autoNote,
}: {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; autoNote?: string
}) {
  return (
    <div style={{ marginBottom: '13px' }}>
      <label style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: '5px' }}>
        {label}
        {autoNote && <span style={{ color: 'var(--or2)', fontSize: '7px', marginLeft: '6px' }}>{autoNote}</span>}
      </label>
      <input
        type={type} value={value} required={required}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)',
          color: 'var(--tx)', padding: '9px 12px', fontSize: '12px',
          letterSpacing: '1px', outline: 'none', fontFamily: 'DM Mono',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--or)'}
        onBlur={e => e.target.style.borderColor = 'var(--b2)'}
      />
    </div>
  )
}

export function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ marginBottom: '13px' }}>
      <label style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: '5px' }}>
        {label}
      </label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)',
          color: value ? 'var(--tx)' : 'var(--mu2)', padding: '9px 12px',
          fontSize: '12px', letterSpacing: '1px', outline: 'none', cursor: 'pointer',
          fontFamily: 'DM Mono',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function Textarea({
  label, value, onChange, placeholder, minHeight = 75, required,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; minHeight?: number; required?: boolean
}) {
  return (
    <div style={{ marginBottom: '13px' }}>
      <label style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: '5px' }}>
        {label}
      </label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        style={{
          width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)',
          color: 'var(--tx)', padding: '9px 12px', fontSize: '12px',
          letterSpacing: '1px', outline: 'none', resize: 'vertical',
          minHeight, fontFamily: 'DM Mono',
        }}
      />
    </div>
  )
}

// ── KV Row ─────────────────────────────────────────────
export function KVRow({
  label, value, valueColor,
}: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--b1)' }}>
      <span style={{ fontSize: '9px', letterSpacing: '1px', color: 'var(--mu)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '12px', color: valueColor || 'var(--tx)', letterSpacing: '1px' }}>{value}</span>
    </div>
  )
}

// ── Progress Bar ───────────────────────────────────────
export function ProgressBar({
  value, max = 100, variant = 'default', height = 6,
}: { value: number; max?: number; variant?: 'default' | 'good' | 'warn' | 'bad'; height?: number }) {
  const colors = { default: 'var(--or)', good: 'var(--gr)', warn: 'var(--am)', bad: 'var(--re)' }
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ background: 'var(--s3)', height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: colors[variant], transition: 'width 0.6s ease' }} />
    </div>
  )
}

// ── Page Header ────────────────────────────────────────
export function PageHeader({ title, accent, sub, right }: {
  title: string; accent?: string; sub?: string; right?: ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--b1)',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', bottom: '-1px', left: 0, width: '80px', height: '1px', background: 'var(--or)', opacity: 0.6 }} />
      <div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '46px', letterSpacing: '3px', lineHeight: 0.9, color: 'var(--tx)' }}>
          {title}<br /><span style={{ color: 'var(--or)' }}>{accent}</span>
        </div>
        {sub && <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--mu)', textTransform: 'uppercase', marginTop: '6px' }}>{sub}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────
export function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
      background: 'var(--or)', color: '#050d1a',
      fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '2px',
      textTransform: 'uppercase', padding: '12px 20px',
      transform: visible ? 'translateY(0)' : 'translateY(80px)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.25s ease',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  )
}

// ── Divider ────────────────────────────────────────────
export function Divider({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '8px', letterSpacing: '3px', textTransform: 'uppercase',
      color: 'var(--mu2)', padding: '8px 0 7px', margin: '8px 0 14px',
      borderTop: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      {label}
      <div style={{ flex: 1, height: '1px', background: 'var(--b1)' }} />
    </div>
  )
}

// ── Grid helpers ───────────────────────────────────────
export function Grid2({ children, mb }: { children: ReactNode; mb?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: mb ? '20px' : undefined }}>{children}</div>
}
export function Grid3({ children, mb }: { children: ReactNode; mb?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: mb ? '16px' : undefined }}>{children}</div>
}
export function Grid31({ children, mb }: { children: ReactNode; mb?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: mb ? '20px' : undefined }}>{children}</div>
}
