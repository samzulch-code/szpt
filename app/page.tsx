'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', zIndex: 1
    }}>
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--b2)',
        padding: '48px', width: '100%', maxWidth: '420px'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontFamily: 'Bebas Neue', fontSize: '48px', letterSpacing: '8px',
            color: 'var(--or)', lineHeight: 1
          }}>SZPT</div>
          <div style={{ fontSize: '9px', letterSpacing: '4px', color: 'var(--mu)', textTransform: 'uppercase', marginTop: '4px' }}>
            Peak Blueprint OS
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '32px', borderBottom: '1px solid var(--b1)' }}>
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '10px', border: 'none', background: 'transparent',
                fontFamily: 'DM Mono', fontSize: '10px', letterSpacing: '2px',
                textTransform: 'uppercase', cursor: 'pointer',
                color: mode === m ? 'var(--or)' : 'var(--mu)',
                borderBottom: mode === m ? '2px solid var(--or)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: '6px' }}>
                Name
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Jamie" required
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ background: 'var(--red)', border: '1px solid var(--re)', padding: '10px 14px', marginBottom: '16px', fontSize: '11px', color: '#fca5a5' }}>
              {error}
            </div>
          )}
          {message && (
            <div style={{ background: 'var(--grd)', border: '1px solid var(--gr)', padding: '10px 14px', marginBottom: '16px', fontSize: '11px', color: '#4ade80' }}>
              {message}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px', background: loading ? 'var(--s3)' : 'var(--or)',
              color: '#050d1a', border: 'none', fontFamily: 'DM Mono', fontSize: '10px',
              letterSpacing: '3px', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Log In →' : 'Create Account →'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)',
  color: 'var(--tx)', padding: '10px 14px', fontSize: '13px',
  letterSpacing: '1px', outline: 'none',
}
