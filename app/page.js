'use client';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function JoinButton() {
  const searchParams = useSearchParams();
  const fbclid = searchParams.get('fbclid');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbclid }),
      });

      const { invite_link } = await res.json();
      window.location.href = invite_link;
    } catch (err) {
      alert('কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      style={{
        padding: '15px 30px',
        fontSize: '18px',
        cursor: 'pointer',
        background: '#0088cc',
        color: 'white',
        border: 'none',
        borderRadius: '8px'
      }}
    >
      {loading ? 'লোডিং...' : 'Join Community'}
    </button>
  );
}

export default function Home() {
  return (
    <div style={{ 
      padding: 40, 
      textAlign: 'center', 
      fontFamily: 'sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1>জয়েন কমিউনিটি</h1>
      <p>ফেসবুক অ্যাড থেকে আসা সদস্যদের জন্য প্রাইভেট টেলিগ্রাম চ্যানেল</p>
      
      <Suspense fallback={<div>লোডিং...</div>}>
        <JoinButton />
      </Suspense>
    </div>
  );
}