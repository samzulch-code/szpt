'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const NAV = [
  { section: 'Overview', items: [
    { href: '/dashboard', label: 'Dashboard', icon: '◈' },
  ]},
  { section: 'Plan', items: [
    { href: '/plan', label: 'Current Plan', icon: '◎' },
    { href: '/profile', label: 'My Profile', icon: '◐' },
  ]},
  { section: 'Data', items: [
    { href: '/log', label: 'Log Data', icon: '◧' },
    { href: '/import', label: 'Import CSV', icon: '↑' },
    { href: '/photos', label: 'Progress Photos', icon: '◫' },
    { href: '/training', label: 'Hevy Training', icon: '◑' },
  ]},
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('...')
  const [phase, setPhase] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      // Get profile
      supabase.from('profiles').select('name').eq('id', data.user.id).single()
        .then(({ data: p }) => { if (p?.name) setUserName(p.name) })
      // Get active plan
      supabase.from('plans').select('phase').eq('user_id', data.user.id).eq('is_active', true).single()
        .then(({ data: plan }) => {
          if (plan) setPhase({ cut:'Cut Phase', gain:'Gain Phase', reverse:'Reverse Diet', maintain:'Maintenance' }[plan.phase as string] || '')
        })
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>

      {/* Mobile header */}
      <div style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        background: 'var(--s1)', borderBottom: '1px solid var(--b2)', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
      }} className="mobile-header">
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '22px', letterSpacing: '4px', color: 'var(--or)' }}>SZPT</div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--tx)', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar */}
      <nav style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '200px',
        background: 'var(--s1)', borderRight: '1px solid var(--b2)',
        display: 'flex', flexDirection: 'column', zIndex: 20, overflowY: 'auto',
      }} className={`sidebar ${menuOpen ? 'open' : ''}`}>

        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--b1)' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: '28px', letterSpacing: '6px', color: 'var(--or)', lineHeight: 1 }}>SZPT</div>
          <div style={{ fontSize: '8px', color: 'var(--mu)', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '3px' }}>Peak Blueprint OS</div>
        </div>

        {NAV.map(group => (
          <div key={group.section} style={{ padding: '14px 12px 6px' }}>
            <div style={{ fontSize: '7px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--mu2)', padding: '0 8px', marginBottom: '4px' }}>
              {group.section}
            </div>
            {group.items.map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href} href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '8px 10px', fontSize: '10px', letterSpacing: '1.5px',
                    color: active ? 'var(--or)' : 'var(--mu)',
                    background: active ? 'var(--org)' : 'transparent',
                    borderLeft: active ? '2px solid var(--or)' : '2px solid transparent',
                    textDecoration: 'none', textTransform: 'uppercase',
                    transition: 'all 0.15s', borderRadius: '2px',
                  }}
                >
                  <span style={{ width: '14px', textAlign: 'center', fontSize: '12px' }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}

        <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid var(--b1)' }}>
          <div style={{ fontSize: '11px', color: 'var(--tx)', letterSpacing: '2px', textTransform: 'uppercase' }}>{userName}</div>
          <div style={{ fontSize: '9px', color: 'var(--mu)', marginTop: '3px' }}>{phase || 'No plan set'}</div>
          <button
            onClick={handleSignOut}
            style={{
              marginTop: '12px', width: '100%', padding: '7px',
              background: 'transparent', border: '1px solid var(--b2)',
              color: 'var(--mu)', fontFamily: 'DM Mono', fontSize: '8px',
              letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        marginLeft: '200px', flex: 1, position: 'relative', zIndex: 2,
        padding: '36px 40px', minHeight: '100vh',
      }} className="main-content">
        {children}
      </main>

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 19 }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          .sidebar { transform: translateX(-100%); top: 56px; transition: transform 0.25s ease; }
          .sidebar.open { transform: translateX(0); }
          .main-content { margin-left: 0 !important; padding: 80px 20px 32px !important; }
        }
      `}</style>
    </div>
  )
}
