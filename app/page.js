'use client'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function JoinSection() {
  const searchParams = useSearchParams()
  const fbclid = searchParams.get('fbclid')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbclid })
      })

      if (!res.ok) throw new Error('Failed')

      const { link } = await res.json()
      window.location.href = link
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={handleJoin}
        disabled={loading}
        style={{
          padding: '20px 24px',
          fontSize: '18px',
          fontWeight: '700',
          background: loading? '#94a3b8' : '#0ea5e9',
          color: 'white',
          border: 'none',
          borderRadius: '14px',
          cursor: loading? 'not-allowed' : 'pointer',
          width: '100%',
          boxShadow: '0 8px 20px rgba(14, 165, 233, 0.35)',
          transition: 'all 0.2s',
          transform: loading? 'scale(0.98)' : 'scale(1)'
        }}
      >
        {loading? 'Processing...' : '🚀 Join Community Now'}
      </button>
      {error && (
        <p style={{ color: '#ef4444', marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f172a',
      color: 'white'
    }}>
      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          padding: '32px 24px',
          borderRadius: '24px',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)'
        }}>
          {/* Join Button সবার উপরে */}
          <Suspense fallback={
            <div style={{ height: '60px', background: '#334155', borderRadius: '14px' }}></div>
          }>
            <JoinSection />
          </Suspense>

          {/* Content */}
          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
            <h1 style={{
              fontSize: '26px',
              marginBottom: '12px',
              fontWeight: '800',
              lineHeight: '1.2'
            }}>
              Private Community Access
            </h1>
            <p style={{
              fontSize: '15px',
              color: '#94a3b8',
              lineHeight: '1.6',
              marginBottom: '20px'
            }}>
              Get instant access to exclusive insights, updates, and a network of like-minded members.
            </p>

            <div style={{
              background: '#1e293b',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #334155',
              marginTop: '24px'
            }}>
              <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
                ✓ Instant Access After Approval
              </div>
              <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
                ✓ Exclusive Content & Updates
              </div>
              <div style={{ fontSize: '14px', color: '#cbd5e1' }}>
                ✓ 100% Free to Join
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '20px' }}>
              Click join to send request. Admin will approve shortly.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        padding: '20px',
        textAlign: 'center',
        borderTop: '1px solid #1e293b'
      }}>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Ads By{' '}
          <a
            href="https://t.me/+mjeIPVeI4iAzYzNl"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0ea5e9',
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            KDex
          </a>
        </p>
      </footer>
    </div>
  )
}