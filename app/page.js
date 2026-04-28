'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const searchParams = useSearchParams();
  const fbclid = searchParams.get('fbclid');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    const res = await fetch('/api/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fbclid }),
    });
    const { invite_link } = await res.json();
    window.location.href = invite_link;
  };

  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>জয়েন কমিউনিটি</h1>
      <p>ফেসবুক অ্যাড থেকে আসা ইউজারদের জন্য</p>
      <button
        onClick={handleJoin}
        disabled={loading}
        style={{ padding: '15px 30px', fontSize: '18px', cursor: 'pointer' }}
      >
        {loading ? 'লোডিং...' : 'Join Community'}
      </button>
    </div>
  );
}