"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LandingPage() {
  const searchParams = useSearchParams();
  const fbclid = searchParams.get("fbclid") || "";
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleJoin = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fbclid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create link");
      window.location.href = data.inviteLink;
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  const loading = status === "loading";

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(ellipse 70% 50% at 50% -10%, rgba(34,158,217,0.18) 0%, transparent 70%),
            #0a0a0f;
        }

        .card {
          width: 100%;
          max-width: 460px;
          background: #13131a;
          border: 1px solid #1e1e2e;
          border-radius: 24px;
          padding: 48px 40px;
          text-align: center;
          box-shadow: 0 40px 100px rgba(0,0,0,0.7);
          animation: fadeUp 0.5s ease both;
        }

        .tg-icon {
          width: 76px;
          height: 76px;
          border-radius: 22px;
          background: linear-gradient(135deg, #229ed9, #1a7fb8);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
          box-shadow: 0 12px 40px rgba(34,158,217,0.45);
        }

        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(35,209,139,0.1);
          border: 1px solid rgba(35,209,139,0.28);
          color: #23d18b;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 14px;
          border-radius: 999px;
          margin-bottom: 20px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .live-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #23d18b;
          animation: pulse 2s infinite;
        }

        h1 {
          font-size: 27px;
          font-weight: 800;
          color: #e8e8f0;
          line-height: 1.25;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .subtitle {
          font-size: 15px;
          color: #6e6e8a;
          line-height: 1.65;
          margin-bottom: 32px;
        }

        .features {
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-bottom: 32px;
          text-align: left;
        }

        .feature-row {
          display: flex;
          align-items: center;
          gap: 11px;
          font-size: 14px;
          color: #9090aa;
          padding: 10px 14px;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .btn {
          width: 100%;
          padding: 17px;
          border-radius: 14px;
          border: none;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          letter-spacing: 0.01em;
          transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
          background: linear-gradient(135deg, #229ed9, #1a7fb8);
          color: #fff;
          box-shadow: 0 8px 28px rgba(34,158,217,0.42);
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 36px rgba(34,158,217,0.55);
        }

        .btn:active:not(:disabled) { transform: translateY(0); }

        .btn:disabled {
          background: #1e1e2e;
          color: #6e6e8a;
          box-shadow: none;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2.5px solid #3a3a52;
          border-top-color: #6e6e8a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .error-box {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.22);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          line-height: 1.5;
        }

        .footer-note {
          margin-top: 24px;
          font-size: 12px;
          color: #35354a;
          line-height: 1.7;
        }

        @media (max-width: 480px) {
          .card { padding: 36px 24px; }
          h1 { font-size: 23px; }
        }
      `}</style>

      <div className="page">
        <div className="card">
          {/* Icon */}
          <div className="tg-icon">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.963.889z"/>
            </svg>
          </div>

          {/* Badge */}
          <div className="live-badge">
            <div className="live-dot" />
            Members Active
          </div>

          <h1>Join Our Private<br />Telegram Channel</h1>
          <p className="subtitle">
            Exclusive content, insider tips, and direct community support — all in one private group.
          </p>

          {/* Features */}
          <div className="features">
            {[
              ["🔒", "Private & Verified Members Only"],
              ["⚡", "Daily Exclusive Updates"],
              ["💬", "Direct Expert Support"],
              ["🎯", "No Spam, Curated Content"],
            ].map(([icon, text]) => (
              <div className="feature-row" key={text}>
                <span style={{ fontSize: "18px" }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Button */}
          <button className="btn" onClick={handleJoin} disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" />
                Creating your link...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.963.889z"/>
                </svg>
                Join Community Free →
              </>
            )}
          </button>

          {status === "error" && (
            <div className="error-box">⚠️ {errorMsg}</div>
          )}

          <p className="footer-note">
            আপনার invite link টি unique এবং শুধুমাত্র আপনার জন্য।<br />
            Join request করলেই আপনার spot confirm হবে।
          </p>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0f", color:"#6e6e8a" }}>
        Loading...
      </div>
    }>
      <LandingPage />
    </Suspense>
  );
}
