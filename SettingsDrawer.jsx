// OutbreakOS — Settings Drawer
// Slide-in panel from the right. Persists via ObsAuth.saveSettings().
// Props: open, onClose, user, onLogout, onUserUpdate, mapStyleKey, onMapStyleChange
// Exports SettingsDrawer to window.

(function () {
  const { useState, useEffect, useCallback } = React;

  const MAP_PROVIDER_OPTIONS = [
    { value: 'carto_dark',    label: 'CARTO Dark (default)' },
    { value: 'osm_standard',  label: 'OpenStreetMap Standard' },
    { value: 'carto_voyager', label: 'CARTO Voyager (light)' },
    { value: 'stadia_dark',   label: 'Stadia Alidade Dark' },
  ];

  const LI = ({ n, size = 15 }) => {
    const p = {
      x:       <path d="M18 6 6 18M6 6l12 12"/>,
      logout:  <path d="M17 16l4-4-4-4M11 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6M21 12H9"/>,
      user:    <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
      save:    <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 20v-8h6v8M9 4v4h6V4"/>,
      bell:    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/>,
      map:     <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>,
      refresh: <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4"/>,
      sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>,
      check:   <path d="M5 12l4 4 10-10"/>,
    };
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {p[n]}
      </svg>
    );
  };

  /* ---- Toggle component ---- */
  function Toggle({ on, onChange }) {
    return (
      <button
        onClick={() => onChange(!on)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: on ? 'var(--accent-cyan)' : 'rgba(255,255,255,.12)',
          position: 'relative', transition: 'background .2s', flexShrink: 0,
          padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16,
          borderRadius: '50%', background: on ? 'var(--bg-base)' : 'var(--fg-3)',
          transition: 'left .2s, background .2s',
        }}/>
      </button>
    );
  }

  /* ---- Section header ---- */
  function SectionHead({ icon, title }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 0 8px', borderBottom:'1px solid rgba(255,255,255,.06)', marginBottom:12 }}>
        <span style={{ color:'var(--fg-3)' }}><LI n={icon} size={13}/></span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--fg-3)' }}>{title}</span>
      </div>
    );
  }

  /* ---- Row: label + control ---- */
  function Row({ label, sub, children }) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'6px 0' }}>
        <div>
          <div style={{ fontSize:13, color:'var(--fg-1)' }}>{label}</div>
          {sub && <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-3)', marginTop:2 }}>{sub}</div>}
        </div>
        {children}
      </div>
    );
  }

  /* ---- Select ---- */
  function Select({ value, options, onChange }) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background:'var(--bg-graphite)', border:'1px solid rgba(255,255,255,.10)',
          borderRadius:3, color:'var(--fg-1)', fontFamily:'var(--font-mono)',
          fontSize:11, padding:'4px 8px', cursor:'pointer', outline:'none',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  function SettingsDrawer({ open, onClose, user, onLogout, onUserUpdate, mapStyleKey, onMapStyleChange }) {
    const [settings, setSettings] = useState(() => ObsAuth.getSettings());
    const [profile,  setProfile]  = useState({ name: user?.name || '', email: user?.email || '', org: user?.org || '' });
    const [saved,    setSaved]    = useState(false);

    /* Refresh profile/settings whenever drawer opens */
    useEffect(() => {
      if (open) {
        setSettings(ObsAuth.getSettings());
        const u = ObsAuth.getUser();
        if (u) setProfile({ name: u.name, email: u.email, org: u.org || '' });
        setSaved(false);
      }
    }, [open]);

    /* Persist settings on every change */
    const update = useCallback((key, val) => {
      setSettings(prev => {
        const next = { ...prev, [key]: val };
        ObsAuth.saveSettings(next);
        return next;
      });
    }, []);

    const updateNot = useCallback((key, val) => {
      setSettings(prev => {
        const next = { ...prev, notifications: { ...prev.notifications, [key]: val } };
        ObsAuth.saveSettings(next);
        return next;
      });
    }, []);

    function handleMapProviderChange(val) {
      update('mapProvider', val);
      if (onMapStyleChange) onMapStyleChange(val);
    }

    function saveProfile() {
      const updated = ObsAuth.updateUser({ name: profile.name, org: profile.org });
      if (updated && onUserUpdate) onUserUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    function handleLogout() {
      ObsAuth.logout();
      onLogout();
    }

    const currentMapKey = mapStyleKey || settings.mapProvider || 'carto_dark';

    return (
      <>
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position:'fixed', inset:0, zIndex:200,
            background:'rgba(0,0,0,.55)',
            opacity: open ? 1 : 0,
            pointerEvents: open ? 'all' : 'none',
            transition:'opacity .22s',
          }}
        />

        {/* Drawer */}
        <div style={{
          position:'fixed', top:0, right:0, bottom:0, zIndex:201,
          width:360, background:'var(--bg-panel)',
          borderLeft:'1px solid rgba(255,255,255,.10)',
          boxShadow:'-16px 0 64px rgba(0,0,0,.6)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition:'transform .22s cubic-bezier(0.2,0,0,1)',
          display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,.08)', flexShrink:0, background:'var(--bg-graphite)' }}>
            <div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--fg-3)' }}>SETTINGS</div>
              <div style={{ fontSize:16, fontWeight:600, fontFamily:'var(--font-display)', color:'var(--fg-1)', marginTop:2 }}>Workspace preferences</div>
            </div>
            <button onClick={onClose} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'1px solid rgba(255,255,255,.1)', borderRadius:3, color:'var(--fg-2)', cursor:'pointer' }}>
              <LI n="x" size={14}/>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="obs-drawer-scroll" style={{ flex:1, overflowY:'auto', padding:'4px 18px 24px' }}>

            {/* ---- Profile ---- */}
            <SectionHead icon="user" title="Profile"/>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <ProfileField label="Full name" value={profile.name} onChange={v => setProfile(p=>({...p, name:v}))}/>
              <ProfileField label="Email" value={profile.email} readOnly hint="Contact support to change email"/>
              <ProfileField label="Organisation" value={profile.org} onChange={v => setProfile(p=>({...p, org:v}))} placeholder="WHO · Geneva"/>
              <button onClick={saveProfile} style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:6, height:30, padding:'0 14px', background: saved ? 'rgba(63,182,138,.12)' : 'var(--bg-graphite)', border: saved ? '1px solid rgba(63,182,138,.3)' : '1px solid rgba(255,255,255,.1)', borderRadius:3, color: saved ? 'var(--sev-resolved)' : 'var(--fg-2)', fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'.08em', cursor:'pointer', transition:'all .2s' }}>
                <LI n={saved ? 'check' : 'save'} size={12}/>{saved ? 'SAVED' : 'SAVE PROFILE'}
              </button>
            </div>

            {/* ---- Display ---- */}
            <SectionHead icon="sliders" title="Display"/>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <Row label="Theme" sub="Dark mode only in this build">
                <Select value={settings.themeMode} options={[{value:'dark',label:'Dark'},{value:'dim',label:'Dim'},{value:'light',label:'Light (soon)'}]} onChange={v=>update('themeMode',v)}/>
              </Row>
              <Row label="Compact mode" sub="Reduce row heights and padding">
                <Toggle on={settings.compactMode} onChange={v=>update('compactMode',v)}/>
              </Row>
            </div>

            {/* ---- Map ---- */}
            <SectionHead icon="map" title="Map"/>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <Row label="Tile provider" sub="Live OSM/CARTO tiles via MapLibre GL">
                <Select
                  value={currentMapKey}
                  options={MAP_PROVIDER_OPTIONS}
                  onChange={handleMapProviderChange}
                />
              </Row>
              <div style={{ padding:'8px 0 4px' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-4)', letterSpacing:'.06em', lineHeight:1.5 }}>
                  CARTO Dark — high-contrast intelligence aesthetic<br/>
                  OSM Standard — full cartographic detail<br/>
                  CARTO Voyager — light neutral base<br/>
                  Stadia Dark — minimal dark alt
                </div>
              </div>
            </div>

            {/* ---- Data pipeline ---- */}
            <SectionHead icon="refresh" title="Data pipeline"/>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <Row label="Refresh interval" sub={`Auto-reload every ${settings.refreshInterval}s`}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="range" min={10} max={120} step={5} value={settings.refreshInterval}
                    onChange={e=>update('refreshInterval', Number(e.target.value))}
                    style={{ width:80, accentColor:'var(--accent-cyan)' }}/>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg-2)', minWidth:30, textAlign:'right' }}>
                    {settings.refreshInterval}s
                  </span>
                </div>
              </Row>
            </div>

            {/* ---- Notifications ---- */}
            <SectionHead icon="bell" title="Notifications"/>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <Row label="Critical alerts" sub="SEV ≥ 4 push notification">
                <Toggle on={settings.notifications.alerts} onChange={v=>updateNot('alerts',v)}/>
              </Row>
              <Row label="PHEIC declarations" sub="WHO public health emergencies">
                <Toggle on={settings.notifications.pheic} onChange={v=>updateNot('pheic',v)}/>
              </Row>
              <Row label="Daily digest" sub="06:00 UTC summary email">
                <Toggle on={settings.notifications.digest} onChange={v=>updateNot('digest',v)}/>
              </Row>
            </div>

            {/* ---- Source priority ---- */}
            <SectionHead icon="sliders" title="Source priority"/>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, paddingBottom:8 }}>
              {settings.sourcePriority.map((src, i) => (
                <div key={src} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', background:'var(--bg-graphite)', border:'1px solid rgba(255,255,255,.1)', borderRadius:2 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-3)', minWidth:12 }}>{i+1}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent-cyan)' }}>{src}</span>
                  <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                    <button onClick={() => { if (i===0) return; const a=[...settings.sourcePriority]; [a[i-1],a[i]]=[a[i],a[i-1]]; update('sourcePriority',a); }} disabled={i===0} style={{ background:'none', border:'none', color: i===0 ? 'var(--fg-4)' : 'var(--fg-2)', cursor: i===0 ? 'default':'pointer', padding:0, lineHeight:1, fontSize:9 }}>▲</button>
                    <button onClick={() => { if (i===settings.sourcePriority.length-1) return; const a=[...settings.sourcePriority]; [a[i],a[i+1]]=[a[i+1],a[i]]; update('sourcePriority',a); }} disabled={i===settings.sourcePriority.length-1} style={{ background:'none', border:'none', color: i===settings.sourcePriority.length-1 ? 'var(--fg-4)' : 'var(--fg-2)', cursor: i===settings.sourcePriority.length-1 ? 'default':'pointer', padding:0, lineHeight:1, fontSize:9 }}>▼</button>
                  </div>
                </div>
              ))}
            </div>

            {/* ---- Session ---- */}
            <div style={{ marginTop:8, padding:'12px 14px', background:'rgba(229,72,77,.05)', border:'1px solid rgba(229,72,77,.15)', borderRadius:4 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--fg-3)', marginBottom:8 }}>Session</div>
              <div style={{ fontSize:13, color:'var(--fg-2)', marginBottom:12 }}>
                Signed in as <b style={{color:'var(--fg-1)'}}>{profile.email || user?.email}</b>
              </div>
              <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:8, height:34, padding:'0 16px', background:'rgba(229,72,77,.1)', border:'1px solid rgba(229,72,77,.25)', borderRadius:3, color:'var(--sev-critical)', fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'.08em', cursor:'pointer', textTransform:'uppercase' }}>
                <LI n="logout" size={13}/>Sign out
              </button>
            </div>

          </div>

          {/* Footer */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', padding:'10px 18px', background:'var(--bg-graphite)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-4)', letterSpacing:'.08em' }}>v2.14.3 · Settings auto-saved</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color: 'var(--sev-resolved)' }}>● OPERATIONAL</span>
          </div>
        </div>
      </>
    );
  }

  /* ---- Profile field helper ---- */
  function ProfileField({ label, value, onChange, readOnly, hint, placeholder }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <label style={{ fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color: readOnly ? 'var(--fg-4)' : 'var(--fg-3)' }}>
          {label}
        </label>
        <input
          type="text"
          value={value}
          onChange={e => onChange && onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className="obs-profile-input"
          style={{
            width: '100%',
            height:34, padding:'0 10px',
            background: readOnly ? 'rgba(255,255,255,.02)' : 'var(--bg-graphite)',
            border:'1px solid rgba(255,255,255,.08)',
            borderRadius:3, color: readOnly ? 'var(--fg-3)' : 'var(--fg-1)',
            fontFamily:'var(--font-sans)', fontSize:13, outline:'none',
            cursor: readOnly ? 'default' : 'text',
          }}
        />
        {hint && <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-4)' }}>{hint}</span>}
      </div>
    );
  }

  window.SettingsDrawer = SettingsDrawer;
})();
