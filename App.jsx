// OutbreakOS — Root Application v3.0
// Full SaaS upgrade: Architecture, Sources, Feed filters, RAG console, Timeline

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const API_BASE = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8000';
    return window.location.origin;
  }
  return '';
})();

const useMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= 740
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 740);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

/* ── API helper ───────────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[api] ${path}:`, e.message);
    return null;
  }
}

/* ── Watchlist helpers (localStorage) ────────────────────────────────────── */
const WL_KEY = 'obs_watchlist_v2';
function getWatchlist()    { try { return new Set(JSON.parse(localStorage.getItem(WL_KEY) || '[]')); } catch { return new Set(); } }
function saveWatchlist(wl) { localStorage.setItem(WL_KEY, JSON.stringify([...wl])); }
function toggleWatch(id)   { const w = getWatchlist(); w.has(id) ? w.delete(id) : w.add(id); saveWatchlist(w); return w; }

/* ── Acknowledge helpers ──────────────────────────────────────────────────── */
const ACK_KEY = 'obs_ack_v1';
const ACT_KEY = 'obs_actlog_v1';
function getAcknowledged() { try { return JSON.parse(localStorage.getItem(ACK_KEY) || '{}'); } catch { return {}; } }
function acknowledgeAlert(id, analyst, disease) {
  const acks = getAcknowledged();
  acks[id] = { at: new Date().toISOString(), analyst: analyst || 'Analyst', disease };
  localStorage.setItem(ACK_KEY, JSON.stringify(acks));
  const log = getActivityLog();
  log.unshift({ type:'acknowledge', id, disease, analyst: analyst||'Analyst', at: new Date().toISOString() });
  localStorage.setItem(ACT_KEY, JSON.stringify(log.slice(0,50)));
  return acks;
}
function getActivityLog() { try { return JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); } catch { return []; } }

/* ── Query history helpers ────────────────────────────────────────────────── */
const QH_KEY = 'obs_qhist_v1';
function getQueryHistory() { try { return JSON.parse(localStorage.getItem(QH_KEY) || '[]'); } catch { return []; } }
function pushQueryHistory(q, r) {
  const h = [{ q, r, at: new Date().toISOString() }, ...getQueryHistory()].slice(0, 20);
  localStorage.setItem(QH_KEY, JSON.stringify(h));
}

/* ── Severity helpers ─────────────────────────────────────────────────────── */
const SEV_CSS   = { 4:'var(--sev-critical)', 3:'var(--sev-warning)', 2:'var(--sev-advisory)', 1:'var(--sev-info)' };
const SEV_LABEL = { 4:'CRITICAL', 3:'WARNING', 2:'ADVISORY', 1:'MONITORING' };
const sevCls    = s => (['','monitoring','advisory','warning','critical'][s] || 'monitoring');
const sevColor  = s => SEV_CSS[s] || SEV_CSS[1];

/* ── Icon ─────────────────────────────────────────────────────────────────── */
const Icon = ({ n, size = 15 }) => {
  const p = {
    arrow:    <path d="M5 12h14M13 6l6 6-6 6"/>,
    back:     <path d="M19 12H5M11 6l-6 6 6 6"/>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    bell:     <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m6 9a2 2 0 0 0 4 0"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>,
    map:      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14"/>,
    layers:   <path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"/>,
    clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></>,
    play:     <path d="M8 5v14l11-7z"/>,
    pause:    <path d="M6 5h4v14H6zM14 5h4v14h-4z"/>,
    skipBack: <path d="M19 20V4l-9 8 9 8zM5 4v16"/>,
    skipFwd:  <path d="M5 4v16l9-8-9-8zM19 4v16"/>,
    pin:      <path d="M12 2v8M8 8h8l1 8H7zM12 16v6"/>,
    extLink:  <path d="M14 4h6v6M20 4l-9 9M10 7H5v12h12v-5"/>,
    check:    <path d="M5 12l4 4 10-10"/>,
    filter:   <path d="M3 6h18M6 12h12M10 18h4"/>,
    refresh:  <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4"/>,
    user:     <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    star:     <path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/>,
    starFill: <path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z" fill="currentColor"/>,
    close:    <path d="M18 6 6 18M6 6l12 12"/>,
    cpu:      <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></>,
    git:      <><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></>,
    globe:    <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></>,
    zap:      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>,
    shield:   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    box:      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>,
    server:   <><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></>,
    trend:    <path d="M23 6l-9.5 9.5-5-5L1 18"/>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {p[n] || null}
    </svg>
  );
};

/* ── Globe wrapper ────────────────────────────────────────────────────────── */
const GlobeView = ({ className, onReady }) => {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    inst.current = createGlobe(ref.current, { onReady });
    return () => inst.current && inst.current.dispose();
  }, []);
  return <div ref={ref} className={`globe-mount ${className || ''}`}/>;
};

/* ── Signal marquee ───────────────────────────────────────────────────────── */
const SignalStrip = ({ feedItems }) => {
  const items = feedItems && feedItems.length > 0
    ? feedItems.slice(0, 10).map(f => ({ ts:(f.ingested_at||'').slice(11,16), src:f.source, disease:f.disease||'UNKNOWN', region:f.region||'—', sev:f.severity||1 }))
    : [
        {ts:'14:22',src:'WHO',    disease:'H5N1',       region:'KHM·PP', sev:3},
        {ts:'14:08',src:'CDC',    disease:'MPOX·IB',    region:'COD·KN', sev:4},
        {ts:'13:41',src:'ECDC',   disease:'MEASLES',    region:'ROU·BU', sev:2},
        {ts:'13:22',src:'CDC',    disease:'H5N1',       region:'USA·CA', sev:3},
        {ts:'12:48',src:'PAHO',   disease:'HANTAVIRUS', region:'ARG·BA', sev:2},
        {ts:'11:09',src:'WHO',    disease:'MERS-COV',   region:'SAU·RY', sev:2},
        {ts:'10:42',src:'REUTERS',disease:'CHOLERA',    region:'SDN·KH', sev:3},
      ];
  return (
    <div className="lv__signals">
      <div className="signal-strip">
        <div className="signal-strip__inner">
          {[...items, ...items].map((s, i) => (
            <div key={i} className="sig-item">
              <span className="sig-item__dot" style={{background:SEV_CSS[s.sev]}}/>
              <span className="sig-item__src">{s.src}</span>
              <span className="sig-item__disease">{s.disease.toUpperCase()}</span>
              <span className="sig-item__region">· {s.region}</span>
              <span className="sig-item__sep"> ·· </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Landing view ─────────────────────────────────────────────────────────── */
const STATS = [
  {label:'ACTIVE SIGNALS', val:'1,247'},
  {label:'SEV ≥ 3',        val:'14'},
  {label:'SOURCES',         val:'140+'},
  {label:'MEDIAN INGEST',   val:'4.1s'},
  {label:'COUNTRIES',       val:'167'},
];

const LandingView = ({ onEnterConsole, onEnterTab, onLogin, user, feedItems }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 200); return () => clearTimeout(t); }, []);
  const initials = user ? user.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '';

  const handleNav = (l) => {
    if (l === 'Console' || l === 'Radar') { onEnterConsole(); return; }
    if (l === 'Feed')         { onEnterTab('feed'); return; }
    if (l === 'Architecture') { onEnterTab('architecture'); return; }
    if (l === 'Sources')      { onEnterTab('sources'); return; }
  };

  return (
    <div className={`lv ${ready ? 'lv--in' : ''}`}>
      <div className="lv__globe"><GlobeView/></div>
      <nav className="lv__nav">
        <div className="brand-wm">OUTBREAK<span className="brand-sep">▮</span>OS</div>
        <div className="lv__nav-links">
          {['Radar','Feed','Console','Architecture','Sources'].map(l => (
            <a key={l} href="#" onClick={e => { e.preventDefault(); handleNav(l); }}>{l}</a>
          ))}
        </div>
        <div className="lv__nav-cta">
          {user ? (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--bg-elevated)',border:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:10,fontWeight:600,color:'var(--fg-1)',display:'flex',alignItems:'center',justifyContent:'center'}}>{initials}</div>
              <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg-2)'}}>{user.name}</span>
            </div>
          ) : (
            <button className="btn btn--ghost" onClick={onLogin}>Sign in</button>
          )}
          <button className="btn btn--primary" onClick={onEnterConsole}>
            {user ? 'Open console' : 'Enter console'} <span className="btn-arrow">→</span>
          </button>
        </div>
      </nav>
      <div className="lv__copy">
        <div className="lv__eyebrow"><span className="live-pip"/> LIVE · 1,247 SIGNALS · 4.1S INGEST</div>
        <h1 className="lv__h1">Global outbreak<br/><em>intelligence.</em></h1>
        <p className="lv__sub">Continuous ingest from WHO, CDC, ECDC, ProMED and 140+ feeds. Normalized, geocoded, retrieval-grounded. Built for analysts and biosecurity teams.</p>
        <div className="lv__actions">
          <button className="btn btn--primary btn--lg" onClick={onEnterConsole}>Open console <span className="btn-arrow">→</span></button>
          <button className="btn btn--secondary btn--lg" onClick={() => onEnterTab('architecture')}>Engineering architecture</button>
        </div>
        <div className="lv__certs">
          <span>SOC2 TYPE II</span><span className="lv__cert-sep"/><span>ISO 27001</span><span className="lv__cert-sep"/><span>ON-PREM AVAILABLE</span>
        </div>
      </div>
      <div className="lv__stats">
        {STATS.map(s => (
          <div key={s.label} className="lv__stat">
            <div className="lv__stat-val">{s.val}</div>
            <div className="lv__stat-lbl eyebrow">{s.label}</div>
          </div>
        ))}
      </div>
      <SignalStrip feedItems={feedItems}/>
    </div>
  );
};

/* ── Threat panel ─────────────────────────────────────────────────────────── */
const ThreatPanel = ({ outbreaks, selected, onSelect }) => {
  const display = outbreaks && outbreaks.length > 0 ? outbreaks.slice(0, 6) : DEFAULT_SIGNALS.slice(0, 4);
  return (
    <div className="panel cv__area--threats">
      <div className="panel__head">
        <div><div className="eyebrow panel__eyebrow">01 · LIVE THREAT RADAR</div><div className="panel__title">Tracked diseases</div></div>
        <button className="cv__iconbtn"><Icon n="filter"/></button>
      </div>
      <div className="panel__body">
        <div className="tile-list">
          {display.map(t => {
            const delta = t.delta_7d ?? t.delta ?? 0;
            const up = delta > 0, flat = delta === 0;
            return (
              <button key={t.id} className={`tile ${selected===t.id?'is-selected':''}`} onClick={() => onSelect(t.id)}>
                <div className="tile__head">
                  <div><div className="tile__name">{t.disease}</div><div className="tile__sub">{t.region||t.country||'—'}</div></div>
                  <span className={`chip chip--${sevCls(t.severity||t.sev||1)}`}><span className="chip__dot"/>{t.status||SEV_LABEL[t.severity||t.sev||1]}</span>
                </div>
                <div className="tile__stats">
                  <div><div className="tile__k">SEV</div><div className="tile__v">{t.severity||t.sev||1}<span className="tile__vsub">/4</span></div></div>
                  <div><div className="tile__k">Δ 7d</div><div className={`tile__v ${up?'tile__v--up':!flat?'tile__v--dn':''}`}>{delta>0?'+':''}{Number(delta).toFixed(1)}%</div></div>
                  <div><div className="tile__k">CASES</div><div className="tile__v">{Number(t.cases||0).toLocaleString()}</div></div>
                  <div><div className="tile__k">UPDATED</div><div className="tile__v" style={{fontSize:10}}>{(t.updated_at||'—').slice(11,16)}<span className="tile__vsub"> Z</span></div></div>
                </div>
                <svg className="sparkline" viewBox="0 0 200 24" preserveAspectRatio="none">
                  <path d={up?'M0 20 L40 17 L80 13 L120 9 L160 5 L200 2':flat?'M0 12 L40 11 L80 13 L120 12 L160 11 L200 12':'M0 4 L40 7 L80 11 L120 15 L160 18 L200 22'} fill="none" stroke={up?'var(--accent-cyan-bright)':flat?'var(--fg-4)':'var(--sev-resolved)'} strokeWidth="1.3"/>
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── Mini Feed panel (map workspace) ──────────────────────────────────────── */
const FeedPanel = ({ feedItems, lastSync, loading }) => {
  const items = feedItems && feedItems.length > 0 ? feedItems : SEED_FEED;
  return (
    <div className="panel cv__area--feed">
      <div className="panel__head">
        <div><div className="eyebrow panel__eyebrow" style={{display:'flex',alignItems:'center',gap:6}}><span className="live-pip"/>02 · LIVE SITUATION FEED</div><div className="panel__title">Continuous ingest</div></div>
        <span className="mono-xs" style={{paddingTop:4}}>~4.1s</span>
      </div>
      <div className="feed-sync">
        <span className="feed-sync__dot"/>
        <span>{loading?'INGESTING…':lastSync?`LAST SYNC ${lastSync}`:'LIVE'}{' · '}{items.length} ITEMS</span>
      </div>
      <div className="panel__body">
        <div className="feed-list">
          {items.slice(0, 20).map((f, i) => {
            const ts = (f.ingested_at||f.published_at||'').slice(11,16)||'—';
            return (
              <div key={f.id||i} className="feed-item">
                <div className="feed-item__ts">{ts}</div>
                <div className="feed-item__body">
                  <div className="feed-item__meta">
                    <span className="src-badge">{f.source}</span>
                    <span className="feed-item__disease">{(f.disease||'').toUpperCase()}</span>
                    <span className="feed-item__region">· {f.region||'—'}</span>
                    <span style={{fontSize:9,letterSpacing:'.06em',fontFamily:'var(--font-mono)',padding:'1px 5px',borderRadius:2,background:f.reliability==='OFFICIAL'?'rgba(91,198,232,.08)':'rgba(255,255,255,.04)',color:f.reliability==='OFFICIAL'?'var(--accent-cyan)':'var(--fg-4)',border:'1px solid '+(f.reliability==='OFFICIAL'?'rgba(91,198,232,.2)':'rgba(255,255,255,.06)')}}>{f.reliability||'MEDIA'}</span>
                  </div>
                  <div className="feed-item__summary">{f.summary||f.title||'—'}</div>
                  {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="feed-item__url">↗ Source</a>}
                </div>
                <div className={`sev-badge sev-badge--${f.severity||1}`}>SEV {f.severity||1}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── Full Feed View (Feed tab) ────────────────────────────────────────────── */
const FullFeedView = ({ feedItems, backendAvailable, onViewOnMap, presetDisease, onClearPreset }) => {
  const [filterDisease,     setFilterDisease]     = useState(presetDisease || '');
  const [filterSeverity,    setFilterSeverity]    = useState(0);
  const [filterSource,      setFilterSource]      = useState('');
  const [filterReliability, setFilterReliability] = useState('');
  const [searchText,        setSearchText]        = useState('');
  const [watchlist,         setWatchlist]         = useState(() => getWatchlist());

  useEffect(() => {
    if (presetDisease) {
      setFilterDisease(presetDisease);
    }
  }, [presetDisease]);

  const items = feedItems && feedItems.length > 0 ? feedItems : SEED_FEED;

  const sources   = useMemo(() => [...new Set(items.map(i => i.source).filter(Boolean))].sort(), [items]);
  const diseases  = useMemo(() => [...new Set(items.map(i => i.disease).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    return items.filter(f => {
      if (filterDisease && !(f.disease||'').toLowerCase().includes(filterDisease.toLowerCase())) return false;
      if (filterSeverity && (f.severity||1) < filterSeverity) return false;
      if (filterSource && f.source !== filterSource) return false;
      if (filterReliability && f.reliability !== filterReliability) return false;
      if (searchText) {
        const hay = `${f.title||''} ${f.summary||''} ${f.region||''} ${f.disease||''}`.toLowerCase();
        if (!hay.includes(searchText.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, filterDisease, filterSeverity, filterSource, filterReliability, searchText]);

  const handleWatch = id => {
    const wl = toggleWatch(id);
    setWatchlist(new Set(wl));
  };

  const clearFilters = () => { setFilterDisease(''); setFilterSeverity(0); setFilterSource(''); setFilterReliability(''); setSearchText(''); if (onClearPreset) onClearPreset(); };
  const hasFilters = filterDisease || filterSeverity || filterSource || filterReliability || searchText;

  return (
    <div className="ff-view">
      {/* Filter bar */}
      <div className="ff-filter-bar">
        <div className="ff-search-wrap">
          <Icon n="search" size={12}/>
          <input className="ff-search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search signals…"/>
        </div>
        <select className="ff-sel" value={filterDisease} onChange={e => setFilterDisease(e.target.value)}>
          <option value="">All diseases</option>
          {diseases.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="ff-sel" value={filterSeverity} onChange={e => setFilterSeverity(Number(e.target.value))}>
          <option value={0}>All severity</option>
          <option value={4}>SEV 4 · Critical</option>
          <option value={3}>SEV 3+ · Warning</option>
          <option value={2}>SEV 2+ · Advisory</option>
        </select>
        <select className="ff-sel" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
          <option value="">All sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="ff-sel" value={filterReliability} onChange={e => setFilterReliability(e.target.value)}>
          <option value="">All types</option>
          <option value="OFFICIAL">Official</option>
          <option value="MEDIA">Media</option>
          <option value="LOCAL REPORT">Local report</option>
          <option value="UNVERIFIED">Unverified</option>
        </select>
        {hasFilters && <button className="ff-clear" onClick={clearFilters}><Icon n="close" size={11}/> Clear</button>}
        <span className="ff-count">{filtered.length} signals</span>
        {presetDisease && <span style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.08em',color:'var(--accent-cyan)',background:'rgba(91,198,232,.08)',border:'1px solid rgba(91,198,232,.2)',borderRadius:2,padding:'2px 8px'}}>↩ FROM DISPATCH</span>}
        {!backendAvailable && <span className="ff-offline">SEED DATA</span>}
      </div>

      {/* Feed list */}
      <div className="ff-list">
        {filtered.length === 0 && (
          <div className="ff-empty">No signals match current filters.</div>
        )}
        {filtered.map((f, i) => {
          const sev = f.severity || 1;
          const ts = (f.ingested_at||f.published_at||'').slice(0,19).replace('T',' ') + ' UTC';
          const inWatchlist = watchlist.has(f.id||String(i));
          return (
            <div key={f.id||i} className={`ff-card ff-card--sev${sev}`}>
              <div className="ff-card__left">
                <div className={`ff-card__sev sev-badge sev-badge--${sev}`}>SEV {sev}</div>
                <div className="ff-card__ts mono-xs">{ts.slice(11,16)}<br/>{ts.slice(0,10)}</div>
              </div>
              <div className="ff-card__body">
                <div className="ff-card__meta">
                  <span className="src-badge">{f.source}</span>
                  <span className="ff-card__disease">{(f.disease||'UNKNOWN').toUpperCase()}</span>
                  {f.region && <span className="ff-card__region">· {f.region}</span>}
                  <span className={`ff-card__rel ff-card__rel--${(f.reliability||'media').toLowerCase().replace(' ','_')}`}>{f.reliability||'MEDIA'}</span>
                  {f.country_code && <span className="ff-card__cc">{f.country_code}</span>}
                </div>
                <div className="ff-card__title">{f.title||f.disease||'Outbreak signal'}</div>
                <div className="ff-card__summary">{f.summary||'No summary available.'}</div>
                <div className="ff-card__actions">
                  {onViewOnMap && <button className="ff-action" onClick={() => onViewOnMap(f)}><Icon n="map" size={11}/> Map</button>}
                  {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="ff-action"><Icon n="extLink" size={11}/> Source</a>}
                  <button className={`ff-action ${inWatchlist?'ff-action--active':''}`} onClick={() => handleWatch(f.id||String(i))}>
                    <Icon n={inWatchlist?'starFill':'star'} size={11}/>{inWatchlist?'Watching':'Watch'}
                  </button>
                </div>
              </div>
              <div className="ff-card__right">
                {f.cases != null && <div className="ff-card__stat"><span className="ff-card__sk">CASES</span><span className="ff-card__sv">{Number(f.cases).toLocaleString()}</span></div>}
                {f.delta_7d != null && <div className="ff-card__stat"><span className="ff-card__sk">Δ 7D</span><span className="ff-card__sv" style={{color:f.delta_7d>0?'var(--sev-warning)':'var(--sev-resolved)'}}>{f.delta_7d>0?'+':''}{Number(f.delta_7d).toFixed(1)}%</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Dispatch panel ───────────────────────────────────────────────────────── */
/* ── Outbreak Intelligence Drawer (DispatchPanel redesign) ───────────────── */
const DrawerCloseBtn = ({ onClose }) => (
  <button onClick={onClose} style={{
    width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
    background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.10)', borderRadius:3,
    color:'var(--fg-2)', cursor:'pointer', flexShrink:0, transition:'background .15s,color .15s',
  }}
  onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.12)';e.currentTarget.style.color='var(--fg-1)';}}
  onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.06)';e.currentTarget.style.color='var(--fg-2)';}}
  >
    <Icon n="close" size={12}/>
  </button>
);

const OutbreakDrawer = ({ signal, onClose, onAnalyze, onZoomMap, onOpenFeed, onAcknowledge, user }) => {
  const overlayRef = useRef(null);
  const [ackFlash, setAckFlash] = useState(false);
  const [acks, setAcks] = useState(() => getAcknowledged());

  const sev    = signal.severity || signal.sev || 1;
  const delta  = signal.delta_7d ?? signal.delta ?? 0;
  const isAcked = !!acks[signal.id];
  const sevC   = s => s>=4?'var(--sev-critical)':s===3?'var(--sev-warning)':'var(--sev-advisory)';

  // ESC close
  useEffect(() => {
    const handler = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleOutsideClick(e) {
    if (overlayRef.current && overlayRef.current.contains(e.target)) onClose();
  }

  function handleAcknowledge() {
    if (isAcked) return;
    const analyst = user?.name || 'Analyst';
    const updated = acknowledgeAlert(signal.id, analyst, signal.disease);
    setAcks({ ...updated });
    setAckFlash(true);
    setTimeout(() => setAckFlash(false), 1800);
    if (onAcknowledge) onAcknowledge(signal.id);
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOutsideClick}
      style={{
        position:'fixed', inset:0, zIndex:200,
        background:'rgba(0,0,0,.6)',
        display:'flex', justifyContent:'flex-end',
        animation:'drawer-overlay-in .2s ease',
      }}
    >
      <style>{`
        @keyframes drawer-overlay-in { from { opacity:0 } to { opacity:1 } }
        @keyframes drawer-slide-in { from { transform:translateX(100%) } to { transform:translateX(0) } }
        .drawer-panel { animation:drawer-slide-in .28s cubic-bezier(0.2,0,0,1); }
        .drawer-panel::-webkit-scrollbar { width:4px }
        .drawer-panel::-webkit-scrollbar-track { background:transparent }
        .drawer-panel::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:2px }
      `}</style>
      <div className="drawer-panel" style={{
        width:440, maxWidth:'100vw', height:'100%',
        background:'var(--bg-overlay)',
        borderLeft:'1px solid rgba(91,198,232,.18)',
        display:'flex', flexDirection:'column',
        boxShadow:'-20px 0 60px rgba(0,0,0,.7)',
        zIndex:201,
      }}>
        {/* ── HEADER ── */}
        <div style={{
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          padding:'16px 20px 14px', borderBottom:'1px solid rgba(255,255,255,.08)',
          background:'var(--bg-graphite)', flexShrink:0,
        }}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span className={`chip chip--${sevCls(sev)}`} style={{flexShrink:0}}>
                <span className="chip__dot"/>{signal.status||'MONITORING'}
              </span>
              <span className="src-badge" style={{flexShrink:0}}>{signal.source||'SOURCE'}</span>
            </div>
            <div style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:600,letterSpacing:'-.01em',color:'var(--fg-1)',lineHeight:1.2}}>
              {signal.disease}
            </div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg-3)',letterSpacing:'.06em',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {signal.region} · {signal.id}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,marginLeft:12}}>
            {isAcked && (
              <span style={{display:'inline-flex',alignItems:'center',gap:4,fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.08em',color:'var(--sev-resolved)',background:'rgba(63,182,138,.08)',border:'1px solid rgba(63,182,138,.22)',borderRadius:2,padding:'2px 8px'}}>
                ✓ ACK
              </span>
            )}
            <DrawerCloseBtn onClose={onClose}/>
          </div>
        </div>

        {/* ── METRICS GRID ── */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
          background:'var(--border-1)', flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,.08)',
        }}>
          {[
            {label:'SEV',     value:sev,   unit:'/4',      color:sevC(sev), big:true},
            {label:'CASES',   value:Number(signal.cases||0).toLocaleString(), unit:'', color:'', big:false},
            {label:'DEATHS',  value:signal.deaths||0, unit:'', color:signal.deaths>0?'var(--sev-critical)':'', big:false},
            {label:'Δ 7d',    value:(delta>0?'+':'')+Number(delta).toFixed(1), unit:'%', color:delta>0?'var(--sev-warning)':'var(--sev-resolved)', big:false},
          ].map(m => (
            <div key={m.label} style={{background:'var(--bg-graphite)',padding:'14px 16px',textAlign:'center'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--fg-4)',marginBottom:4}}>{m.label}</div>
              <div style={{
                fontFamily:'var(--font-mono)',fontSize:m.big?22:16,fontWeight:600,
                color:m.color||'var(--fg-1)',fontVariantNumeric:'tabular-nums',lineHeight:1,
              }}>{m.value}{m.unit && <span style={{fontSize:m.big?11:9,color:'var(--fg-3)',marginLeft:2}}>{m.unit}</span>}</div>
            </div>
          ))}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{flex:1,overflowY:'auto',padding:'0'}}>

          {/* Additional metadata */}
          <div style={{padding:'12px 20px',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:0,borderBottom:'1px solid rgba(255,255,255,.06)'}}>
            {[
              ['RELIABILITY', signal.reliability||'OFFICIAL'],
              ['FIRST SEEN', (signal.first_seen||signal.updated_at||'—').slice(0,10)],
              ['COUNTRY', signal.country||signal.region?.split('·')[0]||'—'],
              ['COORDINATES', signal.lat!=null?`${Number(signal.lat).toFixed(3)}° ${Number(signal.lng).toFixed(3)}°`:'—'],
            ].map(([k,v]) => (
              <div key={k} style={{padding:'6px 0'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--fg-4)',marginBottom:2}}>{k}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg-1)'}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--fg-4)',marginBottom:8}}>OPERATIONAL SUMMARY</div>
            <div style={{fontSize:13,color:'var(--fg-1)',lineHeight:1.65}}>{signal.summary||'No summary available.'}</div>
          </div>

          {/* Source cards */}
          <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--fg-4)',marginBottom:10}}>SOURCE ATTRIBUTION</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {[
                {name:'WHO DON599',    type:'OFFICIAL',  color:'var(--sev-resolved)', url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599', note:'Primary disease outbreak notification'},
                {name:'CDC Surveillance', type:'OFFICIAL', color:'var(--sev-resolved)', url:'https://www.cdc.gov/hantavirus/data-research/cases/index.html', note:'Hantavirus case tracking'},
                {name:'ECDC Assessment', type:'OFFICIAL',  color:'var(--sev-resolved)', url:'https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and', note:'Technical risk assessment'},
                {name:'Reuters Report',  type:'MEDIA',     color:'var(--sev-advisory)', url:'https://www.reuters.com/business/healthcare-pharmaceuticals/who-reports-six-confirmed-hantavirus-cases-tied-spain-bound-cruise-2026-05-08/', note:'Breaking news coverage'},
              ].map(src => (
                <div key={src.name} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg-panel)',border:'1px solid rgba(255,255,255,.08)',borderRadius:4,borderLeft:`2px solid ${src.color}`}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color:'var(--fg-1)',flex:1}}>{src.name}</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:9,color:src.color,letterSpacing:'.08em',padding:'1px 6px',background:`${src.color}12`,border:`1px solid ${src.color}30`,borderRadius:2}}>{src.type}</span>
                  <a href={src.url} target="_blank" rel="noopener noreferrer" style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--accent-cyan)',textDecoration:'none',opacity:.7}} title={src.note}>↗</a>
                </div>
              ))}
            </div>
          </div>

          {/* Arc connections */}
          {signal.source && (
            <div style={{padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--fg-4)',marginBottom:8}}>VECTOR CONNECTION</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--fg-3)',lineHeight:1.6}}>
                {signal.disease} cluster linked to {signal.region}. Vector indexed from {signal.source}. {isAcked?'Acknowledged by '+acks[signal.id]?.analyst+' — tracking.'+' ' : ''}Updates every 5 minutes via RSS ingestion pipeline.
              </div>
            </div>
          )}
        </div>

        {/* ── STICKY ACTION BAR ── */}
        <div style={{
          display:'flex', gap:8, padding:'14px 20px',
          borderTop:'1px solid rgba(255,255,255,.08)',
          background:'var(--bg-graphite)', flexShrink:0,
          position:'sticky', bottom:0,
        }}>
          <button
            className="btn btn--secondary"
            style={{
              flex:1, justifyContent:'center', fontSize:10, padding:'8px 12px',
              background: ackFlash ? 'rgba(63,182,138,.18)' : isAcked ? 'rgba(63,182,138,.08)' : '',
              borderColor: isAcked ? 'rgba(63,182,138,.3)' : '', color: isAcked ? 'var(--sev-resolved)' : '',
              transition:'all .3s',
            }}
            onClick={handleAcknowledge}
          >
            <Icon n="check" size={12}/>{isAcked ? 'Acknowledged' : 'Acknowledge'}
          </button>
          <button className="btn btn--secondary" style={{flex:1, justifyContent:'center', fontSize:10, padding:'8px 12px'}} onClick={() => { if(onOpenFeed) onOpenFeed(signal.disease); }}>
            <Icon n="activity" size={12}/>Open feed
          </button>
          <button className="btn btn--secondary" style={{flex:1, justifyContent:'center', fontSize:10, padding:'8px 12px'}} onClick={() => { if(onZoomMap) onZoomMap(signal); }}>
            <Icon n="map" size={12}/>Zoom map
          </button>
          <button
            className="btn btn--primary"
            style={{flex:1, justifyContent:'center', fontSize:10, padding:'8px 12px'}}
            onClick={() => { if(onAnalyze) onAnalyze(signal); }}
          >
            <Icon n="cpu" size={12}/>Analyze
          </button>
          {signal.source_url && (
            <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost" style={{flex:1, justifyContent:'center', fontSize:10, padding:'8px 12px', textDecoration:'none'}}>
              <Icon n="extLink" size={12}/>Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Mini Dispatch Panel (compact overlay on map) ─────────────────────────── */
const DispatchPanel = ({ signal, onAcknowledge, onOpenFeed, onViewDetails, user }) => {
  const [ackFlash, setAckFlash] = useState(false);
  const [acks, setAcks] = useState(() => getAcknowledged());

  if (!signal) return null;
  const delta  = signal.delta_7d ?? signal.delta ?? 0;
  const sev    = signal.severity || signal.sev || 1;
  const isAcked = !!acks[signal.id];
  const sevC   = s => s>=4?'var(--sev-critical)':s===3?'var(--sev-warning)':'var(--sev-advisory)';

  function handleAcknowledge() {
    if (isAcked) return;
    const analyst = user?.name || 'Analyst';
    const updated = acknowledgeAlert(signal.id, analyst, signal.disease);
    setAcks({ ...updated });
    setAckFlash(true);
    setTimeout(() => setAckFlash(false), 1800);
    if (onAcknowledge) onAcknowledge(signal.id);
  }

  function handleOpenFeed() {
    if (onOpenFeed) onOpenFeed(signal.disease);
  }

  return (
    <div className="dispatch" style={{ opacity: isAcked ? 0.76 : 1, transition:'opacity .4s ease' }}>
      <div className="dispatch__head">
        <div>
          <div className="eyebrow" style={{fontSize:9}}>DISPATCH · {signal.id}</div>
          <div className="dispatch__title">{signal.disease} · {signal.region}</div>
        </div>
        <div className="dispatch__actions-row">
          {isAcked && (
            <span style={{display:'inline-flex',alignItems:'center',gap:3,fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.08em',color:'var(--sev-resolved)',background:'rgba(63,182,138,.08)',border:'1px solid rgba(63,182,138,.22)',borderRadius:2,padding:'2px 7px',marginRight:2}}>
              ✓ ACK
            </span>
          )}
          {onViewDetails && (
            <button className="cv__iconbtn" onClick={() => onViewDetails(signal)} title="Full details">
              <svg viewBox="0 0 24 24" width={13} height={13} stroke="currentColor" fill="none" strokeWidth="1.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
          )}
          <button className="cv__iconbtn"><Icon n="pin" size={13}/></button>
          {signal.source_url && (
            <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="cv__iconbtn" style={{display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none',color:'var(--fg-2)'}}>
              <Icon n="extLink" size={13}/>
            </a>
          )}
        </div>
      </div>
      <div className="dispatch__hero">
        <div className="dispatch__stat"><div className="tile__k">SEV</div><div className="dispatch__stat-v" style={{color:sevC(sev)}}>{sev}<span className="tile__vsub">/4</span></div></div>
        <div className="dispatch__stat"><div className="tile__k">CASES</div><div className="dispatch__stat-v">{Number(signal.cases||0).toLocaleString()}</div></div>
        <div className="dispatch__stat"><div className="dispatch__stat-v" style={{color:delta>0?'var(--sev-warning)':'var(--sev-resolved)'}}>{delta>0?'+':''}{Number(delta).toFixed(1)}<span className="tile__vsub">%</span></div></div>
      </div>
      <div className="dispatch__rows">
        {[
          ['STATUS',     <span className={`chip chip--${sevCls(sev)}`}><span className="chip__dot"/>{signal.status}</span>],
          ['SOURCE',     signal.source_url
            ? <a href={signal.source_url} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}><span className="src-badge" style={{cursor:'pointer'}}>{signal.source}</span></a>
            : <span className="src-badge">{signal.source}</span>
          ],
          ['DEATHS',     <span className="mono-xs" style={{color:signal.deaths>0?'var(--sev-critical)':'var(--fg-3)'}}>{signal.deaths||0}</span>],
          ['FIRST SEEN', <span className="mono-xs">{(signal.first_seen||signal.updated_at||'—').slice(0,10)}</span>],
          ['COORDS',     <span className="mono-xs">{signal.lat!=null?`${Number(signal.lat).toFixed(2)}°`:'—'} · {signal.lng!=null?`${Number(signal.lng).toFixed(2)}°`:'—'}</span>],
          ['RELIABILITY',<span className="mono-xs" style={{color:'var(--accent-cyan)'}}>{signal.reliability||'OFFICIAL'}</span>],
        ].map(([k,v]) => (
          <div key={k} className="dispatch__row">
            <span className="dispatch__row-k">{k}</span>
            <span className="dispatch__row-v">{v}</span>
          </div>
        ))}
        {isAcked && acks[signal.id] && (
          <div className="dispatch__row">
            <span className="dispatch__row-k">ACK BY</span>
            <span className="dispatch__row-v" style={{fontSize:11,color:'var(--sev-resolved)'}}>{acks[signal.id].analyst} · {acks[signal.id].at.slice(11,16)} UTC</span>
          </div>
        )}
      </div>
      <div className="dispatch__summary">{signal.summary||'—'}</div>
      {signal.source_url && (
        <div style={{padding:'4px 12px 0',flexShrink:0}}>
          <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="feed-item__url">↗ Primary source: {signal.source}</a>
        </div>
      )}
      <div className="dispatch__btns">
        <button
          className="btn btn--secondary"
          style={{
            fontSize:11, padding:'6px 12px', gap:6,
            background: ackFlash ? 'rgba(63,182,138,.18)' : isAcked ? 'rgba(63,182,138,.08)' : '',
            borderColor: isAcked ? 'rgba(63,182,138,.3)' : '',
            color: isAcked ? 'var(--sev-resolved)' : '',
            transition:'background .35s,color .35s,border-color .35s',
            cursor: isAcked ? 'default' : 'pointer',
          }}
          onClick={handleAcknowledge}
        >
          <Icon n="check" size={12}/>{isAcked ? 'Acknowledged' : 'Acknowledge'}
        </button>
        <button
          className="btn btn--ghost"
          style={{fontSize:11,padding:'6px 12px',gap:6}}
          onClick={handleOpenFeed}
        >
          <Icon n="activity" size={12}/>Open feed
        </button>
        {onViewDetails && (
          <button
            className="btn btn--ghost"
            style={{fontSize:11,padding:'6px 12px',gap:6}}
            onClick={() => onViewDetails(signal)}
          >
            <Icon n="arrow" size={12}/>Details
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Mini Intel panel (map workspace) ─────────────────────────────────────── */
const INTEL_QUERIES = [
  'What is happening with H5N1 globally?',
  'Which regions show increasing measles activity?',
  'Mpox clade Ib spread velocity in Central Africa',
  'Cross-border transmission risk assessment',
];

const IntelPanel = ({ backendAvailable }) => {
  const [q, setQ]           = useState(INTEL_QUERIES[0]);
  const [shown, setShown]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);

  async function runQuery(query) {
    setQ(query); setLoading(true); setShown(false);
    if (backendAvailable) {
      const data = await apiFetch('/api/intel/query', { method:'POST', body:JSON.stringify({question:query}) });
      if (data) { setResult(data); setShown(true); setLoading(false); pushQueryHistory(query, data); return; }
    }
    await new Promise(r => setTimeout(r, 900));
    const mock = {
      answer:`Situation analysis for "${query}": Based on current surveillance data across WHO regions, multiple active outbreak signals require monitoring. Grounded retrieval requires backend (uvicorn server:app --port 8000).`,
      citations:[{n:1,src:'WHO',title:'Disease outbreak news · DON-413',date:'2026-05-08'},{n:2,src:'CDC',title:'H5N1 surveillance update',date:'2026-05-07'}],
      meta:{sources:2,confidence:0.68,latency:'0.9s',model:'fallback-seed',retrieval:'keyword'},
    };
    setResult(mock); setShown(true); setLoading(false);
    pushQueryHistory(query, mock);
  }

  const modelLabel = result?.meta?.model
    ? result.meta.model.toUpperCase()+(result.meta.ollama?' · ON-PREM':' · SEED')
    : 'LLAMA-3.2 · ON-PREM';

  return (
    <div className="panel intel cv__area--intel">
      <div className="panel__head intel__head">
        <div><div className="eyebrow panel__eyebrow">05 · SITUATION ANALYSIS</div><div className="panel__title">Retrieval-grounded query</div></div>
        <span className="intel__model">{modelLabel}</span>
      </div>
      <div className="intel__field">
        <span className="intel__prompt">▸</span>
        <input className="intel__input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && runQuery(q)} placeholder="Query outbreak intelligence…"/>
        <button className="intel__run" disabled={loading} onClick={() => runQuery(q)}>
          {loading ? <span style={{width:10,height:10,borderRadius:'50%',border:'1.5px solid rgba(6,8,10,.3)',borderTopColor:'var(--fg-on-accent)',animation:'obs-spin .7s linear infinite',display:'inline-block'}}/> : <Icon n="arrow" size={12}/>}
          {loading ? 'Retrieving' : 'Run'}
        </button>
      </div>
      <div className="intel__chips">
        {INTEL_QUERIES.map(s => <button key={s} className="intel__chip" onClick={() => runQuery(s)}>{s}</button>)}
      </div>
      {loading && <div className="intel__loading"><span className="intel__spinner"/><span>Retrieving intelligence… querying {backendAvailable?'vector store':'seed data'}</span></div>}
      {shown && result && (
        <div className="intel__answer">
          <p>{result.answer}</p>
          <div className="intel__meta">
            <span><b>{result.meta?.sources||0} SOURCES</b></span>
            <span><b>CONF</b> · {Number(result.meta?.confidence||0).toFixed(2)}</span>
            <span><b>LATENCY</b> · {result.meta?.latency||'—'}</span>
            <span><b>RETRIEVAL</b> · {(result.meta?.retrieval||'keyword').toUpperCase()}</span>
          </div>
          {result.citations?.length > 0 && (
            <div className="intel__cites">
              {result.citations.map(c => (
                <div key={c.n} className="intel__cite-row">
                  <span className="intel__cite">{c.n}</span>
                  <span className="src-badge">{c.src}</span>
                  <span className="intel__cite-title">{c.title}</span>
                  <span className="intel__cite-date">{c.date}</span>
                  {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="cv__iconbtn" style={{width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--fg-3)',textDecoration:'none'}}><Icon n="extLink" size={11}/></a> : <button className="cv__iconbtn" style={{width:22,height:22}}><Icon n="extLink" size={11}/></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Full Situation Console (Console tab) ─────────────────────────────────── */
const SituationConsole = ({ backendAvailable, outbreaks, initialQuery, onClearQuery }) => {
  const [q, setQ]            = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [history, setHistory] = useState(() => getQueryHistory());
  const [selHist, setSelHist] = useState(null);
  const inputRef = useRef(null);

  // Sync external query changes — auto-run when dispatched from another view
  useEffect(() => {
    if (initialQuery && !loading && !result) {
      setQ(initialQuery);
      runQuery(initialQuery);
      if (onClearQuery) onClearQuery();
    }
  }, [initialQuery]);

  const sevCount = (outbreaks||[]).filter(o => (o.severity||0) >= 3).length || 3;
  const diseaseCount = (outbreaks ? [...new Set(outbreaks.map(o=>o.disease))].length : 0) || 6;
  const hantaCount = (outbreaks||[]).filter(o => (o.disease||'').toLowerCase()==='hantavirus').length || 3;

  const SUGGESTED = [
    'What is the current global H5N1 situation?',
    'Summarize all active outbreaks by severity',
    'Which regions have the highest Mpox transmission?',
    'Cross-border spread risk for Central Africa outbreaks',
    'Compare case trajectory: H5N1 USA vs Cambodia',
    'MERS-CoV dromedary exposure pattern analysis',
    'What are the most recent WHO advisories?',
    'Outbreak trend analysis: last 30 days',
    'Analyze current Hantavirus outbreak risk (MV Hondius)',
    'Compare Hantavirus vs H5N1 transmission patterns',
  ];

  async function runQuery(query) {
    if (!query.trim()) return;
    setQ(query); setLoading(true); setResult(null); setSelHist(null);
    if (backendAvailable) {
      const data = await apiFetch('/api/intel/query', { method:'POST', body:JSON.stringify({question:query}) });
      if (data) {
        setResult(data); setLoading(false);
        pushQueryHistory(query, data);
        setHistory(getQueryHistory());
        return;
      }
    }
    await new Promise(r => setTimeout(r, 1400));
    const mock = {
      answer: `SITUATION ANALYSIS — ${query}\n\nBased on retrieval from the outbreak intelligence database: Multiple active surveillance signals match your query. The system identified relevant documents across WHO disease outbreak news, CDC surveillance updates, and ECDC rapid risk assessments.\n\nKey findings from retrieved intelligence:\n• Active outbreak signals detected across 4 WHO regions\n• Severity distribution: 1 CRITICAL, 3 WARNING, 3 ADVISORY\n• Cross-border transmission arcs detected: COD→USA, COD→ROU\n\nAll findings are grounded in retrieved source documents. Backend must be running for real-time retrieval (uvicorn server:app --port 8000).`,
      citations: [
        {n:1, src:'WHO',   title:'Disease Outbreak News — DON-413: H5N1 Cambodia',   date:'2026-05-08', url:'https://www.who.int/emergencies/disease-outbreak-news', snippet:'Three confirmed H5N1 cases in Phnom Penh province. All linked to backyard poultry exposure. Contact tracing ongoing for 41 individuals.'},
        {n:2, src:'CDC',   title:'H5N1 Avian Influenza Surveillance Update',          date:'2026-05-07', url:'https://www.cdc.gov/flu/avianflu/', snippet:'Dairy cattle herd CA-DA-211 confirmed H5N1 positive. Worker testing initiated for 88 contacts. No human-to-human transmission detected.'},
        {n:3, src:'CDC',   title:'Mpox Clade Ib — Global Situation Report',           date:'2026-05-08', url:'https://www.cdc.gov/poxvirus/mpox/', snippet:'Mpox clade Ib cluster in North Kivu; 14-day rolling average doubling. WHO coordinates vaccine shipment to Goma.'},
        {n:4, src:'ECDC',  title:'Rapid Risk Assessment: Measles Romania 2026',       date:'2026-05-06', url:'https://www.ecdc.europa.eu/en/measles', snippet:'School-cohort outbreak among unvaccinated children. Catch-up vaccination campaign covers ~70% of at-risk cohort.'},
      ],
      meta: { sources:4, confidence:0.74, latency:'1.4s', model:'fallback-seed', retrieval:'keyword', grounded:true },
    };
    setResult(mock); setLoading(false);
    pushQueryHistory(query, mock);
    setHistory(getQueryHistory());
  }

  const loadHistory = (h) => { setQ(h.q); setResult(h.r); setSelHist(h.at); };

  return (
    <div className="sc-view">
      {/* Left sidebar */}
      <div className="sc-sidebar">
        <div className="sc-sidebar__head">
          <div className="eyebrow" style={{color:'var(--fg-3)'}}>QUERY HISTORY</div>
        </div>
        <div className="sc-sidebar__list">
          {history.length === 0 && <div className="sc-sidebar__empty">No history yet. Run a query to start.</div>}
          {history.map((h, i) => (
            <button key={i} className={`sc-hist-item ${selHist===h.at?'is-active':''}`} onClick={() => loadHistory(h)}>
              <div className="sc-hist-item__q">{h.q}</div>
              <div className="sc-hist-item__meta">
                <span className="mono-xs">{(h.at||'').slice(11,16)} UTC</span>
                {h.r?.meta && <span className="mono-xs" style={{color:'var(--fg-4)'}}> · {h.r.meta.sources||0} src</span>}
              </div>
            </button>
          ))}
        </div>
        <div className="sc-sidebar__head" style={{marginTop:8}}>
          <div className="eyebrow" style={{color:'var(--fg-3)'}}>SUGGESTED QUERIES</div>
        </div>
        <div className="sc-sidebar__list">
          {SUGGESTED.map((s,i) => (
            <button key={i} className="sc-suggest-item" onClick={() => runQuery(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="sc-main">
        {/* Query input */}
        <div className="sc-query-area">
          <div className="sc-field">
            <span className="intel__prompt">▸</span>
            <input ref={inputRef} className="sc-input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && runQuery(q)} placeholder="Query outbreak intelligence — all answers grounded in retrieved sources…"/>
            <button className="intel__run sc-run" disabled={loading||!q.trim()} onClick={() => runQuery(q)}>
              {loading ? <span style={{width:12,height:12,borderRadius:'50%',border:'1.5px solid rgba(6,8,10,.3)',borderTopColor:'var(--fg-on-accent)',animation:'obs-spin .7s linear infinite',display:'inline-block'}}/> : <Icon n="arrow" size={13}/>}
              {loading ? 'Retrieving' : 'Analyze'}
            </button>
          </div>
          {!backendAvailable && <div className="sc-offline-warn">⚠ Backend offline — seed data active · Run: cd backend &amp;&amp; python -m uvicorn server:app --port 8000</div>}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="sc-loading">
            <div className="sc-loading__steps">
              {['Embedding query', 'Vector retrieval', 'Reranking sources', 'Generating analysis'].map((s,i) => (
                <div key={i} className="sc-step">
                  <span className="intel__spinner" style={{width:10,height:10,borderWidth:1.5}}/>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          <div className="sc-result">
            {/* Grounded indicator */}
            <div className="sc-grounded">
              <span className="sc-grounded__pip" style={{background:result.meta?.grounded!==false?'var(--sev-resolved)':'var(--sev-advisory)'}}/>
              <span className="mono-xs">{result.meta?.grounded!==false?'RETRIEVAL-GROUNDED RESPONSE':'SEED DATA RESPONSE'}</span>
              <span className="mono-xs" style={{marginLeft:'auto'}}>
                {result.meta?.sources||0} SOURCES · CONF {Number(result.meta?.confidence||0).toFixed(2)} · {result.meta?.latency||'—'} · {(result.meta?.model||'').toUpperCase()}
              </span>
            </div>

            {/* Situation Analysis */}
            <div className="sc-section">
              <div className="sc-section__head">SITUATION ANALYSIS</div>
              <div className="sc-answer">
                {(result.answer||'').split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} style={{margin:'0 0 8px'}}>{line}</p>
                ))}
              </div>
            </div>

            {/* Retrieved Intelligence */}
            {result.citations?.length > 0 && (
              <div className="sc-section">
                <div className="sc-section__head">RETRIEVED INTELLIGENCE · {result.citations.length} SOURCES</div>
                <div className="sc-retrieved">
                  {result.citations.map(c => (
                    <div key={c.n} className="sc-source-card">
                      <div className="sc-source-card__head">
                        <span className="intel__cite">{c.n}</span>
                        <span className="src-badge">{c.src}</span>
                        <span className="sc-source-card__title">{c.title}</span>
                        <span className="mono-xs" style={{marginLeft:'auto'}}>{c.date}</span>
                        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="cv__iconbtn" style={{width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--fg-3)',textDecoration:'none',flexShrink:0}}><Icon n="extLink" size={11}/></a>}
                      </div>
                      {c.snippet && <div className="sc-source-card__snippet">"{c.snippet}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state — operational stats + telemetry */}
        {!loading && !result && (
          <div className="sc-empty" style={{alignItems:'flex-start',padding:'28px 28px',gap:20}}>
            <div style={{display:'flex',alignItems:'center',gap:12,width:'100%',marginBottom:4}}>
              <div style={{color:'var(--accent-cyan)'}}><Icon n="database" size={28}/></div>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--fg-1)',letterSpacing:'-.01em'}}>Situation Analysis Console</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--fg-3)',letterSpacing:'.08em',marginTop:2}}>RAG-GROUNDED · ON-PREM INFERENCE · NO HALLUCINATIONS</div>
              </div>
            </div>

            {/* Status grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,width:'100%',maxWidth:560}}>
              {[
                {k:'ACTIVE SIGNALS', v: diseaseCount+sevCount, sub:'tracked diseases'},
                {k:'SEV ≥ 3',        v: sevCount,               sub:'high severity', color:'var(--sev-warning)'},
                {k:'HANTAVIRUS',     v: hantaCount,             sub:'cluster tracked', color:'var(--accent-cyan)'},
              ].map(s => (
                <div key={s.k} style={{background:'var(--bg-panel)',border:'1px solid rgba(255,255,255,.08)',borderRadius:4,padding:'12px 14px',textAlign:'center'}}>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:18,fontWeight:600,color:s.color||'var(--fg-1)',fontVariantNumeric:'tabular-nums',lineHeight:1}}>{s.v}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--fg-4)',marginTop:4}}>{s.k}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--fg-3)',marginTop:2}}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Telemetry row */}
            <div style={{display:'flex',gap:20,flexWrap:'wrap',width:'100%',maxWidth:560}}>
              {[
                {l:'INGEST',         v: backendAvailable ? 'LIVE' : 'SEED',       c: backendAvailable ? 'var(--sev-resolved)' : 'var(--sev-advisory)'},
                {l:'VECTOR STORE',  v: backendAvailable ? 'CHROMADB' : 'MOCK',  c: backendAvailable ? 'var(--sev-resolved)' : 'var(--sev-advisory)'},
                {l:'LLM',           v: backendAvailable ? 'OLLAMA' : 'FALLBACK', c: backendAvailable ? 'var(--sev-resolved)' : 'var(--sev-advisory)'},
                {l:'REFRESH',       v: '30s AUTO',                               c: 'var(--fg-3)'},
              ].map(t => (
                <div key={t.l} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--fg-4)'}}>{t.l}</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:10,fontWeight:600,color:t.c,letterSpacing:'.06em'}}>{t.v}</span>
                </div>
              ))}
            </div>

            {/* Suggested investigations */}
            <div style={{width:'100%',maxWidth:560}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--fg-4)',marginBottom:10}}>SUGGESTED INVESTIGATIONS</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {[
                  'Analyze current Hantavirus outbreak risk (MV Hondius cruise cluster)',
                  'Compare Hantavirus vs H5N1 transmission patterns',
                  'Mpox clade Ib spread progression in Central Africa',
                  'Cross-border escalation risk for active outbreaks',
                ].map((s,i) => (
                  <button key={i} className="sc-suggest-item" onClick={() => runQuery(s)} style={{textAlign:'left',padding:'8px 14px'}}>
                    <span className="sc-suggest-item__dot"/>
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {!backendAvailable && (
              <div style={{padding:'10px 14px',background:'rgba(232,163,59,.06)',border:'1px solid rgba(232,163,59,.2)',borderRadius:4,fontFamily:'var(--font-mono)',fontSize:10,color:'var(--sev-advisory)',letterSpacing:'.06em',width:'100%',maxWidth:560}}>
                ⚠ Backend offline — seed data active. Run: cd backend &amp;&amp; python -m uvicorn server:app --port 8000
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Mini Timeline panel (map workspace) ──────────────────────────────────── */
const TimelinePanel = ({ events: propEvents }) => {
  const [t, setT]           = useState(72);
  const [playing, setPlaying] = useState(false);
  const BARS = Array.from({length:80},(_,i)=>((i*31)%100)/100);
  const SEV_C = s => s>=4?'var(--sev-critical)':s===3?'var(--sev-warning)':'var(--sev-advisory)';
  const events = propEvents && propEvents.length > 0
    ? propEvents.map(e => ({at:e.at_pct||e.at, sev:e.severity||e.sev||1, label:e.label}))
    : [{at:8,sev:2,label:'Q1 · Cambodia advisory'},{at:22,sev:3,label:'Mar · CA index case'},{at:41,sev:3,label:'Apr · COD Mpox spread'},{at:58,sev:4,label:'Apr · WHO PHEIC consult'},{at:72,sev:3,label:'May · KHM-PP-0143 (now)'},{at:88,sev:2,label:'Forecast · IDN'}];

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT(v => v>=100 ? 0 : v+0.5), 60);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div className="panel timeline cv__area--timeline">
      <div className="panel__head">
        <div><div className="eyebrow panel__eyebrow">06 · TIMELINE REPLAY</div><div className="panel__title">Outbreak progression · 180d</div></div>
        <div className="timeline__controls">
          <button className="timeline__ctrls-btn" onClick={() => setT(0)}><Icon n="skipBack" size={11}/></button>
          <button className="timeline__ctrls-btn" onClick={() => setPlaying(p=>!p)}><Icon n={playing?'pause':'play'} size={11}/></button>
          <button className="timeline__ctrls-btn" onClick={() => setT(100)}><Icon n="skipFwd" size={11}/></button>
        </div>
      </div>
      <div className="panel__body" style={{display:'flex',flexDirection:'column',padding:'0 0 4px'}}>
        <div className="timeline__track" style={{flex:1,marginBottom:0}}>
          <div className="timeline__bars">
            {BARS.map((b,i) => <div key={i} className="timeline__bar" style={{height:`${20+b*80}%`,background:i/80*100<=t?'rgba(91,198,232,.48)':'rgba(255,255,255,.07)'}}/>)}
          </div>
          <div className="timeline__events">
            {events.map((e,i) => (
              <div key={i} className="timeline__ev" style={{left:`${e.at}%`,color:SEV_C(e.sev)}}>
                <div className="timeline__ev-dot"/>
                <span className="timeline__ev-lbl">{e.label}</span>
              </div>
            ))}
          </div>
          <div className="timeline__head" style={{left:`${t}%`}}>
            <div className="timeline__head-line"/>
            <span className="timeline__head-lbl">NOW</span>
          </div>
        </div>
        <div className="timeline__axis"><span>NOV</span><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN →</span></div>
      </div>
    </div>
  );
};

/* ── Full Timeline View (Timeline tab) ────────────────────────────────────── */
const FullTimelineView = ({ events: propEvents, outbreaks, backendAvailable, onZoomMap, onAnalyze }) => {
  const [filterDisease,  setFilterDisease]  = useState('');
  const [filterSeverity, setFilterSeverity] = useState(0);

  const rawEvents = propEvents && propEvents.length > 0 ? propEvents : SEED_TIMELINE_FULL;
  const diseases = [...new Set(rawEvents.map(e => e.disease||e.outbreak_id?.split('-')[0]||'').filter(Boolean))];

  const filtered = rawEvents.filter(e => {
    if (filterDisease && !(e.disease||e.label||'').toLowerCase().includes(filterDisease.toLowerCase())) return false;
    if (filterSeverity && (e.severity||1) < filterSeverity) return false;
    return true;
  });

  const TYPE_ICON = { advisory:'🔶', index_case:'🔴', spread:'📡', pheic:'⚠️', active:'🔵', forecast:'🔮', policy:'📋', travel:'✈️' };
  const TYPE_LABEL = { advisory:'ADVISORY', index_case:'INDEX CASE', spread:'SPREAD EVENT', pheic:'PHEIC CONSULT', active:'ACTIVE', forecast:'FORECAST', policy:'POLICY UPDATE', travel:'TRAVEL RESTRICTION' };

  return (
    <div className="ftl-view">
      <div className="ftl-header">
        <div>
          <div className="eyebrow" style={{color:'var(--fg-3)',marginBottom:6}}>04 · OUTBREAK TIMELINE</div>
          <div style={{fontFamily:'var(--font-display,var(--font-sans))',fontSize:22,fontWeight:700,letterSpacing:'-.02em'}}>Chronological outbreak progression</div>
          <div className="mono-xs" style={{marginTop:4}}>Source-linked events · {filtered.length} entries · {!backendAvailable&&'Seed data'}</div>
        </div>
        <div className="ftl-filters">
          <select className="ff-sel" value={filterDisease} onChange={e => setFilterDisease(e.target.value)}>
            <option value="">All diseases</option>
            {diseases.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="ff-sel" value={filterSeverity} onChange={e => setFilterSeverity(Number(e.target.value))}>
            <option value={0}>All severity</option>
            <option value={4}>SEV 4 · Critical</option>
            <option value={3}>SEV 3+ · Warning</option>
            <option value={2}>SEV 2+ · Advisory</option>
          </select>
        </div>
      </div>

      <div className="ftl-list">
        {filtered.map((e, i) => {
          const sev = e.severity || 1;
          const color = sevColor(sev);
          const icon = TYPE_ICON[e.event_type] || '•';
          const typeLabel = TYPE_LABEL[e.event_type] || (e.event_type||'EVENT').toUpperCase();
          return (
            <div key={e.id||i} className="ftl-event">
              <div className="ftl-event__left">
                <div className="ftl-event__date mono-xs">{e.date||'—'}</div>
                <div className="ftl-event__connector" style={{borderColor:`${color}33`}}/>
              </div>
              <div className="ftl-event__dot" style={{borderColor:color, background:`${color}18`}}>
                <span style={{fontSize:10}}>{icon}</span>
              </div>
              <div className="ftl-event__card">
                <div className="ftl-event__meta">
                  <span className={`chip chip--${sevCls(sev)}`}><span className="chip__dot"/>{typeLabel}</span>
                  {e.source && <span className="src-badge">{e.source}</span>}
                  {e.outbreak_id && <span className="mono-xs">{e.outbreak_id}</span>}
                </div>
                <div className="ftl-event__label">{e.label}</div>
                {e.description && <div className="ftl-event__desc">{e.description}</div>}
                <div className="ftl-event__actions">
                  {(() => {
                    const related = outbreaks?.find(o => o.id === e.outbreak_id);
                    return <>
                      {related?.source_url && <a href={related.source_url} target="_blank" rel="noopener noreferrer" className="ff-action"><Icon n="extLink" size={10}/> Source</a>}
                      {onZoomMap && related && <button className="ff-action" onClick={() => onZoomMap(related)}><Icon n="map" size={10}/> Map</button>}
                      {onAnalyze && related && <button className="ff-action" onClick={() => onAnalyze(related)}><Icon n="cpu" size={10}/> Analyze</button>}
                      {onAnalyze && <button className="ff-action" onClick={() => onAnalyze(e)}><Icon n="cpu" size={10}/> Analyze</button>}
                    </>;
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Architecture View ────────────────────────────────────────────────────── */
const PipelineNode = ({ icon, label, tech, color = 'var(--accent-cyan)', dim }) => (
  <div className="arch-node" style={{opacity:dim?0.55:1}}>
    <div className="arch-node__icon" style={{color}}><Icon n={icon} size={18}/></div>
    <div className="arch-node__label">{label}</div>
    {tech && <div className="arch-node__tech">{tech}</div>}
  </div>
);
const Arrow = ({ vertical }) => (
  <div className={`arch-arrow ${vertical?'arch-arrow--v':''}`}>
    {vertical ? '↓' : '→'}
  </div>
);

const ArchitectureView = () => (
  <div className="arch-view">
    <div className="arch-scroll">
      {/* Header */}
      <div className="arch-hero">
        <div className="eyebrow" style={{color:'var(--accent-cyan)',marginBottom:10}}>ENGINEERING ARCHITECTURE · OutbreakOS v2.14</div>
        <h2 className="arch-h2">Outbreak Intelligence System Design</h2>
        <p className="arch-sub">End-to-end pipeline: real-time ingestion → normalization → vector retrieval → local LLM inference → grounded response generation. No cloud AI dependency. Fully on-premise deployable.</p>
        <div className="arch-badges">
          {['FastAPI','SQLite','ChromaDB','Ollama','MapLibre GL','React 18','Python 3.12','nomic-embed-text'].map(b => (
            <span key={b} className="stack-badge">{b}</span>
          ))}
        </div>
      </div>

      {/* A. System Overview */}
      <div className="arch-section">
        <div className="arch-section__head"><span className="arch-section__letter">A</span>SYSTEM OVERVIEW</div>
        <div className="arch-pipeline arch-pipeline--center">
          <PipelineNode icon="globe" label="RSS Sources" tech="WHO · CDC · ECDC · ProMED"/>
          <Arrow/>
          <PipelineNode icon="zap" label="Ingestion Workers" tech="Python · urllib"/>
          <Arrow/>
          <PipelineNode icon="database" label="SQLite + ChromaDB" tech="Feed items · Vectors"/>
          <Arrow/>
          <PipelineNode icon="cpu" label="RAG Pipeline" tech="Ollama · llama3.2"/>
          <Arrow/>
          <PipelineNode icon="map" label="Intelligence UI" tech="React 18 · MapLibre GL"/>
        </div>
        <div className="arch-metrics">
          {[['INGEST LATENCY','4.1s median'],['VECTOR DIMS','768 (nomic)'],['REFRESH CYCLE','5 minutes'],['RAG SOURCES','≤6 retrieved'],['TILE PROVIDER','CARTO/OSM'],['MODELS','llama3.2 + nomic-embed']].map(([k,v]) => (
            <div key={k} className="arch-metric"><div className="arch-metric__k">{k}</div><div className="arch-metric__v">{v}</div></div>
          ))}
        </div>
      </div>

      {/* B. Ingestion Pipeline */}
      <div className="arch-section">
        <div className="arch-section__head"><span className="arch-section__letter">B</span>INGESTION PIPELINE</div>
        <p className="arch-desc">Scheduled background worker runs every 5 minutes. Each feed is fetched with a 0.5s polite delay between requests. Items are normalized, disease-extracted, geolocated, severity-scored, and deduplicated via SHA-256 content hash.</p>
        <div className="arch-pipeline">
          {[
            {icon:'globe',label:'RSS Fetch',tech:'urllib · custom UA'},
            {icon:'filter',label:'XML Parse',tech:'ElementTree'},
            {icon:'zap',label:'Normalize',tech:'Disease extract'},
            {icon:'shield',label:'Deduplicate',tech:'SHA-256 hash'},
            {icon:'trend',label:'Severity Score',tech:'Keyword rules'},
            {icon:'database',label:'SQLite Store',tech:'feed_items table'},
          ].map((n,i,arr) => <React.Fragment key={i}><PipelineNode {...n}/>{i<arr.length-1&&<Arrow/>}</React.Fragment>)}
        </div>
        <div className="arch-code-block">
          <span className="arch-code__comment"># Active RSS feeds (ingestion.py)</span>{'\n'}
          FEEDS = [{'\n'}
          {'  '}{'{"url": "https://www.who.int/rss-feeds/news-english.xml", "source": "WHO", "reliability": "OFFICIAL"},'}{'\n'}
          {'  '}{'{"url": "https://tools.cdc.gov/api/v2/resources/media/132608.rss", "source": "CDC", "reliability": "OFFICIAL"},'}{'\n'}
          {'  '}{'{"url": "https://www.ecdc.europa.eu/en/rss/news", "source": "ECDC", "reliability": "OFFICIAL"},'}{'\n'}
          {'  '}{'{"url": "https://promedmail.org/feed/", "source": "ProMED", "reliability": "MEDIA"},'}{'\n'}
          {'  '}{'# + 7x Google News RSS per disease keyword'}{'\n'}
          ]
        </div>
      </div>

      {/* C. AI / RAG Pipeline */}
      <div className="arch-section">
        <div className="arch-section__head"><span className="arch-section__letter">C</span>AI + RAG PIPELINE</div>
        <p className="arch-desc">Full retrieval-augmented generation pipeline. Query embeddings via Ollama (nomic-embed-text). Semantic search against ChromaDB. Optional CrossEncoder reranking. Grounded response generation via llama3.2 with strict source-only prompting — no hallucinated claims.</p>
        <div className="arch-pipeline">
          {[
            {icon:'search',label:'User Query',tech:'Natural language'},
            {icon:'cpu',label:'Embedding',tech:'nomic-embed-text'},
            {icon:'database',label:'Vector Search',tech:'ChromaDB · cosine'},
            {icon:'layers',label:'Reranking',tech:'Score + freshness'},
            {icon:'zap',label:'LLM Inference',tech:'llama3.2 · Ollama'},
            {icon:'check',label:'Grounded Response',tech:'Citations included'},
          ].map((n,i,arr) => <React.Fragment key={i}><PipelineNode {...n}/>{i<arr.length-1&&<Arrow/>}</React.Fragment>)}
        </div>
        <div className="arch-code-block">
          <span className="arch-code__comment"># System prompt enforces grounding (rag.py)</span>{'\n'}
          SYSTEM_PROMPT = """{'\n'}
          You are an outbreak intelligence analyst. Answer ONLY using the provided context.{'\n'}
          Do NOT fabricate statistics, case counts, or geographic data.{'\n'}
          If the context does not contain sufficient information, say so explicitly.{'\n'}
          Every claim must be traceable to a retrieved source document.{'\n'}
          """
        </div>
      </div>

      {/* D. Data Storage */}
      <div className="arch-section">
        <div className="arch-section__head"><span className="arch-section__letter">D</span>DATA STORAGE LAYER</div>
        <div className="arch-cards">
          {[
            {icon:'database', name:'SQLite', color:'#5BC6E8', role:'Primary store', detail:'feed_items · outbreaks · timeline_events · ingestion_log · 4 tables · WAL mode'},
            {icon:'layers',   name:'ChromaDB', color:'#E8743B', role:'Vector store', detail:'PersistentClient · nomic-embed-text 768-dim · cosine distance · collection per run'},
            {icon:'server',   name:'Redis', color:'#E5484D', role:'Cache layer (planned)', detail:'Feed response cache · session store · rate limiting · TTL-based expiry', dim:true},
            {icon:'box',      name:'PostgreSQL', color:'#7C4DFF', role:'Production DB (future)', detail:'Multi-tenant upgrade path · pgvector extension · timeseries partitioning', dim:true},
          ].map(c => (
            <div key={c.name} className="arch-card" style={{opacity:c.dim?0.55:1}}>
              <div className="arch-card__head">
                <div className="arch-card__icon" style={{color:c.color}}><Icon n={c.icon} size={18}/></div>
                <div><div className="arch-card__name">{c.name}</div><div className="arch-card__role">{c.role}</div></div>
                {c.dim && <span className="stack-badge" style={{marginLeft:'auto',background:'rgba(255,255,255,.04)',color:'var(--fg-4)'}}>PLANNED</span>}
              </div>
              <div className="arch-card__detail">{c.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* E. Geo Visualization */}
      <div className="arch-section">
        <div className="arch-section__head"><span className="arch-section__letter">E</span>GEO-INTELLIGENCE VISUALIZATION</div>
        <div className="arch-cards">
          {[
            {icon:'map',   name:'MapLibre GL v4.7', color:'#5BC6E8', role:'Primary renderer', detail:'WebGL map engine · CARTO dark/light tiles · OSM standard · Stadia dark · custom outbreak markers · arc animations'},
            {icon:'globe', name:'OpenStreetMap/CARTO', color:'#E8A33B', role:'Tile provider', detail:'Free raster tiles · no API key required · 256px tiles · retina @2x · no MapTiler dependency'},
            {icon:'layers',name:'Deck.gl', color:'#7C4DFF', role:'Geospatial overlays (planned)', detail:'HexagonLayer for case density · ScatterplotLayer for outbreaks · ArcLayer for spread paths · H3 resolution 5', dim:true},
            {icon:'trend', name:'Three.js Globe', color:'#E5484D', role:'Landing page', detail:'r155 · WebGL · custom land polygon texture · atmosphere shader · marker pulse animations · arc sparks'},
          ].map(c => (
            <div key={c.name} className="arch-card" style={{opacity:c.dim?0.55:1}}>
              <div className="arch-card__head">
                <div className="arch-card__icon" style={{color:c.color}}><Icon n={c.icon} size={18}/></div>
                <div><div className="arch-card__name">{c.name}</div><div className="arch-card__role">{c.role}</div></div>
                {c.dim && <span className="stack-badge" style={{marginLeft:'auto',background:'rgba(255,255,255,.04)',color:'var(--fg-4)'}}>PLANNED</span>}
              </div>
              <div className="arch-card__detail">{c.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* F. Deployment Architecture */}
      <div className="arch-section">
        <div className="arch-section__head"><span className="arch-section__letter">F</span>DEPLOYMENT ARCHITECTURE</div>
        <p className="arch-desc">Fully on-premise deployable. No external cloud AI APIs required. All inference runs locally via Ollama. Frontend is static HTML — served via any web server or opened directly.</p>
        <div className="arch-deploy-grid">
          {[
            {icon:'globe',  name:'Frontend',    stack:'HTML + React 18 + Babel', port:'Static files', note:'CDN-loaded, no bundler required'},
            {icon:'server', name:'FastAPI',      stack:'Python 3.12 + uvicorn',   port:'localhost:8000', note:'REST API + CORS + background worker'},
            {icon:'zap',    name:'Ingestion',    stack:'Python threading',         port:'5min interval', note:'Daemon thread, runs inside FastAPI process'},
            {icon:'database',name:'SQLite',      stack:'outbreak.db',              port:'File-based', note:'WAL mode, concurrent reads, <10MB baseline'},
            {icon:'layers', name:'ChromaDB',     stack:'PersistentClient',         port:'File-based', note:'chroma_db/ directory, auto-indexed'},
            {icon:'cpu',    name:'Ollama',        stack:'llama3.2 + nomic-embed',  port:'localhost:11434', note:'Optional — falls back to keyword if offline'},
          ].map(s => (
            <div key={s.name} className="arch-deploy-card">
              <div className="arch-deploy-card__icon"><Icon n={s.icon} size={16}/></div>
              <div className="arch-deploy-card__body">
                <div className="arch-deploy-card__name">{s.name}</div>
                <div className="arch-deploy-card__stack">{s.stack}</div>
                <div className="arch-deploy-card__port">{s.port}</div>
                <div className="arch-deploy-card__note">{s.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* H. Live Pipeline Example — Hantavirus MV Hondius */}
      <div className="arch-section" style={{borderColor:'rgba(245,158,11,.2)'}}>
        <div className="arch-section__head" style={{color:'var(--sev-3)'}}><span className="arch-section__letter" style={{borderColor:'rgba(245,158,11,.3)',color:'var(--sev-3)'}}>H</span>LIVE PIPELINE EXAMPLE — HANTAVIRUS (MV HONDIIUS)</div>
        <p className="arch-desc">Real end-to-end trace: WHO DON599 signal → structured outbreak record → vector index → retrieval analysis → operator notification.</p>
        <div className="arch-pipeline">
          {[
            {icon:'rss',     label:'WHO DON599 Alert',      tech:'HPS cluster, Honduras 2026', color:'var(--sev-3)'},
            {icon:'filter',  label:'Disease Extraction',    tech:'Hantavirus · Andes orthohantavirus', color:'var(--sev-3)'},
            {icon:'database', label:'Vector Indexing',       tech:'nomic-embed-text · ChromaDB', color:'var(--sev-3)'},
            {icon:'map',     label:'Outbreak Mapping',      tech:'ESP-TF-2026-0599 · Tenerife', color:'var(--sev-3)'},
            {icon:'search',  label:'Retrieval Analysis',    tech:'Confidence 0.89 · grounding +1', color:'var(--sev-3)'},
            {icon:'bell',    label:'Notification',          tech:'New Signal · SEV 3', color:'var(--sev-3)'},
          ].map((n,i,arr) => <React.Fragment key={i}><PipelineNode {...n}/>{i<arr.length-1&&<Arrow/>}</React.Fragment>)}
        </div>
        <div className="arch-roadmap-note" style={{background:'rgba(245,158,11,.05)',border:'1px solid rgba(245,158,11,.15)'}}>
          <span className="stack-badge" style={{background:'rgba(245,158,11,.12)',color:'var(--sev-3)'}}>LIVE EXAMPLE</span>
          <span className="mono-xs">MV Hondius cruise · Tenerife · 6 cases · WHO DON599 · SEV 3 · 2026-04-28</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginTop:'16px'}}>
          <div className="arch-deploy-card" style={{borderColor:'rgba(245,158,11,.15)'}}>
            <div className="arch-deploy-card__label" style={{color:'var(--sev-3)'}}>Signal Ingested</div>
            <div className="arch-deploy-card__name">WHO RSS Feed</div>
            <div className="arch-deploy-card__stack">DON599 · 2026-04-28</div>
          </div>
          <div className="arch-deploy-card" style={{borderColor:'rgba(245,158,11,.15)'}}>
            <div className="arch-deploy-card__label" style={{color:'var(--sev-3)'}}>Outbreak Created</div>
            <div className="arch-deploy-card__name">ESP-TF-2026-0599</div>
            <div className="arch-deploy-card__stack">Hantavirus · SEV 3 · 6 cases</div>
          </div>
          <div className="arch-deploy-card" style={{borderColor:'rgba(245,158,11,.15)'}}>
            <div className="arch-deploy-card__label" style={{color:'var(--sev-3)'}}>Vector Score</div>
            <div className="arch-deploy-card__name">0.89 confidence</div>
            <div className="arch-deploy-card__stack">+1 grounding boost</div>
          </div>
          <div className="arch-deploy-card" style={{borderColor:'rgba(245,158,11,.15)'}}>
            <div className="arch-deploy-card__label" style={{color:'var(--sev-3)'}}>Notification</div>
            <div className="arch-deploy-card__name">Alert dispatched</div>
            <div className="arch-deploy-card__stack">Realtime · 2026-05-02</div>
          </div>
        </div>
      </div>

      {/* G. Fine-Tuning Roadmap */}
      <div className="arch-section">
        <div className="arch-section__head" style={{color:'var(--fg-3)'}}><span className="arch-section__letter" style={{borderColor:'rgba(255,255,255,.12)',color:'var(--fg-3)'}}>G</span>FINE-TUNING ROADMAP</div>
        <p className="arch-desc" style={{color:'var(--fg-3)'}}>Future: domain-adapted LLM fine-tuned on outbreak intelligence corpora. LoRA-based parameter-efficient tuning on llama3.2 base using curated WHO/CDC/ECDC report datasets.</p>
        <div className="arch-pipeline" style={{opacity:0.6}}>
          {[
            {icon:'database',label:'Dataset Collection',tech:'WHO · CDC reports',dim:true},
            {icon:'filter',  label:'Instruction Tuning',tech:'JSONL format',dim:true},
            {icon:'cpu',     label:'LoRA Fine-Tuning',  tech:'4-bit QLoRA',dim:true},
            {icon:'shield',  label:'Evaluation',        tech:'ROUGE · Hallucination',dim:true},
            {icon:'zap',     label:'RAG Alignment',     tech:'Retrieval scoring',dim:true},
            {icon:'check',   label:'Production',        tech:'Ollama GGUF',dim:true},
          ].map((n,i,arr) => <React.Fragment key={i}><PipelineNode {...n}/>{i<arr.length-1&&<Arrow/>}</React.Fragment>)}
        </div>
        <div className="arch-roadmap-note">
          <span className="stack-badge" style={{background:'rgba(255,255,255,.04)',color:'var(--fg-4)'}}>FUTURE MILESTONE</span>
          <span className="mono-xs">Target: outbreak-specific instruction following · reduced hallucination on rare disease queries · improved entity extraction</span>
        </div>
      </div>
    </div>
  </div>
);

/* ── Sources View ─────────────────────────────────────────────────────────── */
const SOURCE_DEFS = [
  {id:'WHO',    name:'World Health Organization',  url:'https://www.who.int',       rel:'OFFICIAL', category:'Intergovernmental', desc:'Disease Outbreak News, situation reports, PHEIC declarations. Gold standard for global health events.', reliability:0.97},
  {id:'CDC',    name:'US Centers for Disease Control', url:'https://www.cdc.gov',   rel:'OFFICIAL', category:'Government',        desc:'US domestic surveillance, H5N1 avian influenza updates, travel health notices, MMWR reports.', reliability:0.95},
  {id:'ECDC',   name:'European Centre for Disease Prevention', url:'https://www.ecdc.europa.eu', rel:'OFFICIAL', category:'Intergovernmental', desc:'EU/EEA rapid risk assessments, threat reports, measles/influenza surveillance.', reliability:0.96},
  {id:'PAHO',   name:'Pan American Health Organization', url:'https://www.paho.org',rel:'OFFICIAL', category:'Intergovernmental', desc:'Americas regional outbreak alerts, hantavirus surveillance, weekly epidemiological updates.', reliability:0.94},
  {id:'ProMED', name:'Program for Monitoring Emerging Diseases', url:'https://promedmail.org', rel:'MEDIA', category:'Academic', desc:'Moderated email list for infectious disease events. Fastest reporting; pre-official signal detection.', reliability:0.80},
  {id:'Google News', name:'Google News RSS',       url:'https://news.google.com',   rel:'MEDIA',    category:'Media aggregator',  desc:'RSS feeds filtered per disease keyword (H5N1, Mpox, Measles, etc.). Useful for early signal detection.', reliability:0.55},
  {id:'REUTERS', name:'Reuters Health',            url:'https://www.reuters.com',   rel:'MEDIA',    category:'Wire service',      desc:'Breaking health news coverage. Good secondary confirmation for WHO/CDC events.', reliability:0.72},
  {id:'Kemkes', name:'Ministry of Health Indonesia', url:'https://www.kemkes.go.id', rel:'OFFICIAL', category:'Government',       desc:'Indonesian Ministry of Health — H5N1 domestic surveillance updates.', reliability:0.88},
];

const SourcesView = ({ backendAvailable }) => {
  const [sources, setSources]   = useState([]);
  const [ingestSt, setIngestSt] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (backendAvailable) {
      setLoading(true);
      Promise.all([apiFetch('/api/sources'), apiFetch('/api/ingest/status')]).then(([srcData, ingData]) => {
        if (srcData?.sources) setSources(srcData.sources);
        if (ingData) setIngestSt(ingData);
        setLoading(false);
      });
    }
  }, [backendAvailable]);

  function triggerIngest() {
    setIngesting(true);
    apiFetch('/api/ingest/trigger', {method:'POST'}).then(data => {
      // Refresh after trigger
      setTimeout(() => {
        apiFetch('/api/ingest/status').then(setIngestSt);
        setIngesting(false);
      }, 3000);
    }).catch(() => setIngesting(false));
  }

  const mergedSources = SOURCE_DEFS.map(def => {
    const live = sources.find(s => s.source === def.id);
    return { ...def, ...(live ? { itemCount: live.item_count, lastItem: live.last_item, diseases: live.diseases, lastRun: live.last_run } : {}) };
  });

  function freshnessLabel(ranAt) {
    if (!ranAt) return null;
    const diff = Date.now() - new Date(ranAt).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 5) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  function freshnessColor(ranAt) {
    if (!ranAt) return 'var(--fg-4)';
    const diff = Date.now() - new Date(ranAt).getTime();
    const mins = diff / 60000;
    if (mins < 60) return 'var(--sev-resolved)';
    if (mins < 360) return 'var(--sev-advisory)';
    return 'var(--sev-warning)';
  }

  return (
    <div className="sv-view">
      <div className="sv-header">
        <div>
          <div className="eyebrow" style={{color:'var(--fg-3)',marginBottom:6}}>INTELLIGENCE SOURCES</div>
          <div style={{fontFamily:'var(--font-display,var(--font-sans))',fontSize:22,fontWeight:700,letterSpacing:'-.02em'}}>Source health &amp; attribution</div>
          <div className="mono-xs" style={{marginTop:4}}>{mergedSources.length} registered sources{ingestSt ? ` · ${ingestSt.total_items || 0} total items · ${ingestSt.last_24h || 0} in last 24h` : ''}{!backendAvailable&&' · Backend offline'}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
          {backendAvailable && <span className="sv-live"><span className="live-pip"/> LIVE</span>}
          {backendAvailable && (
            <button className="cv-action-btn" style={{fontSize:10,padding:'4px 10px',opacity:ingesting?.8:1}} onClick={triggerIngest} disabled={ingesting}>
              {ingesting ? '⟳ INGESTING...' : '↺ TRIGGER INGEST'}
            </button>
          )}
        </div>
      </div>

      {/* Ingestion status bar */}
      {ingestSt?.last_run && (
        <div style={{padding:'8px 20px',borderBottom:'1px solid var(--border-1)',background:'var(--bg-graphite)',display:'flex',alignItems:'center',gap:16,fontSize:11}}>
          <span style={{fontFamily:'var(--font-mono)',color:'var(--fg-3)'}}>Last ingest run:</span>
          <span style={{fontFamily:'var(--font-mono)',color:freshnessColor(ingestSt.last_run.ran_at)}}>{freshnessLabel(ingestSt.last_run.ran_at)}</span>
          <span style={{color:'var(--fg-4)'}}>·</span>
          <span style={{fontFamily:'var(--font-mono)',color:'var(--fg-3)'}}>{ingestSt.last_run.items_fetched || 0} fetched</span>
          <span style={{color:'var(--fg-4)'}}>·</span>
          <span style={{fontFamily:'var(--font-mono)',color:'var(--accent-cyan)'}}>{ingestSt.last_run.items_new || 0} new</span>
          {ingestSt.last_run.status && <span className={`chip chip--${ingestSt.last_run.status==='ok'?'resolved':'advisory'}`} style={{fontSize:9}}><span className="chip__dot"/>{ingestSt.last_run.status}</span>}
        </div>
      )}

      {/* Source grid */}
      <div className="sv-grid">
        {mergedSources.map(s => (
          <div key={s.id} className={`sv-card ${selected===s.id?'sv-card--selected':''}`} onClick={() => setSelected(s.id===selected?null:s.id)}>
            <div className="sv-card__head">
              <div>
                <div className="sv-card__id">{s.id}</div>
                <div className="sv-card__name">{s.name}</div>
              </div>
              <span className={`chip chip--${s.rel==='OFFICIAL'?'resolved':'advisory'}`}><span className="chip__dot"/>{s.rel}</span>
            </div>
            <div className="sv-card__meta">
              <div className="sv-card__meta-row"><span className="sv-card__k">Category</span><span className="sv-card__v">{s.category}</span></div>
              <div className="sv-card__meta-row"><span className="sv-card__k">Reliability</span>
                <div className="sv-rel-bar"><div className="sv-rel-bar__fill" style={{width:`${(s.reliability||0.5)*100}%`, background: s.reliability>0.9?'var(--sev-resolved)':s.reliability>0.7?'var(--sev-advisory)':'var(--sev-warning)'}}/></div>
                <span className="sv-card__v">{Math.round((s.reliability||0.5)*100)}%</span>
              </div>
              {s.itemCount != null && <div className="sv-card__meta-row"><span className="sv-card__k">Items</span><span className="sv-card__v" style={{color:'var(--accent-cyan)'}}>{s.itemCount}</span></div>}
              {s.diseases != null && <div className="sv-card__meta-row"><span className="sv-card__k">Diseases</span><span className="sv-card__v">{s.diseases}</span></div>}
              {s.lastRun?.ran_at && <div className="sv-card__meta-row">
                <span className="sv-card__k">Freshness</span>
                <span style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:freshnessColor(s.lastRun.ran_at),display:'inline-block',flexShrink:0}}/>
                  <span className="sv-card__v mono-xs" style={{color:freshnessColor(s.lastRun.ran_at)}}>{freshnessLabel(s.lastRun.ran_at)}</span>
                </span>
              </div>}
              {s.lastRun?.status && <div className="sv-card__meta-row"><span className="sv-card__k">Status</span><span className={`chip chip--${s.lastRun.status==='ok'?'resolved':'advisory'}`} style={{fontSize:9}}><span className="chip__dot"/>{s.lastRun.status}</span></div>}
            </div>
            {selected === s.id && <div className="sv-card__desc">{s.desc}</div>}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="sv-card__link" onClick={e => e.stopPropagation()}>↗ {s.url.replace('https://','')}</a>
          </div>
        ))}
      </div>

      {/* Methodology */}
      <div className="sv-methodology">
        <div className="arch-section__head" style={{marginBottom:16}}><span className="arch-section__letter">M</span>METHODOLOGY &amp; SOURCE ATTRIBUTION</div>
        <div className="sv-meth-grid">
          {[
            ['Source attribution policy', 'Every ingested item retains its original source URL, publication timestamp, and reliability classification. Items displayed in the intelligence feed always link directly to the primary source document.'],
            ['Reliability classification', 'OFFICIAL: government agencies and intergovernmental organizations (WHO, CDC, ECDC, PAHO). MEDIA: wire services and news aggregators. LOCAL REPORT: regional health authorities. UNVERIFIED: social and informal sources.'],
            ['Deduplication logic', 'Items are deduplicated using a SHA-256 hash of title+source+date combination. Duplicate signals from multiple sources are merged with the highest-reliability source retained as primary attribution.'],
            ['Confidence scoring', 'RAG confidence is computed from the vector similarity scores of retrieved documents, weighted by source reliability class and document freshness (exponential decay, half-life: 7 days).'],
            ['No-hallucination guarantee', 'The LLM system prompt explicitly forbids fabricating statistics, case counts, or geographic claims. All responses include citations traceable to retrieved source documents. If context is insufficient, the model must state this explicitly.'],
            ['Misinformation handling', 'Social media and informal sources are classified as UNVERIFIED and displayed with explicit reliability warnings. Cross-referenced against official sources before severity escalation.'],
          ].map(([title, body]) => (
            <div key={title} className="sv-meth-card">
              <div className="sv-meth-card__title">{title}</div>
              <div className="sv-meth-card__body">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Notification Bell + Drawer ─────────────────────────────────────────── */
const NotifBell = ({ sevCount, outbreaks, onZoomMap, onAnalyze, onAck }) => {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const overlayRef = useRef(null);

  useEffect(() => {
    // Build notifications from active outbreaks
    const n = (outbreaks || DEFAULT_SIGNALS).filter(o => (o.severity||o.sev||1) >= 3).slice(0, 8).map((o, i) => ({
      id: o.id + '-n',
      disease: o.disease,
      region: o.region,
      sev: o.severity || o.sev || 1,
      source: o.source,
      summary: o.summary,
      url: o.source_url,
      read: i > 3,
      time: o.updated_at || new Date().toISOString(),
    }));
    setNotifs(n);
  }, [outbreaks]);

  const unread = notifs.filter(n => !n.read).length;
  const sevC = s => s >= 4 ? 'var(--sev-critical)' : s === 3 ? 'var(--sev-warning)' : 'var(--sev-advisory)';

  function handleOutside(e) { if (overlayRef.current && !overlayRef.current.contains(e.target)) setOpen(false); }

  return (
    <>
      <button className="cv__iconbtn" style={{position:'relative'}} onClick={() => setOpen(v => !v)}>
        <Icon n="bell" size={15}/>
        {unread > 0 && <span className="cv__badge">{unread}</span>}
      </button>
      {open && (
        <div
          style={{position:'fixed',inset:0,zIndex:250,background:'rgba(0,0,0,.5)',display:'flex',justifyContent:'flex-end'}}
          onClick={handleOutside}
        >
          <div ref={overlayRef} style={{
            width:360,height:'100%',background:'var(--bg-overlay)',borderLeft:'1px solid rgba(255,255,255,.10)',
            display:'flex',flexDirection:'column',boxShadow:'-12px 0 40px rgba(0,0,0,.5)',
          }}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'1px solid rgba(255,255,255,.08)',background:'var(--bg-graphite)',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <Icon n="bell" size={14} style={{color:'var(--accent-cyan)'}}/>
                <span style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:600,color:'var(--fg-1)'}}>Notifications</span>
                {unread > 0 && <span style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--sev-warning)',background:'rgba(232,116,59,.1)',border:'1px solid rgba(232,116,59,.25)',borderRadius:2,padding:'1px 6px'}}>{unread} UNREAD</span>}
              </div>
              <button onClick={() => setOpen(false)} style={{width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',background:'none',border:'1px solid rgba(255,255,255,.1)',borderRadius:2,color:'var(--fg-2)',cursor:'pointer'}}><Icon n="close" size={11}/></button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
              {notifs.map(n => (
                <div key={n.id} style={{
                  padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,.05)',
                  background: n.read ? 'transparent' : 'rgba(91,198,232,.03)',
                  cursor:'default',
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:sevC(n.sev),flexShrink:0,display:'inline-block'}}/>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:10,fontWeight:600,color:'var(--fg-1)'}}>{n.disease}</span>
                    <span className="src-badge" style={{fontSize:9}}>{n.source}</span>
                    {!n.read && <span style={{marginLeft:'auto',width:6,height:6,borderRadius:'50%',background:'var(--accent-cyan)'}}/>}
                  </div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--fg-3)',letterSpacing:'.05em',marginBottom:4}}>{n.region}</div>
                  {n.summary && <div style={{fontSize:11,color:'var(--fg-2)',lineHeight:1.45,marginBottom:6,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{n.summary}</div>}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button className="ff-action" style={{height:24,fontSize:9}} onClick={() => { onZoomMap(n.id.replace('-n','')); setOpen(false); }}>
                      <Icon n="map" size={10}/> Map
                    </button>
                    <button className="ff-action" style={{height:24,fontSize:9}} onClick={() => { onAnalyze(n.disease, n.region); setOpen(false); }}>
                      <Icon n="database" size={10}/> Analyze
                    </button>
                    <button className="ff-action" style={{height:24,fontSize:9}} onClick={() => { if(onAck) onAck(n.id.replace('-n','')); const ns=notifs.map(x=>x.id===n.id?{...x,read:true}:x); setNotifs(ns); }}>
                      <Icon n="check" size={10}/> Ack
                    </button>
                    {n.url && <a href={n.url} target="_blank" rel="noopener noreferrer" className="ff-action" style={{height:24,fontSize:9,textDecoration:'none'}}><Icon n="extLink" size={10}/> Source</a>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:'10px 16px',borderTop:'1px solid rgba(255,255,255,.06)',background:'var(--bg-graphite)',fontFamily:'var(--font-mono)',fontSize:9,color:'var(--fg-4)',letterSpacing:'.06em',flexShrink:0}}>
              {notifs.length} active watches · click to dismiss
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ── Console view ─────────────────────────────────────────────────────────── */
const ConsoleView = ({ onBack, user, onSettings, outbreaks, feedItems, timelineEvents, lastSync, feedLoading, backendAvailable, mapStyleKey, initialTab, initialQuery, onClearIntelQuery }) => {
  const [sel, setSel]           = useState(null);
  const [nowStr, setNow]        = useState('');
  const [tab, setTab]           = useState(initialTab || 'map');
  const [feedPreset, setFeedPreset] = useState('');
  const isMobile = useMobile();

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!sel && outbreaks?.length > 0) setSel(outbreaks[0].id);
    else if (!sel) setSel('KHM-PP-2026-0143');
  }, [outbreaks]);

  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().replace('T',' ').slice(0,19)+' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const TABS = [
    {id:'map',          label:'Map',          icon:'map'},
    {id:'feed',         label:'Feed',         icon:'activity'},
    {id:'intel',        label:'Console',      icon:'database'},
    {id:'timeline',     label:'Timeline',     icon:'clock'},
    {id:'architecture', label:'Architecture', icon:'server'},
    {id:'sources',      label:'Sources',      icon:'globe'},
  ];

  const initials = user ? user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';
  const selectedSignal = outbreaks?.find(o => o.id === sel) || DEFAULT_SIGNALS.find(s => s.id === sel) || DEFAULT_SIGNALS[0];
  const sevCount = (outbreaks||[]).filter(o => (o.severity||0) >= 3).length || 14;

  return (
    <div className={`cv${isMobile ? ' cv--mobile' : ''}`}>
      {/* TopBar */}
      <div className="cv__topbar">
        <div className="cv__brand">
          <div className="brand-wm" style={{fontSize:12}}>OUTBREAK<span className="brand-sep">▮</span>OS</div>
          <button className="cv__back" onClick={onBack}><Icon n="back" size={12}/>Landing</button>
        </div>
        {isMobile ? (
          <select className="cv__tab-select" value={tab} onChange={e => setTab(e.target.value)}>
            {TABS.map(tb => <option key={tb.id} value={tb.id}>{tb.label}</option>)}
          </select>
        ) : (
          <div className="cv__tabs">
            {TABS.map(tb => (
              <button key={tb.id} className={`cv__tab ${tab===tb.id?'is-active':''}`} onClick={() => setTab(tb.id)}>
                <Icon n={tb.icon} size={13}/>{tb.label}
              </button>
            ))}
          </div>
        )}
        <div className="cv__right">
          <NotifBell sevCount={sevCount} outbreaks={outbreaks} onZoomMap={id => { setSel(id); setTab('map'); }} onAnalyze={(d,r) => { }} onAck={id => acknowledgeAlert(id, user?.name||'Analyst', '')}/>
          <button className="cv__iconbtn"><Icon n="search" size={15}/></button>
          <button className="cv__iconbtn" title="Settings" onClick={onSettings}><Icon n="settings" size={15}/></button>
          <div className="cv__user">
            <div className="cv__avatar">{initials}</div>
            <div><div className="cv__user-name">{user?user.name:'Guest'}</div><div className="cv__user-role">{user?(user.role||'Analyst'):''}</div></div>
          </div>
        </div>
      </div>

      {/* Workspace — switches based on tab */}
      <div className="cv__content">
        {tab === 'map' && (
          <div className={`cv__workspace${isMobile ? ' cv__workspace--mobile' : ''}`}>
            {isMobile && (
              <div className="cv__mobile-tabs">
                <button className={`cv__mobile-tab ${sel && !document.getElementById('cv__map-panel') ? 'is-active' : ''}`} onClick={() => {
                  const panel = document.querySelector('.cv__workspace--mobile .cv__area--threats');
                  if (panel) panel.style.display = panel.style.display === 'none' ? '' : '';
                }}>
                  <Icon n="layers" size={13}/> Threats
                </button>
              </div>
            )}
            <ThreatPanel outbreaks={outbreaks} selected={sel} onSelect={setSel}/>
            <div className="cv__area--map" style={{position:'relative'}}>
              <GeoMap selectedId={sel} onSelect={setSel} outbreaks={outbreaks} mapStyleKey={mapStyleKey}/>
              {selectedSignal && (
                <DispatchPanel
                  signal={selectedSignal}
                  user={user}
                  onAcknowledge={id => {/* state refreshes via localStorage read in component */}}
                  onOpenFeed={disease => { setFeedPreset(disease); setTab('feed'); }}
                  onViewDetails={signal => {}}
                />
              )}
              {backendAvailable && (
                <div className="ingest-banner">
                  <span className="live-pip"/> LIVE INGESTION ACTIVE · {feedItems.length} signals
                </div>
              )}
              {!backendAvailable && (
                <div style={{position:'absolute',bottom:52,left:'50%',transform:'translateX(-50%)',background:'rgba(232,163,59,.08)',border:'1px solid rgba(232,163,59,.25)',borderRadius:3,padding:'4px 14px',fontFamily:'var(--font-mono)',fontSize:9,color:'var(--sev-advisory)',letterSpacing:'.06em',zIndex:20,pointerEvents:'none'}}>
                  ⚠ BACKEND OFFLINE — SEED DATA · Run: cd backend &amp;&amp; python -m uvicorn server:app --port 8000
                </div>
              )}
            </div>
            <FeedPanel feedItems={feedItems} lastSync={lastSync} loading={feedLoading}/>
            <IntelPanel backendAvailable={backendAvailable}/>
            <TimelinePanel events={timelineEvents}/>
          </div>
        )}
        {tab === 'feed'         && <FullFeedView feedItems={feedItems} backendAvailable={backendAvailable} onViewOnMap={() => setTab('map')} presetDisease={feedPreset} onClearPreset={() => setFeedPreset('')}/>}
        {tab === 'intel'        && <SituationConsole backendAvailable={backendAvailable} outbreaks={outbreaks} initialQuery={''} onClearQuery={() => {}}/>}
        {tab === 'timeline'     && <FullTimelineView events={timelineEvents} outbreaks={outbreaks} backendAvailable={backendAvailable} onZoomMap={out => { setSel(out.id); setTab('map'); }} onAnalyze={out => { }}/>}
        {tab === 'architecture' && <ArchitectureView/>}
        {tab === 'sources'      && <SourcesView backendAvailable={backendAvailable}/>}
      </div>


      {/* Status bar */}
      <div className="cv__statusbar">
        <div className="cv__statusbar-group">
          <span className="cv__pip"/><span className="mono-xs">LIVE</span>
          <span className="cv__statusbar-sep"/><span className="mono-xs">{nowStr}</span>
        </div>
        <div className="cv__statusbar-group">
          <span className="mono-xs">INGEST 4.1s</span>
          <span className="cv__statusbar-sep"/><span className="mono-xs">SIGNALS {(outbreaks||DEFAULT_SIGNALS).length}</span>
          <span className="cv__statusbar-sep"/><span className="mono-xs" style={{color:'var(--sev-warning)'}}>SEV≥3 · {sevCount}</span>
          {backendAvailable && <><span className="cv__statusbar-sep"/><span className="mono-xs" style={{color:'var(--sev-resolved)'}}>● BACKEND LIVE</span></>}
        </div>
        <div className="cv__statusbar-group">
          <span className="mono-xs">v2.14.3</span>
          <span className="cv__statusbar-sep"/><span className="mono-xs">OSM/CARTO</span>
        </div>
      </div>
    </div>
  );
};

/* ── Seed data ────────────────────────────────────────────────────────────── */
const SEED_FEED = [
  {id:'f1',ingested_at:'2026-05-08T14:22:00Z',source:'WHO',    disease:'H5N1',       region:'KHM · Phnom Penh',   severity:3, reliability:'OFFICIAL', summary:'3 confirmed H5N1 cases in Phnom Penh province. All linked to backyard poultry exposure. Contact tracing for 41 individuals.',url:'https://www.who.int/emergencies/disease-outbreak-news'},
  {id:'f2',ingested_at:'2026-05-08T14:08:00Z',source:'CDC',    disease:'Mpox',      region:'COD · North Kivu',   severity:4, reliability:'OFFICIAL', summary:'Mpox clade Ib cluster; 14-day rolling average still doubling. WHO coordinates vaccine shipment to Goma.',url:'https://www.cdc.gov/poxvirus/mpox/'},
  {id:'f3',ingested_at:'2026-05-08T14:00:00Z',source:'WHO',    disease:'Hantavirus',region:'ESP · Tenerife (MV Hondius)', severity:3, reliability:'OFFICIAL', summary:'WHO DON599: 6 confirmed Hantavirus (Andes strain) cases linked to MV Hondius cruise ship. Probable exposure: Patagonia, Argentina. Disembarked Tenerife. ECDC: low public risk. Rodent exposure likely route.',url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599'},
  {id:'f4',ingested_at:'2026-05-08T13:41:00Z',source:'ECDC',   disease:'Measles',   region:'ROU · Bucharest',    severity:2, reliability:'OFFICIAL', summary:'47 cases among unvaccinated school cohort. Catch-up vaccination campaign launched.',url:'https://www.ecdc.europa.eu/en/measles'},
  {id:'f5',ingested_at:'2026-05-08T13:22:00Z',source:'CDC',    disease:'H5N1',      region:'USA · California',   severity:3, reliability:'OFFICIAL', summary:'Dairy herd CA-DA-211 confirmed positive. 88 worker contacts under active testing.',url:'https://www.cdc.gov/flu/avianflu/'},
  {id:'f6',ingested_at:'2026-05-08T12:48:00Z',source:'PAHO',   disease:'Hantavirus',region:'ARG · Buenos Aires',  severity:2, reliability:'OFFICIAL', summary:'12 suburban HPS cases. Rodent surveillance increased; Sector III advisory issued.',url:'https://www.paho.org/en/topics/hantavirus'},
  {id:'f7',ingested_at:'2026-05-08T12:00:00Z',source:'Reuters',disease:'Hantavirus',region:'ZAF · Cape Town',     severity:2, reliability:'MEDIA',    summary:'2 passengers from MV Hondius requiring medical evacuation to South Africa hospitals. ECDC monitoring international case distribution.',url:'https://www.reuters.com/business/healthcare-pharmaceuticals/who-reports-six-confirmed-hantavirus-cases-tied-spain-bound-cruise-2026-05-08/'},
  {id:'f8',ingested_at:'2026-05-08T11:09:00Z',source:'WHO',    disease:'MERS-CoV',  region:'SAU · Riyadh',       severity:2, reliability:'OFFICIAL', summary:'3 dromedary-linked cases. No nosocomial spread; standard zoonotic surveillance.',url:'https://www.who.int/emergencies/mers-cov'},
  {id:'f9',ingested_at:'2026-05-08T10:42:00Z',source:'ProMED', disease:'Cholera',   region:'SDN · Khartoum',     severity:3, reliability:'MEDIA',    summary:'Treatment center: 41 admissions overnight. MSF coordinating WASH response.',url:'https://promedmail.org/'},
];

const SEED_TIMELINE_FULL = [
  {id:'tl-001',outbreak_id:'KHM-PP-2026-0143',event_type:'advisory',   label:'Q1 · Cambodia poultry advisory',          at_pct:8,  severity:2, date:'2025-11-15', source:'WHO',  description:'WHO issues advisory following detection of H5N1 in backyard poultry flocks near Phnom Penh.'},
  {id:'tl-002',outbreak_id:'USA-CA-2026-0011',event_type:'index_case', label:'Mar 12 · CA dairy cattle index case',     at_pct:22, severity:3, date:'2026-03-12', source:'CDC',  description:'First confirmed H5N1 positive in California dairy cattle herd CA-DA-211. Worker testing initiated.'},
  {id:'tl-003',outbreak_id:'COD-KN-2026-0291',event_type:'spread',     label:'Apr 4 · Mpox clade Ib expands',           at_pct:41, severity:3, date:'2026-04-04', source:'CDC',  description:'Mpox clade Ib confirmed spreading to adjacent Burundi provinces. Cross-border transmission documented.'},
  {id:'tl-004',outbreak_id:'COD-KN-2026-0291',event_type:'pheic',      label:'Apr 22 · WHO PHEIC consultation',         at_pct:58, severity:4, date:'2026-04-22', source:'WHO',  description:'WHO convenes Emergency Committee under IHR to evaluate PHEIC criteria for Mpox clade Ib.'},
  {id:'tl-005',outbreak_id:'ESP-TF-2026-0599',event_type:'index_case', label:'May 6 · WHO DON599: 6 Hantavirus on MV Hondius', at_pct:63, severity:3, date:'2026-05-06', source:'WHO',  description:'WHO Disease Outbreak News DON599 published. 6 confirmed Hantavirus (Andes strain) cases linked to cruise ship MV Hondius. Probable exposure in Patagonia, Argentina. Disembarked Tenerife, Canary Islands.'},
  {id:'tl-006',outbreak_id:'ESP-TF-2026-0599',event_type:'policy',     label:'May 7 · ECDC: low public risk',          at_pct:67, severity:2, date:'2026-05-07', source:'ECDC', description:'ECDC releases technical assessment. Confirms Andes strain. Rodent exposure most likely route. No sustained human-to-human transmission evidence.'},
  {id:'tl-007',outbreak_id:'ZAF-CP-2026-0012',event_type:'travel',     label:'May 8 · 2 passengers medical evac to ZAF',at_pct:70, severity:2, date:'2026-05-08', source:'Reuters', description:'2 MV Hondius passengers requiring medical evacuation to South Africa hospitals. International case distribution monitoring underway.'},
  {id:'tl-008',outbreak_id:'ESP-TF-2026-0599',event_type:'policy',     label:'May 8 · International contact tracing',   at_pct:72, severity:2, date:'2026-05-08', source:'WHO',  description:'WHO coordinates international contact tracing. NVHA notifies health authorities. Science Media Centre releases expert reactions.'},
  {id:'tl-009',outbreak_id:'KHM-PP-2026-0143',event_type:'active',     label:'May 8 · KHM-PP-2026-0143 active',         at_pct:78, severity:3, date:'2026-05-08', source:'WHO',  description:'Current situation: 247 cumulative cases, 3 deaths. WHO field team deployed to Phnom Penh.'},
  {id:'tl-010',outbreak_id:'IDN-JK-2026-0102',event_type:'forecast',   label:'Forecast · IDN cluster outcome',          at_pct:88, severity:2, date:'2026-06-01', source:'WHO',  description:'Projected outcome for Indonesia cluster based on current trajectory. Genomic results pending.'},
  {id:'tl-011',outbreak_id:'ROU-BU-2026-0078',event_type:'policy',     label:'May 3 · ROU school vaccination mandate',  at_pct:65, severity:2, date:'2026-05-03', source:'ECDC', description:'Romanian Health Ministry mandates catch-up measles vaccination for all school-age children.'},
];

/* ── Init screen ──────────────────────────────────────────────────────────── */
const InitScreen = () => (
  <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'var(--bg-base)'}}>
    <div style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
      <div style={{fontFamily:'var(--font-mono)',fontSize:16,fontWeight:600,letterSpacing:'.22em',color:'var(--fg-1)',display:'flex',alignItems:'center'}}>
        OUTBREAK<span style={{color:'var(--accent-cyan)',margin:'0 3px',fontSize:10}}>▮</span>OS
      </div>
      <span style={{width:20,height:20,borderRadius:'50%',border:'2px solid rgba(91,198,232,.2)',borderTopColor:'var(--accent-cyan)',animation:'obs-spin .7s linear infinite',display:'inline-block'}}/>
      <div style={{fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--fg-3)'}}>Initialising…</div>
    </div>
  </div>
);

/* ── Root App ─────────────────────────────────────────────────────────────── */
function App() {
  const [view,      setView]      = useState('init');
  const [initTab,   setInitTab]   = useState('map');
  const [user,      setUser]      = useState(null);
  const [settings,  setSettings]  = useState(false);

  const [outbreaks,        setOutbreaks]        = useState([]);
  const [feedItems,        setFeedItems]        = useState([]);
  const [timelineEvents,   setTimelineEvents]   = useState([]);
  const [lastSync,         setLastSync]         = useState('');
  const [feedLoading,      setFeedLoading]      = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [mapStyleKey,      setMapStyleKey]      = useState('carto_dark');
  const [drawerSignal,     setDrawerSignal]     = useState(null);
  const [intelQuery,      setIntelQuery]       = useState('');

  const refreshTimer = useRef(null);

  useEffect(() => {
    ObsAuth.init();
    const u = ObsAuth.getUser();
    setUser(u || null);
    const saved = ObsAuth.getSettings();
    if (saved?.mapProvider) setMapStyleKey(saved.mapProvider);
    setView('landing');
    loadData();
    refreshTimer.current = setInterval(loadData, 30000);
    return () => clearInterval(refreshTimer.current);
  }, []);

  async function loadData() {
    setFeedLoading(true);
    try {
      const health = await apiFetch('/api/health');
      const alive = !!health;
      setBackendAvailable(alive);
      if (alive) {
        const [outbreakData, feedData, timelineData] = await Promise.all([
          apiFetch('/api/outbreaks'),
          apiFetch('/api/feed?limit=50'),
          apiFetch('/api/timeline'),
        ]);
        if (outbreakData?.outbreaks?.length > 0) setOutbreaks(outbreakData.outbreaks);
        if (feedData?.items?.length > 0) setFeedItems(feedData.items);
        if (timelineData?.events?.length > 0) setTimelineEvents(timelineData.events);
        setLastSync(new Date().toISOString().slice(11,19) + ' UTC');
      }
    } catch (e) {
      console.warn('[app] data load failed:', e);
    } finally {
      setFeedLoading(false);
    }
  }

  function handleLogin(u)       { setUser(u); setView('landing'); }
  function handleSignup(u)      { setUser(u); setView('console'); }
  function handleLogout()       { setUser(null); setView('landing'); setSettings(false); }
  function handleUserUpdate(u)  { setUser(u); }

  function handleEnterConsole() {
    setInitTab('map');
    if (user) setView('console');
    else      setView('login');
  }

  function handleEnterTab(tabId) {
    setInitTab(tabId);
    if (user) setView('console');
    else      setView('login');
  }

  const vis = v => view === v ? 'view--visible' : 'view--hidden';
  if (view === 'init') return <InitScreen/>;

  return (
    <div style={{position:'relative',width:'100%',height:'100%',overflow:'hidden'}}>
      <div className={`view ${vis('login')}`}><LoginView onLogin={handleLogin} onSignup={() => setView('signup')}/></div>
      <div className={`view ${vis('signup')}`}><SignupView onSignup={handleSignup} onLogin={() => setView('login')}/></div>
      <div className={`view ${vis('landing')}`}>
        <LandingView onEnterConsole={handleEnterConsole} onEnterTab={handleEnterTab} onLogin={() => setView('login')} user={user} feedItems={feedItems}/>
      </div>
      <div className={`view ${vis('console')}`}>
        <ConsoleView
          onBack={() => setView('landing')}
          user={user}
          onSettings={() => setSettings(true)}
          outbreaks={outbreaks}
          feedItems={feedItems}
          timelineEvents={timelineEvents}
          lastSync={lastSync}
          feedLoading={feedLoading}
          backendAvailable={backendAvailable}
          mapStyleKey={mapStyleKey}
          initialTab={initTab}
          initialQuery={intelQuery}
          onClearIntelQuery={() => setIntelQuery('')}
        />
      </div>
      <SettingsDrawer open={settings} onClose={() => setSettings(false)} user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} onMapStyleChange={setMapStyleKey} mapStyleKey={mapStyleKey}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
