"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect, useRef } from "react";

/* ── Facebook cookie helpers ─────────────────────────────── */
function getCookie(name) {
  try {
    const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
    return m ? m[2] : "";
  } catch { return ""; }
}

/* ── Fire Facebook Pixel browser event ───────────────────── */
function pixelTrack(event, data) {
  try { if (typeof window !== "undefined" && window.fbq) window.fbq("track", event, data || {}); }
  catch {}
}

/* ─────────────────────────────────────────────────────────── */
function LandingPage() {
  const searchParams = useSearchParams();
  const fbclid = searchParams.get("fbclid") || "";

  const [status, setStatus] = useState("idle"); // idle|loading|redirecting|done|error
  const [errMsg, setErrMsg] = useState("");
  const [tgLink, setTgLink] = useState("");
  const redirected = useRef(false);
  const retryCount = useRef(0);

  /* PageView pixel event */
  useEffect(() => {
    pixelTrack("ViewContent", { content_name: "Community Join Page", content_category: "community" });
  }, []);

  /* Redirect after link is ready */
  useEffect(() => {
    if (!tgLink || redirected.current) return;
    redirected.current = true;
    window.location.href = tgLink;
    const t = setTimeout(() => setStatus("done"), 4000);
    return () => clearTimeout(t);
  }, [tgLink]);

  const handleJoin = async () => {
    if (status === "loading" || status === "redirecting") return;
    setStatus("loading");
    setErrMsg("");
    pixelTrack("InitiateCheckout", { content_name: "Community Join Initiated" });

    try {
      const controller  = new AbortController();
      const timeout     = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch("/api/create-link", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  controller.signal,
        body: JSON.stringify({
          fbclid,
          fbp:       getCookie("_fbp"),
          fbc:       getCookie("_fbc"),
          userAgent: navigator.userAgent || "",
          pageUrl:   window.location.href,
        }),
      });

      clearTimeout(timeout);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

      setStatus("redirecting");
      setTgLink(data.inviteLink);

    } catch (e) {
      let msg = "Something went wrong. Please try again.";

      if (e.name === "AbortError") {
        msg = "Request timed out. Please check your connection and try again.";
      } else if (!navigator.onLine) {
        msg = "No internet connection. Please check your connection.";
      } else if (e.message) {
        msg = e.message;
      }

      // Auto-retry once on network error
      if (retryCount.current < 1 && e.name !== "AbortError") {
        retryCount.current += 1;
        console.log("[Join] Auto-retrying...");
        setTimeout(() => handleJoin(), 1500);
        return;
      }

      retryCount.current = 0;
      setErrMsg(msg);
      setStatus("error");
    }
  };

  const isLoading = status === "loading" || status === "redirecting";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Inter', system-ui, sans-serif;
          background: #0b0c10;
          color: #e2e4ee;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 24px 16px 48px;
          background:
            radial-gradient(ellipse 90% 50% at 50% -5%, rgba(34,158,217,0.18) 0%, transparent 65%),
            #0b0c10;
        }

        .card {
          width: 100%;
          max-width: 430px;
          background: #111318;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,158,217,0.06);
        }

        /* ── Banner ── */
        .banner {
          background: linear-gradient(135deg, #1565a8, #229ed9 55%, #1fb8d3);
          padding: 26px 26px 22px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .banner::after {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 70% 80% at 50% 120%, rgba(0,0,0,0.25), transparent);
          pointer-events: none;
        }
        .icon-wrap {
          width: 62px; height: 62px;
          border-radius: 17px;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(8px);
          border: 1.5px solid rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 13px;
          position: relative; z-index: 1;
        }
        .banner h1 {
          font-size: 21px; font-weight: 800; color: #fff;
          line-height: 1.25; letter-spacing: -.02em;
          position: relative; z-index: 1;
        }
        .banner-sub {
          font-size: 13px; color: rgba(255,255,255,0.72);
          margin-top: 5px; position: relative; z-index: 1;
        }

        /* ── Body ── */
        .body { padding: 22px 22px 8px; }

        /* ── Live badge ── */
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .live {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(35,209,139,0.09);
          border: 1px solid rgba(35,209,139,0.22);
          color: #23d18b; font-size: 11px; font-weight: 700;
          padding: 4px 11px; border-radius: 999px;
          letter-spacing: .07em; text-transform: uppercase;
          margin-bottom: 16px;
        }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #23d18b; animation: pulse 1.8s infinite; }

        /* ── CTA Button ── */
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          width: 100%; padding: 16px; border-radius: 13px; border: none;
          font-size: 15.5px; font-weight: 700; cursor: pointer;
          transition: transform .18s, box-shadow .18s;
          letter-spacing: .01em; margin-bottom: 0;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .btn-primary {
          background: linear-gradient(135deg, #1e90d4, #229ed9, #1fb8cf);
          color: #fff;
          box-shadow: 0 8px 28px rgba(34,158,217,0.42);
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 36px rgba(34,158,217,0.58);
        }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { background: #181b24; color: #3e4255; box-shadow: none; cursor: not-allowed; }
        .btn-done {
          background: linear-gradient(135deg, #047857, #10b981);
          color: #fff; box-shadow: 0 8px 28px rgba(16,185,129,0.35); cursor: default;
        }
        .spinner {
          width: 17px; height: 17px; flex-shrink: 0;
          border: 2.5px solid rgba(255,255,255,0.18);
          border-top-color: #fff; border-radius: 50%;
          animation: spin .7s linear infinite;
        }

        /* ── Redirect notice ── */
        .redirect-notice {
          display: flex; align-items: flex-start; gap: 9px;
          padding: 11px 13px; margin-top: 12px;
          background: rgba(34,158,217,0.07);
          border: 1px solid rgba(34,158,217,0.18);
          border-radius: 10px; font-size: 12.5px; color: #5ab5e0; line-height: 1.55;
        }

        /* ── Error ── */
        .err {
          padding: 11px 13px; margin-top: 12px;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 9px; color: #f87171; font-size: 12.5px; line-height: 1.5;
        }
        .retry-btn {
          background: none; border: none; color: #f87171;
          font-size: 12.5px; font-weight: 600; cursor: pointer;
          text-decoration: underline; padding: 0; margin-top: 6px; display: block;
          font-family: 'Inter', system-ui, sans-serif;
        }

        /* ── Stats — below button ── */
        .stats {
          display: flex; gap: 7px;
          margin-top: 16px; margin-bottom: 20px;
        }
        .stat {
          flex: 1; text-align: center;
          background: #0d1017; border: 1px solid #191d27;
          border-radius: 10px; padding: 11px 6px;
        }
        .stat-num { font-size: 18px; font-weight: 800; color: #e2e4ee; line-height: 1; }
        .stat-lbl { font-size: 10.5px; color: #424660; margin-top: 3px; font-weight: 500; }

        /* ── Section title ── */
        .section-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .08em; color: #ffffff;
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .section-title::before, .section-title::after {
          content: ''; flex: 1; height: 1px; background: #1e2130;
        }

        /* ── Features ── */
        .features { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
        .feat {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 13px;
          background: #0d1017; border: 1px solid #191d27; border-radius: 9px;
          font-size: 13px; color: #8890aa;
        }
        .feat-ico { font-size: 16px; flex-shrink: 0; }
        .feat strong { color: #c4c8dc; font-weight: 600; }

        /* ── Footer ── */
        .footer {
          text-align: center;
          padding: 13px 22px 17px;
          border-top: 1px solid #141720;
        }
        .kdex-link {
          display: inline-flex; align-items: center; gap: 0;
          text-decoration: none;
        }
        .kdex-ads { font-size: 11.5px; color: rgba(255,255,255,0.28); font-weight: 400; }
        .kdex-sep { font-size: 11.5px; color: rgba(255,255,255,0.28); margin: 0 3px; }
        .kdex-brand {
          font-size: 11.5px; font-weight: 800; color: #38bdf8;
          letter-spacing: .04em; transition: color .18s;
        }
        .kdex-link:hover .kdex-brand { color: #7dd3fc; }

        @media (max-width: 400px) {
          .banner { padding: 20px 18px 18px; }
          .body { padding: 18px 16px 8px; }
          .banner h1 { font-size: 19px; }
        }
      `}</style>

      <div className="page">
        <div className="card">

          {/* ── Banner ── */}
          <div className="banner">
            <div className="icon-wrap">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h1>Join Our Private<br/>Exclusive Community</h1>
            <p className="banner-sub">Expert insights · Daily updates · Zero spam</p>
          </div>

          {/* ── Body ── */}
          <div className="body">

            {/* Live badge */}
            <div style={{ textAlign: "center" }}>
              <span className="live"><span className="live-dot"/>Members Active Now</span>
            </div>

            {/* ── JOIN BUTTON — TOP ── */}
            {status === "done" ? (
              <button className="btn btn-done" disabled>
                ✅ Link Opened — Request to Join
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleJoin} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="spinner"/>
                    {status === "redirecting" ? "Opening…" : "Creating your link…"}
                  </>
                ) : (
                  <>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <line x1="19" y1="8" x2="19" y2="14"/>
                      <line x1="22" y1="11" x2="16" y2="11"/>
                    </svg>
                    Join Community Free →
                  </>
                )}
              </button>
            )}

            {/* Redirect notice */}
            {status === "redirecting" && tgLink && (
              <div className="redirect-notice">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#5ab5e0" strokeWidth="2" strokeLinecap="round"
                  style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>
                  Opening your link… না খুললে{" "}
                  <a href={tgLink} style={{ color: "#229ed9", fontWeight: 600 }}
                    target="_blank" rel="noreferrer">এখানে ক্লিক করুন</a>
                </span>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="err">
                ⚠️ {errMsg}
                <button className="retry-btn" onClick={handleJoin}>Try again →</button>
              </div>
            )}

            {/* ── STATS — below button ── */}
            <div className="stats">
              {[["10K+","Members"],["Daily","Updates"],["Free","Access"]].map(([n,l]) => (
                <div className="stat" key={l}>
                  <div className="stat-num">{n}</div>
                  <div className="stat-lbl">{l}</div>
                </div>
              ))}
            </div>

            {/* Section title */}
            <div className="section-title">What you get</div>

            {/* Features */}
            <div className="features">
              {[
                ["🔒","Private Access","Verified members only"],
                ["⚡","Daily Insights","Fresh exclusive content every day"],
                ["💬","Expert Support","Direct answers from specialists"],
                ["🎯","Zero Spam","Only high-value curated posts"],
              ].map(([ico,title,desc]) => (
                <div className="feat" key={title}>
                  <span className="feat-ico">{ico}</span>
                  <span><strong>{title}</strong> — {desc}</span>
                </div>
              ))}
            </div>

          </div>{/* /body */}

          {/* ── Footer ── */}
          <div className="footer">
            <a href="https://kdex.io" target="_blank" rel="noreferrer" className="kdex-link">
              <span className="kdex-ads">Ads by</span>
              <span className="kdex-sep">·</span>
              <span className="kdex-brand">KDex</span>
            </a>
          </div>

        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0b0c10",
        color: "#3a3d4e", fontFamily: "system-ui", fontSize: "14px"
      }}>
        Loading…
      </div>
    }>
      <LandingPage/>
    </Suspense>
  );
}
