// OutbreakOS — Sign-up View
// Exports SignupView to window.

(function () {
  const { useState, useEffect, useRef } = React;

  const LI = ({ n, size = 15 }) => {
    const p = {
      arrow:  <path d="M5 12h14M13 6l6 6-6 6"/>,
      back:   <path d="M19 12H5M11 6l-6 6 6 6"/>,
      user:   <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
      mail:   <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></>,
      lock:   <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
      build:  <path d="M3 21h18M3 18V8l9-5 9 5v10M9 21v-6h6v6"/>,
      check:  <path d="M5 12l4 4 10-10"/>,
      eye:    <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></>,
      eyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10 10 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.67 9.67 0 0 0 5.39-1.61M2 2l20 20"/></>,
    };
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {p[n]}
      </svg>
    );
  };

  /* password strength: 0-4 */
  function pwStrength(pw) {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8)            s++;
    if (/[A-Z]/.test(pw))          s++;
    if (/[0-9]/.test(pw))          s++;
    if (/[^A-Za-z0-9]/.test(pw))   s++;
    return s;
  }
  const STRENGTH_LABEL = ['', 'WEAK', 'FAIR', 'GOOD', 'STRONG'];
  const STRENGTH_COLOR = ['', 'var(--sev-critical)', 'var(--sev-advisory)', 'var(--sev-warning)', 'var(--sev-resolved)'];

  function SignupView({ onSignup, onLogin }) {
    const [name,      setName]      = useState('');
    const [email,     setEmail]     = useState('');
    const [password,  setPassword]  = useState('');
    const [confirm,   setConfirm]   = useState('');
    const [showPw,    setShowPw]    = useState(false);
    const [loading,   setLoading]   = useState(false);
    const [errors,    setErrors]    = useState({});
    const [success,   setSuccess]   = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
      if (videoRef.current) videoRef.current.src = 'assets/LOGIN_VIDEO.mp4';
    }, []);

    function validate() {
      const e = {};
      if (!name.trim())             e.name     = 'Full name is required.';
      if (!email.trim())            e.email    = 'Email is required.';
      else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address.';
      if (!password)                e.password = 'Password is required.';
      else if (password.length < 8) e.password = 'Password must be at least 8 characters.';
      if (!confirm)                 e.confirm  = 'Please confirm your password.';
      else if (confirm !== password) e.confirm  = 'Passwords do not match.';
      return e;
    }

    async function handleSubmit(e) {
      e.preventDefault();
      const errs = validate();
      if (Object.keys(errs).length) { setErrors(errs); return; }
      setErrors({});
      setLoading(true);
      try {
        const user = await ObsAuth.signup(name, email, password);
        setSuccess(true);
        setTimeout(() => onSignup(user), 1200);
      } catch (err) {
        setErrors({ global: err.message });
      } finally {
        setLoading(false);
      }
    }

    const strength = pwStrength(password);

    if (success) {
      return (
        <div style={su.shell}>
          <video ref={videoRef} autoPlay muted loop playsInline style={su.video}/>
          <div style={su.veil}/>
          <div style={{ ...su.card, alignItems:'center', textAlign:'center', gap:24 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(63,182,138,.12)', border:'1px solid rgba(63,182,138,.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--sev-resolved)' }}>
              <LI n="check" size={24}/>
            </div>
            <div>
              <div style={{ ...su.wordmark, justifyContent:'center', marginBottom:8 }}>OUTBREAK<span style={su.sep}>▮</span>OS</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--fg-2)', letterSpacing:'.08em' }}>Account created. Entering console…</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={su.shell}>
        <video ref={videoRef} autoPlay muted loop playsInline style={su.video}/>
        <div style={su.veil}/>
        <div style={su.scanlines}/>

        <div style={su.card}>
          {/* Brand */}
          <div style={su.brandRow}>
            <button onClick={onLogin} style={su.backBtn}><LI n="back" size={13}/></button>
            <div style={su.wordmark}>OUTBREAK<span style={su.sep}>▮</span>OS</div>
            <div style={{ width:28 }}/>
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--fg-3)', textAlign:'center', marginTop:-10 }}>
            Create account
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:13 }}>
            {/* Global error */}
            {errors.global && (
              <div style={su.errorBox}>
                <span style={{ color:'var(--sev-critical)', fontSize:11, fontFamily:'var(--font-mono)' }}>✕ {errors.global}</span>
              </div>
            )}

            {/* Name */}
            <Field icon="user" label="Full name" error={errors.name}>
              <input type="text" value={name} onChange={e => { setName(e.target.value); setErrors(v=>({...v,name:''})); }}
                className="obs-input" style={su.input} placeholder="Elena Marquez" autoComplete="name" disabled={loading}/>
            </Field>

            {/* Email */}
            <Field icon="mail" label="Email" error={errors.email}>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(v=>({...v,email:''})); }}
                className="obs-input" style={su.input} placeholder="analyst@outbreakos.io" autoComplete="email" disabled={loading}/>
            </Field>

            {/* Password */}
            <Field icon="lock" label="Password" error={errors.password}>
              <div style={{ position:'relative', display:'flex', flexDirection:'column' }}>
                <div style={{ position:'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(v=>({...v,password:''})); }}
                    className="obs-input" style={{ ...su.input, paddingRight:36 }}
                    placeholder="············" autoComplete="new-password" disabled={loading}/>
                  <button type="button" onClick={() => setShowPw(p=>!p)} style={su.pwBtn}><LI n={showPw ? 'eyeOff' : 'eye'} size={13}/></button>
                </div>
                {password && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i <= strength ? STRENGTH_COLOR[strength] : 'rgba(255,255,255,.08)', transition:'background .2s' }}/>
                    ))}
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:9, letterSpacing:'.1em', color: STRENGTH_COLOR[strength], minWidth:40 }}>
                      {STRENGTH_LABEL[strength]}
                    </span>
                  </div>
                )}
              </div>
            </Field>

            {/* Confirm */}
            <Field icon="lock" label="Confirm password" error={errors.confirm}>
              <input type="password" value={confirm}
                onChange={e => { setConfirm(e.target.value); setErrors(v=>({...v,confirm:''})); }}
                className="obs-input" style={su.input}
                placeholder="············" autoComplete="new-password" disabled={loading}/>
            </Field>

            {/* Submit */}
            <button type="submit" disabled={loading} style={{ ...su.submitBtn, ...(loading ? su.submitBtnLoading : {}) }}>
              {loading
                ? <><span style={su.spinner}/> CREATING ACCOUNT…</>
                : <>CREATE ACCOUNT <LI n="arrow" size={14}/></>
              }
            </button>
          </form>

          {/* Sign-in link */}
          <div style={{ textAlign:'center' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg-3)' }}>
              Already have an account?{' '}
              <a href="#" style={su.link} onClick={e => { e.preventDefault(); onLogin(); }}>Sign in</a>
            </span>
          </div>
        </div>

        <div style={su.footer}>SOC2 TYPE II · ISO 27001 · ON-PREM AVAILABLE</div>
      </div>
    );
  }

  /* ---- Field helper ---- */
  const su_inputIcon = {
    position:'absolute', left:10, top:9,
    color:'var(--fg-3)', pointerEvents:'none', display:'flex', alignItems:'center',
  };
  function Field({ icon, label, error, children }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <label style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color: error ? 'var(--sev-critical)' : 'var(--fg-3)' }}>
          {label}
        </label>
        <div style={{ position:'relative' }}>
          <span style={su_inputIcon}><LI n={icon} size={14}/></span>
          {children}
        </div>
        {error && <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--sev-critical)', letterSpacing:'.04em' }}>✕ {error}</span>}
      </div>
    );
  }

  /* ---- styles ---- */
  const su = {
    shell: { position:'relative', width:'100%', height:'100%', display:'grid', placeItems:'center', background:'var(--bg-base)', overflow:'hidden' },
    video: { position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:.18, zIndex:0 },
    veil:  { position:'absolute', inset:0, zIndex:1, background:'linear-gradient(135deg, rgba(6,8,10,.98) 0%, rgba(14,18,22,.85) 50%, rgba(6,8,10,.92) 100%)' },
    scanlines: { position:'absolute', inset:0, zIndex:2, pointerEvents:'none', backgroundImage:'repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(0,0,0,.07) 3px, rgba(0,0,0,.07) 4px)' },
    card: { position:'relative', zIndex:5, width:380, background:'var(--bg-panel)', border:'1px solid rgba(255,255,255,.10)', borderRadius:6, padding:'32px 36px 28px', display:'flex', flexDirection:'column', gap:18, boxShadow:'0 32px 80px rgba(0,0,0,.8)' },
    brandRow: { display:'flex', alignItems:'center', justifyContent:'space-between' },
    backBtn: { width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'1px solid rgba(255,255,255,.1)', borderRadius:3, color:'var(--fg-3)', cursor:'pointer' },
    wordmark: { fontFamily:'var(--font-mono)', fontSize:14, fontWeight:600, letterSpacing:'.22em', color:'var(--fg-1)', display:'flex', alignItems:'center' },
    sep: { color:'var(--accent-cyan)', margin:'0 3px', fontSize:9 },
    input: { padding:'0 12px 0 34px' },
    pwBtn: { position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--fg-3)', cursor:'pointer', display:'flex', alignItems:'center', padding:4 },
    errorBox: { padding:'8px 12px', background:'rgba(229,72,77,.08)', border:'1px solid rgba(229,72,77,.25)', borderRadius:3 },
    submitBtn: { height:42, background:'var(--accent-cyan)', color:'var(--fg-on-accent)', border:'none', borderRadius:3, cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'background .15s' },
    submitBtnLoading: { background:'var(--accent-cyan-dim)', cursor:'not-allowed' },
    spinner: { width:12, height:12, borderRadius:'50%', border:'2px solid rgba(6,8,10,.3)', borderTopColor:'var(--fg-on-accent)', animation:'obs-spin .7s linear infinite', flexShrink:0 },
    link: { fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent-cyan)', textDecoration:'none' },
    footer: { position:'absolute', bottom:20, left:0, right:0, textAlign:'center', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.12em', color:'var(--fg-4)', zIndex:5 },
  };

  window.SignupView = SignupView;
})();
