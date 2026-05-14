// OutbreakOS — Login View
// Exports LoginView to window.

(function () {
  const { useState, useEffect, useRef } = React;

  /* ---- inline icon subset ---- */
  const LI = ({ n, size = 15 }) => {
    const p = {
      eye:    <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></>,
      eyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10 10 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.67 9.67 0 0 0 5.39-1.61M2 2l20 20"/></>,
      google: <><path d="M12 11h8.53c.14.6.22 1.22.22 1.85C20.75 17.8 17 21 12 21a9 9 0 1 1 0-18c2.4 0 4.58.94 6.2 2.47L15.8 7.8A5.85 5.85 0 0 0 12 6a6 6 0 1 0 0 12c2.97 0 5.46-1.84 6.28-4.5H12v-2.5z"/></>,
      arrow:  <path d="M5 12h14M13 6l6 6-6 6"/>,
      lock:   <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
      mail:   <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></>,
    };
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {p[n]}
      </svg>
    );
  };

  function LoginView({ onLogin, onSignup }) {
    const [email,    setEmail]    = useState('demo@outbreakos.dev');
    const [password, setPassword] = useState('');
    const [showPw,   setShowPw]   = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');
    const videoRef = useRef(null);

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.src = 'assets/LOGIN_VIDEO.mp4';
      }
    }, []);

    async function handleSubmit(e) {
      e.preventDefault();
      if (!email.trim())    { setError('Email is required.'); return; }
      if (!password)        { setError('Password is required.'); return; }
      setError('');
      setLoading(true);
      try {
        const user = await ObsAuth.login(email, password, remember);
        onLogin(user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <div style={loginStyles.shell}>
        {/* Video background */}
        <video
          ref={videoRef}
          autoPlay muted loop playsInline
          style={loginStyles.video}
        />
        {/* Overlay veil */}
        <div style={loginStyles.veil}/>
        {/* Scan-line texture */}
        <div style={loginStyles.scanlines}/>

        {/* Card */}
        <div style={loginStyles.card}>
          {/* Brand */}
          <div style={loginStyles.brand}>
            <div style={loginStyles.wordmark}>
              OUTBREAK<span style={loginStyles.sep}>▮</span>OS
            </div>
            <div style={loginStyles.tagline}>Global outbreak intelligence</div>
          </div>

          {/* Live status eyebrow */}
          <div style={loginStyles.liveRow}>
            <span style={loginStyles.livePip}/>
            <span style={loginStyles.liveText}>LIVE · 1,247 SIGNALS · 14 SEV≥3</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Email */}
            <div style={loginStyles.fieldGroup}>
              <label style={loginStyles.label}>Email</label>
              <div style={loginStyles.inputWrap}>
                <span style={loginStyles.inputIcon}><LI n="mail" size={14}/></span>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  className="obs-input"
                  style={{ paddingLeft:34 }}
                  placeholder="analyst@outbreakos.io"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div style={loginStyles.fieldGroup}>
              <label style={loginStyles.label}>Password</label>
              <div style={loginStyles.inputWrap}>
                <span style={loginStyles.inputIcon}><LI n="lock" size={14}/></span>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="obs-input"
                  style={{ paddingLeft:34, paddingRight:38 }}
                  placeholder="············"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} style={loginStyles.pwToggle}>
                  <LI n={showPw ? 'eyeOff' : 'eye'} size={13}/>
                </button>
              </div>
            </div>

            {/* Remember + forgot */}
            <div style={loginStyles.remRow}>
              <label style={loginStyles.remLabel}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ accentColor:'var(--accent-cyan)', marginRight:6 }}
                />
                Remember me
              </label>
              <a href="#" style={loginStyles.link} onClick={e => e.preventDefault()}>Forgot password?</a>
            </div>

            {/* Error */}
            {error && (
              <div style={loginStyles.errorBox}>
                <span style={{ color:'var(--sev-critical)', fontSize:11, fontFamily:'var(--font-mono)' }}>
                  ✕ {error}
                </span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              ...loginStyles.submitBtn,
              ...(loading ? loginStyles.submitBtnLoading : {}),
            }}>
              {loading
                ? <><span style={loginStyles.spinner}/> AUTHENTICATING…</>
                : <>SIGN IN <LI n="arrow" size={14}/></>
              }
            </button>
          </form>

          {/* Divider */}
          <div style={loginStyles.divider}>
            <div style={loginStyles.divLine}/><span style={loginStyles.divText}>or</span><div style={loginStyles.divLine}/>
          </div>

          {/* Google placeholder */}
          <button style={loginStyles.googleBtn} disabled onClick={e => e.preventDefault()}>
            <LI n="google" size={15}/>
            <span>Continue with Google</span>
            <span style={{ fontSize:9, color:'var(--fg-4)', fontFamily:'var(--font-mono)', marginLeft:'auto' }}>NOT CONFIGURED</span>
          </button>

          {/* Sign up link */}
          <div style={{ textAlign:'center', marginTop:4 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg-3)' }}>
              No account?{' '}
              <a href="#" style={loginStyles.link} onClick={e => { e.preventDefault(); onSignup(); }}>
                Create one
              </a>
            </span>
          </div>

          {/* Demo hint */}
          <div style={loginStyles.demoHint}>
            <span style={{ color:'var(--fg-4)', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.06em' }}>
              DEMO · demo@outbreakos.dev · demo1234
            </span>
          </div>
        </div>

        {/* Footer certs */}
        <div style={loginStyles.footer}>
          SOC2 TYPE II · ISO 27001 · ON-PREM AVAILABLE
        </div>
      </div>
    );
  }

  /* ---- styles ---- */
  const loginStyles = {
    shell: {
      position:'relative', width:'100%', height:'100%',
      display:'grid', placeItems:'center',
      background:'var(--bg-base)', overflow:'hidden',
    },
    video: {
      position:'absolute', inset:0, width:'100%', height:'100%',
      objectFit:'cover', opacity:.18, zIndex:0,
    },
    veil: {
      position:'absolute', inset:0, zIndex:1,
      background:'linear-gradient(135deg, rgba(6,8,10,.98) 0%, rgba(14,18,22,.85) 50%, rgba(6,8,10,.92) 100%)',
    },
    scanlines: {
      position:'absolute', inset:0, zIndex:2, pointerEvents:'none',
      backgroundImage:'repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(0,0,0,.07) 3px, rgba(0,0,0,.07) 4px)',
    },
    card: {
      position:'relative', zIndex:5, width:380,
      background:'var(--bg-panel)',
      border:'1px solid rgba(255,255,255,.10)',
      borderRadius:6, padding:'40px 36px 32px',
      display:'flex', flexDirection:'column', gap:20,
      boxShadow:'0 32px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(91,198,232,.06)',
    },
    brand: { textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:10 },
    wordmark: {
      fontFamily:'var(--font-mono)', fontSize:16, fontWeight:600, letterSpacing:'.22em',
      color:'var(--fg-1)', display:'flex', alignItems:'center', gap:0,
    },
    sep: { color:'var(--accent-cyan)', margin:'0 3px', fontSize:10 },
    tagline: {
      fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.14em',
      textTransform:'uppercase', color:'var(--fg-3)',
    },
    liveRow: {
      display:'flex', alignItems:'center', gap:8, justifyContent:'center',
      padding:'6px 12px', background:'rgba(91,198,232,.04)',
      border:'1px solid rgba(91,198,232,.12)', borderRadius:3,
    },
    livePip: {
      display:'inline-block', width:6, height:6, borderRadius:'50%',
      background:'var(--accent-cyan)', boxShadow:'0 0 0 3px rgba(91,198,232,.2)',
      animation:'pip 1s ease-in-out infinite', flexShrink:0,
    },
    liveText: { fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.1em', color:'var(--fg-3)' },
    fieldGroup: { display:'flex', flexDirection:'column', gap:6 },
    label: {
      fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.12em',
      textTransform:'uppercase', color:'var(--fg-3)',
    },
    inputWrap: { position:'relative', display:'flex', alignItems:'center' },
    inputIcon: {
      position:'absolute', left:10, color:'var(--fg-3)', pointerEvents:'none',
      display:'flex', alignItems:'center',
    },
    input: {
      width:'100%', height:38, padding:'0 12px 0 34px',
      background:'var(--bg-graphite)', border:'1px solid rgba(255,255,255,.10)',
      borderRadius:3, color:'var(--fg-1)', fontFamily:'var(--font-sans)',
      fontSize:14, outline:'none',
      transition:'border-color .15s, box-shadow .15s',
    },
    pwToggle: {
      position:'absolute', right:8, background:'none', border:'none',
      color:'var(--fg-3)', cursor:'pointer', display:'flex', alignItems:'center',
      padding:4, borderRadius:3,
    },
    remRow: { display:'flex', alignItems:'center', justifyContent:'space-between' },
    remLabel: {
      display:'flex', alignItems:'center', cursor:'pointer',
      fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg-2)',
    },
    link: {
      fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent-cyan)',
      textDecoration:'none',
    },
    errorBox: {
      padding:'8px 12px', background:'rgba(229,72,77,.08)',
      border:'1px solid rgba(229,72,77,.25)', borderRadius:3,
    },
    submitBtn: {
      height:42, background:'var(--accent-cyan)', color:'var(--fg-on-accent)',
      border:'none', borderRadius:3, cursor:'pointer',
      fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600,
      letterSpacing:'.1em', textTransform:'uppercase',
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      transition:'background .15s',
    },
    submitBtnLoading: { background:'var(--accent-cyan-dim)', cursor:'not-allowed' },
    spinner: {
      width:12, height:12, borderRadius:'50%',
      border:'2px solid rgba(6,8,10,.3)', borderTopColor:'var(--fg-on-accent)',
      animation:'obs-spin .7s linear infinite', flexShrink:0,
    },
    divider: { display:'flex', alignItems:'center', gap:10 },
    divLine: { flex:1, height:1, background:'rgba(255,255,255,.08)' },
    divText: { fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-4)', textTransform:'uppercase', letterSpacing:'.1em' },
    googleBtn: {
      height:38, display:'flex', alignItems:'center', gap:10, padding:'0 14px',
      background:'var(--bg-graphite)', border:'1px solid rgba(255,255,255,.10)',
      borderRadius:3, color:'var(--fg-2)', cursor:'not-allowed', opacity:.55,
      fontFamily:'var(--font-sans)', fontSize:13,
    },
    footer: {
      position:'absolute', bottom:20, left:0, right:0, textAlign:'center',
      fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.12em',
      color:'var(--fg-4)', zIndex:5,
    },
    demoHint: {
      textAlign:'center', padding:'8px 12px',
      background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)',
      borderRadius:3, marginTop:-6,
    },
  };

  window.LoginView = LoginView;
})();
