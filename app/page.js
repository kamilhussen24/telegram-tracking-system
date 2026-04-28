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
      
      const data = await res.json()
      
      if (!res.ok) {
        // সার্ভার থেকে আসা আসল Error
        throw new Error(data.error || `Server error: ${res.status}`)
      }
      
      if (!data.link) {
        throw new Error('No link received from server')
      }
      
      window.location.href = data.link
    } catch (e) {
      console.error('Join Error:', e)
      setError(e.message) // আসল Error দেখাবে
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
          background: loading ? '#94a3b8' : '#0ea5e9',
          color: 'white',
          border: 'none',
          borderRadius: '14px',
          cursor: loading ? 'not-allowed' : 'pointer',
          width: '100%',
          boxShadow: '0 8px 20px rgba(14, 165, 233, 0.35)',
          transition: 'all 0.2s',
          transform: loading ? 'scale(0.98)' : 'scale(1)'
        }}
      >
        {loading ? 'Processing...' : '🚀 Join Community Now'}
      </button>
      {error && (
        <div style={{ 
          color: '#ef444