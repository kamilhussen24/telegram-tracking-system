"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────
   Helper: read _fbp cookie (Facebook browser ID)
   ───────────────────────────────────────────────────────────── */
function getFbp() {
  try {
    const match = document.cookie.match(/(^|;\s*)_fbp=([^;]*)/);
    return match ? match[2] : "";
  } catch { return ""; }
}

/* ─────────────────────────────────────────────────────────────
   Main landing page
   ───────────────────────────────────────────────────────────── */
function LandingPage() {
  const searchParams = useSearchParams();
  const fbclid = searchParams.get("fbclid") || "";

  const [status, setStatus]   = useState("idle"); // idle|loading|redirecting|done|error
  const [errMsg, setErrMsg]   = useState("");
  const [tgLink, setTgLink]   = useState("");
  const redirected             = useRef(false);

  /* After we have the link → redirect to Telegram */
  useEffect(() => {
    if (!tgLink || redirected.current) return;
    redirected.current = true;
    window.location.href = tgLink;

    /* Reset spinner after 4 s — user may still be on page (desktop) */
    const t = setTimeout(() => setStatus("done"), 4000);
    return () => clearTimeout(t);
  }, [tgLink]);

  const handleJoin = async () => {
    if (status === "loading" || status === "redirecting") return;
    setStatus("loading");
    setErrMsg("");

    try {
      /* Collect browser signals for Facebook EMQ */
      const userAgent = navigator.userAgent || "";
      const fbp       = getFbp();
      const pageUrl   = window.location.href;

      const res  = await fetch("/api/create-link", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fbclid,
          fbp,
          userAgent,
          pageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create link");

      setStatus("redirecting");
      setTgLink(data.inviteLink);
    } catch (e) {
      setErrMsg(e.message);
      setStatus("error");
    }
  };

  const isLoading = status === "loading" || status === "redirecting";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{
          font-family:'Inter',system-ui,sans-serif;
          background:#0b0c10;color:#e2e4ee;
          min-height:100vh;
          -webkit-font-smoothing:antialiased;
        }

        /* ── Page ── */
        .page{
          min-height:100vh;
          display:flex;flex-direction:column;
          align-items:center;justify-content:flex-start;
          padding:24px 16px 48px;
          background:
            radial-gradient(ellipse 90% 50% at 50% -5%,
              rgba(34,158,217,0.18) 0%, transparent 65%),
            #0b0c10;
        }

        /* ── Card ── */
        .card{
          width:100%;max-width:430px;
          background:#111318;
          border:1px solid rgba(255,255,255,0.07);
          border-radius:20px;overflow:hidden;
          box-shadow:0 32px 80px rgba(0,0,0,0.7),
                     0 0 0 1px rgba(34,158,217,0.06);
        }

        /* ── Banner ── */
        .banner{
          background:linear-gradient(135deg,#1565a8,#229ed9 55%,#1fb8d3);
          padding:26px 26px 22px;text-align:center;
          position:relative;overflow:hidden;
        }
        .banner::after{
          content:'';position:absolute;inset:0;
          background:radial-gradient(ellipse 70% 80% at 50% 120%,rgba(0,0,0,0.25),transparent);
          pointer-events:none;
        }
        .tg-wrap{
          width:62px;height:62px;border-radius:17px;
          background:rgba(255,255,255,0.18);
          backdrop-filter:blur(8px);
          border:1.5px solid rgba(255,255,255,0.3);
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 13px;position:relative;z-index:1;
        }
        .banner h1{
          font-size:21px;font-weight:800;color:#fff;
          line-height:1.25;letter-spacing:-.02em;
          position:relative;z-index:1;
        }
        .banner-sub{
          font-size:13px;color:rgba(255,255,255,0.72);
          margin-top:5px;position:relative;z-index:1;
        }

        /* ── Body ── */
        .body{padding:22px 22px 26px;}

        /* ── Live badge ── */
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .live{
          display:inline-flex;align-items:center;gap:6px;
          background:rgba(35,209,139,0.09);
          border:1px solid rgba(35,209,139,0.22);
          color:#23d18b;font-size:11px;font-weight:700;
          padding:4px 11px;border-radius:999px;
          letter-spacing:.07em;text-transform:uppercase;
          margin-bottom:14px;
        }
        .live-dot{width:6px;height:6px;border-radius:50%;background:#23d18b;animation:pulse 1.8s infinite;}

        /* ── Stats ── */
        .stats{display:flex;gap:7px;margin-bottom:18px;}
        .stat{
          flex:1;text-align:center;
          background:#0d1017;border:1px solid #191d27;
          border-radius:10px;padding:11px 6px;
        }
        .stat-num{font-size:18px;font-weight:800;color:#e2e4ee;line-height:1;}
        .stat-lbl{font-size:10.5px;color:#424660;margin-top:3px;font-weight:500;}

        /* ── CTA Button ── */
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn{
          display:flex;align-items:center;justify-content:center;gap:9px;
          width:100%;padding:16px;border-radius:13px;border:none;
          font-size:15.5px;font-weight:700;cursor:pointer;
          transition:transform .18s,box-shadow .18s;
          letter-spacing:.01em;margin-bottom:14px;
          font-family:'Inter',system-ui,sans-serif;
        }
        .btn-primary{
          background:linear-gradient(135deg,#1e90d4,#229ed9,#1fb8cf);
          color:#fff;box-shadow:0 8px 28px rgba(34,158,217,0.42);
        }
        .btn-primary:hover:not(:disabled){
          transform:translateY(-2px);
          box-shadow:0 14px 36px rgba(34,158,217,0.58);
        }
        .btn-primary:active:not(:disabled){transform:translateY(0)}
        .btn:disabled{background:#181b24;color:#3e4255;box-shadow:none;cursor:not-allowed;}
        .btn-done{
          background:linear-gradient(135deg,#047857,#10b981);
          color:#fff;box-shadow:0 8px 28px rgba(16,185,129,0.35);cursor:default;
        }
        .spinner{
          width:17px;height:17px;flex-shrink:0;
          border:2.5px solid rgba(255,255,255,0.18);
          border-top-color:#fff;border-radius:50%;
          animation:spin .7s linear infinite;
        }

        /* ── Redirect notice ── */
        .redirect-notice{
          display:flex;align-items:flex-start;gap:9px;
          padding:11px 13px;margin-bottom:14px;
          background:rgba(34,158,217,0.07);
          border:1px solid rgba(34,158,217,0.18);
          border-radius:10px;font-size:12.5px;color:#5ab5e0;line-height:1.55;
        }

        /* ── Divider ── */
        .divider{
          display:flex;align-items:center;gap:9px;margin-bottom:14px;
          font-size:10.5px;color:#2a2d3d;font-weight:600;
          text-transform:uppercase;letter-spacing:.07em;
        }
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:#181b24;}

        /* ── Features ── */
        .features{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;}
        .feat{
          display:flex;align-items:center;gap:11px;
          padding:10px 13px;background:#0d1017;
          border:1px solid #191d27;border-radius:9px;
          font-size:13px;color:#8890aa;
        }
        .feat-ico{font-size:16px;flex-shrink:0;}
        .feat strong{color:#c4c8dc;font-weight:600;}

        /* ── Error ── */
        .err{
          padding:11px 13px;margin-bottom:12px;
          background:rgba(239,68,68,0.07);
          border:1px solid rgba(239,68,68,0.18);
          border-radius:9px;color:#f87171;font-size:12.5px;line-height:1.5;
        }

        /* ── Footer ── */
        .footer{
          text-align:center;padding:14px 22px 18px;
          border-top:1px solid #141720;
        }
        .footer-note{font-size:11px;color:#282c3a;line-height:1.65;margin-bottom:10px;}
        .kdex-credit{
          display:inline-flex;align-items:center;gap:5px;
          font-size:11px;color:#2e3347;
          text-decoration:none;
          transition:color .18s;
        }
        .kdex-credit:hover{color:#229ed9;}
        .kdex-dot{
          width:4px;height:4px;border-radius:50%;
          background:#2e3347;margin:0 2px;
        }

        @media(max-width:400px){
          .banner{padding:20px 18px 18px}
          .body{padding:18px 16px 22px}
          .banner h1{font-size:19px}
        }
      `}</style>

      <div className="page">
        <div className="card">

          {/* ── Banner ── */}
          <div className="banner">
            <div className="tg-wrap">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.963.889z"/>
              </svg>
            </div>
            <h1>Join Our Private<br/>Telegram Channel</h1>
            <p className="banner-sub">Exclusive content · Expert support · Zero spam</p>
          </div>

          {/* ── Body ── */}
          <div className="body">

            {/* Live badge */}
            <div style={{textAlign:"center"}}>
              <span className="live"><span className="live-dot"/>Members Active Now</span>
            </div>

            {/* Stats */}
            <div className="stats">
              {[["10K+","Members"],["Daily","Updates"],["Free","Access"]].map(([n,l])=>(
                <div className="stat" key={l}>
                  <div className="stat-num">{n}</div>
                  <div className="stat-lbl">{l}</div>
                </div>
              ))}
            </div>

            {/* ── CTA — TOP ── */}
            {status === "done" ? (
              <button className="btn btn-done" disabled>
                ✅ Opened in Telegram — Request to Join
              </button>
            ) : (
              <button
                className="btn btn-primary"
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
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="white">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.963.889z"/>
                    </svg>
                    Join Community Free →
                  </>
                )}
              </button>
            )}

            {/* Redirect notice with manual link */}
            {status === "redirecting" && tgLink && (
              <div className="redirect-notice">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5ab5e0" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0,marginTop:1}}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>
                  Telegram এ যাচ্ছেন… না খুললে{" "}
                  <a href={tgLink} style={{color:"#229ed9",fontWeight:600}} target="_blank" rel="noreferrer">
                    এখানে ক্লিক করুন
                  </a>
                </span>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="err">⚠️ {errMsg} — Please try again.</div>
            )}

            {/* Divider */}
            <div className="divider">What you get</div>

            {/* Features */}
            <div className="features">
              {[
                ["🔒","Private Access","Verified members only — no public link"],
                ["⚡","Daily Insights","Fresh exclusive content every day"],
                ["💬","Expert Support","Direct answers from our specialists"],
                ["🎯","Zero Spam","Only high-value, curated posts"],
              ].map(([ico,title,desc])=>(
                <div className="feat" key={title}>
                  <span className="feat-ico">{ico}</span>
                  <span><strong>{title}</strong> — {desc}</span>
                </div>
              ))}
            </div>

          </div>{/* /body */}

          {/* ── Footer ── */}
          <div className="footer">
            <p className="footer-note">
              আপনার invite link টি unique এবং শুধুমাত্র আপনার জন্য।<br/>
              Telegram এ "Request to Join" করলেই আপনার জায়গা নিশ্চিত হবে।
            </p>
            <a
              href="https://kdex.io"
              target="_blank"
              rel="noreferrer"
              className="kdex-credit"
            >
              <span>Ads by</span>
              <span className="kdex-dot"/>
              <strong style={{color:"#3a4060",fontWeight:700,letterSpacing:".03em"}}>KDex</strong>
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
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0b0c10",color:"#3a3d4e",fontFamily:"system-ui"}}>
        Loading…
      </div>
    }>
      <LandingPage/>
    </Suspense>
  );
}
