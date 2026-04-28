"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";

/* ─── Spinner stops after Telegram link opens ───────────────────
   Strategy: set a short timeout after redirect — if user comes
   back (browser blocks redirect / mobile) reset to idle.        */

function LandingPage() {
  const searchParams = useSearchParams();
  const fbclid = searchParams.get("fbclid") || "";

  const [status, setStatus]   = useState("idle"); // idle|loading|redirecting|error
  const [errMsg, setErrMsg]   = useState("");
  const [tgLink, setTgLink]   = useState("");

  // When we have the link, open Telegram and stop spinner after 3s
  useEffect(() => {
    if (!tgLink) return;
    window.location.href = tgLink;

    // After 3 s — if user is still on page (desktop or blocked), reset
    const t = setTimeout(() => {
      setStatus("done");
    }, 3000);
    return () => clearTimeout(t);
  }, [tgLink]);

  const handleJoin = async () => {
    if (status === "loading" || status === "redirecting") return;
    setStatus("loading");
    setErrMsg("");

    try {
      const res  = await fetch("/api/create-link", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ fbclid }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create link");

      setStatus("redirecting");
      setTgLink(data.inviteLink);          // triggers the useEffect above
    } catch (e) {
      setErrMsg(e.message);
      setStatus("error");
    }
  };

  const isLoading = status === "loading" || status === "redirecting";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        body{
          font-family:'Inter',system-ui,sans-serif;
          background:#0b0c10;
          color:#e2e4ee;
          min-height:100vh;
          -webkit-font-smoothing:antialiased;
        }

        /* ── Page shell ── */
        .page{
          min-height:100vh;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:flex-start;
          padding:28px 16px 48px;
          background:
            radial-gradient(ellipse 90% 55% at 50% -5%,
              rgba(34,158,217,0.16) 0%, transparent 65%),
            #0b0c10;
        }

        /* ── Card ── */
        .card{
          width:100%;
          max-width:440px;
          background:#111318;
          border:1px solid rgba(255,255,255,0.07);
          border-radius:20px;
          overflow:hidden;
          box-shadow:0 32px 80px rgba(0,0,0,0.65),
                     0 0 0 1px rgba(34,158,217,0.08);
        }

        /* ── Top banner ── */
        .banner{
          background:linear-gradient(135deg,#1a7fb8,#229ed9 60%,#1fb8d3);
          padding:28px 28px 24px;
          text-align:center;
          position:relative;
          overflow:hidden;
        }
        .banner::before{
          content:'';
          position:absolute;inset:0;
          background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        .tg-icon{
          width:64px;height:64px;
          border-radius:18px;
          background:rgba(255,255,255,0.15);
          backdrop-filter:blur(8px);
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 14px;
          border:1.5px solid rgba(255,255,255,0.25);
        }
        .banner h1{
          font-size:22px;font-weight:800;color:#fff;
          line-height:1.25;letter-spacing:-0.02em;
          position:relative;
        }
        .banner p{
          font-size:13.5px;color:rgba(255,255,255,0.75);
          margin-top:6px;line-height:1.5;position:relative;
        }

        /* ── Body ── */
        .body{padding:24px 24px 28px;}

        /* ── CTA Button — FIRST in body ── */
        .btn{
          display:flex;align-items:center;justify-content:center;gap:9px;
          width:100%;
          padding:16px;
          border-radius:13px;
          border:none;
          font-size:16px;font-weight:700;
          cursor:pointer;
          transition:transform .18s, box-shadow .18s, background .18s;
          letter-spacing:.01em;
          margin-bottom:24px;
        }
        .btn-primary{
          background:linear-gradient(135deg,#229ed9,#1a7fb8);
          color:#fff;
          box-shadow:0 8px 28px rgba(34,158,217,0.45);
        }
        .btn-primary:hover:not(:disabled){
          transform:translateY(-2px);
          box-shadow:0 14px 36px rgba(34,158,217,0.6);
        }
        .btn-primary:active:not(:disabled){transform:translateY(0)}
        .btn:disabled{
          background:#1c1f27;color:#4a4d5e;
          box-shadow:none;cursor:not-allowed;
        }
        .btn-done{
          background:linear-gradient(135deg,#059669,#10b981);
          color:#fff;
          box-shadow:0 8px 28px rgba(16,185,129,0.4);
          cursor:default;
        }

        /* ── Spinner ── */
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{
          width:18px;height:18px;
          border:2.5px solid rgba(255,255,255,0.2);
          border-top-color:#fff;
          border-radius:50%;
          animation:spin .7s linear infinite;
          flex-shrink:0;
        }

        /* ── Divider ── */
        .divider{
          display:flex;align-items:center;gap:10px;
          margin-bottom:20px;
          font-size:11px;color:#3a3d4e;font-weight:500;
          text-transform:uppercase;letter-spacing:.06em;
        }
        .divider::before,.divider::after{
          content:'';flex:1;height:1px;background:#1c1f27;
        }

        /* ── Features ── */
        .features{display:flex;flex-direction:column;gap:9px;margin-bottom:22px;}
        .feat{
          display:flex;align-items:center;gap:12px;
          padding:11px 14px;
          background:#0e1016;
          border:1px solid #1a1d27;
          border-radius:10px;
          font-size:13.5px;color:#9095ae;
        }
        .feat-icon{font-size:17px;flex-shrink:0;}
        .feat strong{color:#c8ccdf;font-weight:600;}

        /* ── Live badge ── */
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        .live{
          display:inline-flex;align-items:center;gap:7px;
          background:rgba(35,209,139,0.09);
          border:1px solid rgba(35,209,139,0.22);
          color:#23d18b;font-size:11px;font-weight:700;
          padding:4px 12px;border-radius:999px;
          letter-spacing:.07em;text-transform:uppercase;
          margin-bottom:16px;
        }
        .live-dot{
          width:7px;height:7px;border-radius:50%;
          background:#23d18b;
          animation:pulse 1.8s infinite;
        }

        /* ── Stats row ── */
        .stats{
          display:flex;gap:8px;margin-bottom:22px;
        }
        .stat{
          flex:1;text-align:center;
          background:#0e1016;border:1px solid #1a1d27;
          border-radius:10px;padding:12px 8px;
        }
        .stat-num{font-size:19px;font-weight:800;color:#e2e4ee;}
        .stat-label{font-size:11px;color:#4a4d5e;margin-top:2px;font-weight:500;}

        /* ── Error ── */
        .err{
          margin-top:14px;padding:11px 14px;
          background:rgba(239,68,68,0.08);
          border:1px solid rgba(239,68,68,0.2);
          border-radius:10px;color:#f87171;font-size:13px;line-height:1.5;
        }

        /* ── Footer note ── */
        .note{
          text-align:center;font-size:11.5px;color:#2e3140;
          line-height:1.7;margin-top:20px;
        }

        /* ── Redirect banner ── */
        .redirect-info{
          display:flex;align-items:center;gap:10px;
          padding:12px 14px;
          background:rgba(34,158,217,0.08);
          border:1px solid rgba(34,158,217,0.2);
          border-radius:10px;
          font-size:13px;color:#5bb8e8;line-height:1.5;
          margin-bottom:16px;
        }

        @media(max-width:420px){
          .banner{padding:22px 20px 20px}
          .body{padding:20px 16px 24px}
          .banner h1{font-size:20px}
          .stats{flex-direction:row}
        }
      `}</style>

      <div className="page">
        <div className="card">

          {/* ── Top Banner ── */}
          <div className="banner">
            <div className="tg-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.963.889z"/>
              </svg>
            </div>
            <h1>Join Our Private<br/>Telegram Channel</h1>
            <p>Exclusive content · Expert support · Zero spam</p>
          </div>

          {/* ── Body ── */}
          <div className="body">

            {/* Live badge */}
            <div style={{textAlign:"center"}}>
              <span className="live"><span className="live-dot"/>Members Active Now</span>
            </div>

            {/* Stats */}
            <div className="stats">
              {[["10K+","Members"],["Daily","Updates"],["Free","Forever"]].map(([n,l])=>(
                <div className="stat" key={l}>
                  <div className="stat-num">{n}</div>
                  <div className="stat-label">{l}</div>
                </div>
              ))}
            </div>

            {/* ── CTA BUTTON — TOP ── */}
            {status === "done" ? (
              <button className="btn btn-done" disabled>
                ✅ Telegram Opened — Request to Join
              </button>
            ) : (
              <button
                className={`btn btn-primary`}
                onClick={handleJoin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner"/>
                    {status === "redirecting" ? "Opening Telegram…" : "Creating your link…"}
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
            )}

            {/* Redirect info */}
            {status === "redirecting" && (
              <div className="redirect-info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5bb8e8" style={{flexShrink:0}}>
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#5bb8e8" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
                Telegram এ যাচ্ছেন… না খুললে{" "}
                <a href={tgLink} style={{color:"#229ed9",fontWeight:600}} target="_blank" rel="noreferrer">এখানে ক্লিক করুন</a>
              </div>
            )}

            {/* Divider */}
            <div className="divider">What you get</div>

            {/* Features */}
            <div className="features">
              {[
                ["🔒","Private Access","Verified members only — no public link"],
                ["⚡","Daily Insights","Fresh content every single day"],
                ["💬","Expert Support","Direct answers from specialists"],
                ["🎯","Zero Spam","Only high-value, curated posts"],
              ].map(([icon,title,desc])=>(
                <div className="feat" key={title}>
                  <span className="feat-icon">{icon}</span>
                  <span><strong>{title}</strong> — {desc}</span>
                </div>
              ))}
            </div>

            {/* Error */}
            {status === "error" && (
              <div className="err">⚠️ {errMsg} — Please try again.</div>
            )}

            <p className="note">
              আপনার invite link একটি unique link।<br/>
              Telegram এ "Request to Join" করলেই আপনার জায়গা confirm হবে।
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0b0c10",color:"#4a4d5e",fontFamily:"system-ui"}}>
        Loading…
      </div>
    }>
      <LandingPage/>
    </Suspense>
  );
}
