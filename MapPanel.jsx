// OutbreakOS — MapLibre GL Map Panel
// Outbreak markers · Heatmap layer · Spread arcs
// No external dependencies beyond maplibregl (already loaded)

'use strict';

const { useState: useStateMap, useEffect: useEffectMap, useRef: useRefMap, useCallback: useCallbackMap } = React;

/* ── Map tile styles ─────────────────────────────────────────────────────── */

const MAP_STYLES = {
  carto_dark: {
    version: 8,
    name: 'CARTO Dark',
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        maxzoom: 19,
      }
    },
    layers: [{ id: 'carto-dark', type: 'raster', source: 'carto' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },

  osm_standard: {
    version: 8,
    name: 'OpenStreetMap',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxzoom: 19,
      }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },

  carto_voyager: {
    version: 8,
    name: 'CARTO Voyager',
    sources: {
      voyager: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO',
        maxzoom: 19,
      }
    },
    layers: [{ id: 'voyager', type: 'raster', source: 'voyager' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },

  stadia_dark: {
    version: 8,
    name: 'Stadia Dark',
    sources: {
      stadia: {
        type: 'raster',
        tiles: ['https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
        attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © OpenStreetMap contributors',
        maxzoom: 20,
      }
    },
    layers: [{ id: 'stadia-dark', type: 'raster', source: 'stadia' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },
};

/* ── Severity helpers ────────────────────────────────────────────────────── */

const sevColorHex = s => s >= 4 ? '#E5484D' : s === 3 ? '#E8743B' : s === 2 ? '#E8A33B' : '#5BC6E8';
const sevClass = s => s >= 4 ? 'critical' : s === 3 ? 'warning' : s === 2 ? 'advisory' : 'monitoring';

/* ── Arc interpolation ───────────────────────────────────────────────────── */

function arcCoords(from, to, steps = 80) {
  const coords = [];
  const dLng = to.lng - from.lng;
  const adjDLng = ((dLng + 540) % 360) - 180;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + adjDLng * t;
    const arc = Math.sin(t * Math.PI) * 20;
    coords.push([lng, lat + arc]);
  }
  return coords;
}

function buildArcGeoJSON(signals, arcDefs) {
  const byId = {};
  signals.forEach(s => { byId[s.id] = s; });
  const features = [];
  arcDefs.forEach(({ fromId, toId }) => {
    const from = byId[fromId];
    const to   = byId[toId];
    if (!from || !to) return;
    const sev = Math.max(from.sev || from.severity || 1, to.sev || to.severity || 1);
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arcCoords(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat,   lng: to.lng   }
      )},
      properties: {
        fromDisease: from.disease,
        toDisease:   to.disease,
        severity:    sev,
        color:       sevColorHex(sev),
      }
    });
  });
  return { type: 'FeatureCollection', features };
}

function buildHeatGeoJSON(signals) {
  return {
    type: 'FeatureCollection',
    features: signals
      .filter(s => !isNaN(s.lat) && !isNaN(s.lng))
      .map(s => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: {
          weight:   (s.sev || s.severity || 1) / 4,
          severity: s.sev || s.severity || 1,
          cases:    Math.log10((s.cases || 1) + 1) / 4,
        }
      }))
  };
}

/* ── Default seed data ───────────────────────────────────────────────────── */

const DEFAULT_SIGNALS = [
  { id:'KHM-PP-2026-0143', disease:'H5N1',       country:'KHM', region:'Cambodia · Phnom Penh',      lat:11.5564,   lng:104.9282,   sev:3, severity:3, cases:247,  delta_7d:12.4, status:'WARNING',    source:'WHO',    source_url:'https://www.who.int/emergencies/disease-outbreak-news',      updated_at:'2026-05-08T14:22:00Z', summary:'3 confirmed H5N1 cases in Phnom Penh province. All linked to backyard poultry exposure. Contact tracing for 41 individuals.', reliability:'OFFICIAL' },
  { id:'COD-KN-2026-0291', disease:'Mpox',        country:'COD', region:'DR Congo · North Kivu',     lat:-1.6601,   lng:29.2200,    sev:4, severity:4, cases:1983, delta_7d:28.1, status:'CRITICAL',   source:'CDC',    source_url:'https://www.cdc.gov/poxvirus/mpox/',                         updated_at:'2026-05-08T13:58:00Z', summary:'Mpox clade Ib cluster; 14-day rolling average still doubling. WHO coordinates vaccine shipment to Goma.', reliability:'OFFICIAL' },
  { id:'ESP-TF-2026-0599', disease:'Hantavirus', country:'ESP', region:'Spain · Tenerife (MV Hondius)', lat:28.4636,   lng:-16.2518,   sev:3, severity:3, cases:6,    delta_7d:0,    status:'WARNING',    source:'WHO',    source_url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599', updated_at:'2026-05-08T14:00:00Z', summary:'WHO DON599: 6 confirmed Hantavirus (Andes strain) cases on MV Hondius cruise. Patagonia exposure. Tenerife disembarkation. ECDC: low public risk.', reliability:'OFFICIAL' },
  { id:'ZAF-CP-2026-0012', disease:'Hantavirus', country:'ZAF', region:'South Africa · Cape Town',   lat:-33.9249,  lng:18.4241,    sev:2, severity:2, cases:2,    delta_7d:0,    status:'MONITORING', source:'Reuters', source_url:'https://www.reuters.com/business/healthcare-pharmaceuticals/who-reports-six-confirmed-hantavirus-cases-tied-spain-bound-cruise-2026-05-08/', updated_at:'2026-05-08T12:00:00Z', summary:'2 MV Hondius passengers requiring medical evacuation to South Africa. ECDC monitoring international distribution.', reliability:'MEDIA' },
  { id:'ROU-BU-2026-0078', disease:'Measles',    country:'ROU', region:'Romania · Bucharest',        lat:44.4268,   lng:26.1025,    sev:2, severity:2, cases:47,   delta_7d:-3.1, status:'ADVISORY',   source:'ECDC',   source_url:'https://www.ecdc.europa.eu/en/measles',                      updated_at:'2026-05-08T13:41:00Z', summary:'School-cohort outbreak; catch-up vaccination campaign covers ~70% of at-risk cohort. Trend declining.', reliability:'OFFICIAL' },
  { id:'USA-CA-2026-0011', disease:'H5N1',        country:'USA', region:'USA · California',          lat:36.7783,   lng:-119.4179,  sev:3, severity:3, cases:89,   delta_7d:4.7,  status:'WARNING',    source:'CDC',    source_url:'https://www.cdc.gov/flu/avianflu/',                          updated_at:'2026-05-08T13:22:00Z', summary:'Dairy cattle herd no. CA-DA-211 confirmed positive. Worker testing initiated for 88 contacts.', reliability:'OFFICIAL' },
  { id:'ARG-BA-2026-0044', disease:'Hantavirus', country:'ARG', region:'Argentina · Buenos Aires',    lat:-34.6118,  lng:-58.3960,   sev:2, severity:2, cases:12,   delta_7d:0,    status:'MONITORING', source:'PAHO',   source_url:'https://www.paho.org/en/topics/hantavirus',                  updated_at:'2026-05-08T12:48:00Z', summary:'12 suburban HPS cases; rodent surveillance activated; no cluster spread pattern observed.', reliability:'OFFICIAL' },
  { id:'IDN-JK-2026-0102', disease:'H5N1',        country:'IDN', region:'Indonesia · Jakarta',        lat:-6.2088,   lng:106.8456,   sev:2, severity:2, cases:5,    delta_7d:2,    status:'MONITORING', source:'Kemkes', source_url:'https://www.kemkes.go.id',                                   updated_at:'2026-05-08T12:31:00Z', summary:'Cluster of 5 suspected cases under investigation. Genomic results pending; no h2h evidence.', reliability:'OFFICIAL' },
  { id:'SAU-RY-2026-0016', disease:'MERS-CoV',   country:'SAU', region:'Saudi Arabia · Riyadh',       lat:24.6877,   lng:46.7219,    sev:2, severity:2, cases:3,    delta_7d:0,    status:'MONITORING', source:'WHO',    source_url:'https://www.who.int/emergencies/mers-cov',                 updated_at:'2026-05-08T11:09:00Z', summary:'3 cases linked to dromedary contact. No nosocomial transmission. Routine zoonotic surveillance.', reliability:'OFFICIAL' },
];

const DEFAULT_ARCS = [
  { fromId:'COD-KN-2026-0291', toId:'USA-CA-2026-0011' },
  { fromId:'COD-KN-2026-0291', toId:'ROU-BU-2026-0078' },
  { fromId:'KHM-PP-2026-0143', toId:'IDN-JK-2026-0102' },
  { fromId:'USA-CA-2026-0011', toId:'KHM-PP-2026-0143' },
  { fromId:'ESP-TF-2026-0599', toId:'ZAF-CP-2026-0012' },
  { fromId:'ESP-TF-2026-0599', toId:'ARG-BA-2026-0044' },
];

/* ── Icon helper ─────────────────────────────────────────────────────────── */

const MIcon = ({ d, size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

/* ── GeoMap ──────────────────────────────────────────────────────────────── */

const GeoMap = ({ selectedId, onSelect, outbreaks: propOutbreaks, mapStyleKey = 'carto_dark', flyTarget }) => {
  const mapContainerRef  = useRefMap(null);
  const mapRef           = useRefMap(null);
  const markersRef       = useRefMap({});
  const animFrameRef     = useRefMap(null);
  const spreadAnimRef    = useRefMap(null);
  const layersReadyRef   = useRefMap(false);

  const [activeLayer, setActiveLayer] = useStateMap('outbreaks');
  const [mapReady,    setMapReady]    = useStateMap(false);
  const [opacity,     setOpacity]     = useStateMap(85);
  const [minSev,      setMinSev]      = useStateMap(1);

  const signals = (propOutbreaks && propOutbreaks.length > 0) ? propOutbreaks : DEFAULT_SIGNALS;
  const filteredSignals = signals.filter(s => (s.sev || s.severity || 1) >= minSev);

  /* ── Initialize map ─────────────────────────────────────────────────────── */
  useEffectMap(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const style = MAP_STYLES[mapStyleKey] || MAP_STYLES.carto_dark;

    const map = new maplibregl.Map({
      container:          mapContainerRef.current,
      style:              style,
      center:             [20, 12],
      zoom:               1.75,
      minZoom:            0.5,
      maxZoom:            9,
      attributionControl: false,
      antialias:          true,
      renderWorldCopies:  false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      const arcGeoJSON  = buildArcGeoJSON(signals, DEFAULT_ARCS);
      const heatGeoJSON = buildHeatGeoJSON(signals);

      /* ── Sources ─────────────────────────────────────────────────────────── */
      map.addSource('arcs',        { type: 'geojson', data: arcGeoJSON  });
      map.addSource('heat-points', { type: 'geojson', data: heatGeoJSON });

      /* ── Arc glow (always visible in outbreaks + spread) ─────────────────── */
      map.addLayer({
        id: 'arcs-glow',
        type: 'line',
        source: 'arcs',
        paint: {
          'line-color': '#5BC6E8',
          'line-width': 4,
          'line-opacity': 0.08,
          'line-blur': 8,
        }
      });

      /* ── Arc core with animated dash ─────────────────────────────────────── */
      map.addLayer({
        id: 'arcs-core',
        type: 'line',
        source: 'arcs',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.4,
          'line-opacity': 0.5,
          'line-dasharray': [4, 3],
        }
      });

      /* ── Spread layer — wide pulsing arcs ────────────────────────────────── */
      map.addLayer({
        id: 'spread-glow',
        type: 'line',
        source: 'arcs',
        layout: { visibility: 'none' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 12,
          'line-opacity': 0.12,
          'line-blur': 14,
        }
      });

      map.addLayer({
        id: 'spread-core',
        type: 'line',
        source: 'arcs',
        layout: { visibility: 'none' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.5,
          'line-opacity': 0.85,
          'line-dasharray': [2, 2],
        }
      });

      /* ── Heatmap layer ───────────────────────────────────────────────────── */
      map.addLayer({
        id: 'heatmap-layer',
        type: 'heatmap',
        source: 'heat-points',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': [
            'interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 2
          ],
          'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'], 0, 1.5, 9, 4
          ],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(0,0,0,0)',
            0.15, 'rgba(91,198,232,0.15)',
            0.35, 'rgba(232,163,59,0.45)',
            0.55, 'rgba(232,116,59,0.65)',
            0.75, 'rgba(229,72,77,0.80)',
            1.0,  'rgba(229,72,77,0.95)',
          ],
          'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 50,
            3, 80,
            6, 130,
            9, 200,
          ],
          'heatmap-opacity': 0.88,
        }
      });

      /* ── Arc animation (outbreaks + spread) ──────────────────────────────── */
      let step = 0;
      const animArcs = () => {
        step = (step + 0.15) % 7;
        if (map.getLayer('arcs-core')) {
          map.setPaintProperty('arcs-core', 'line-dasharray', [Math.abs(Math.sin(step)) * 4 + 1, 3]);
        }
        animFrameRef.current = requestAnimationFrame(animArcs);
      };
      animFrameRef.current = requestAnimationFrame(animArcs);

      /* ── Spread animation ─────────────────────────────────────────────────── */
      let spreadStep = 0;
      const animSpread = () => {
        spreadStep = (spreadStep + 0.22) % 8;
        if (map.getLayer('spread-core')) {
          map.setPaintProperty('spread-core', 'line-dasharray', [spreadStep % 3 + 1, 2]);
        }
        if (map.getLayer('spread-glow')) {
          map.setPaintProperty('spread-glow', 'line-opacity', 0.08 + Math.sin(spreadStep * 0.5) * 0.06);
        }
        spreadAnimRef.current = requestAnimationFrame(animSpread);
      };
      spreadAnimRef.current = requestAnimationFrame(animSpread);

      layersReadyRef.current = true;
      setMapReady(true);
    });

    return () => {
      if (animFrameRef.current)  cancelAnimationFrame(animFrameRef.current);
      if (spreadAnimRef.current) cancelAnimationFrame(spreadAnimRef.current);
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      layersReadyRef.current = false;
    };
  }, [mapStyleKey]);

  /* ── Layer visibility toggle ─────────────────────────────────────────────── */
  useEffectMap(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    const show = id => { try { map.setLayoutProperty(id, 'visibility', 'visible'); } catch (_) {} };
    const hide = id => { try { map.setLayoutProperty(id, 'visibility', 'none');    } catch (_) {} };
    const opacityFrac = opacity / 100;

    if (activeLayer === 'outbreaks') {
      show('arcs-glow'); show('arcs-core');
      hide('spread-glow'); hide('spread-core');
      hide('heatmap-layer');
      // Show all markers
      Object.values(markersRef.current).forEach(m => { m.getElement().style.opacity = '1'; });
    } else if (activeLayer === 'heatmap') {
      hide('arcs-glow'); hide('arcs-core');
      hide('spread-glow'); hide('spread-core');
      show('heatmap-layer');
      try { map.setPaintProperty('heatmap-layer', 'heatmap-opacity', opacityFrac); } catch (_) {}
      // Dim markers during heatmap
      Object.values(markersRef.current).forEach(m => { m.getElement().style.opacity = '0.25'; });
    } else if (activeLayer === 'spread') {
      hide('arcs-glow'); hide('arcs-core');
      show('spread-glow'); show('spread-core');
      hide('heatmap-layer');
      try { map.setPaintProperty('spread-glow', 'line-opacity', opacityFrac * 0.12); } catch (_) {}
      try { map.setPaintProperty('spread-core', 'line-opacity', opacityFrac);        } catch (_) {}
      Object.values(markersRef.current).forEach(m => { m.getElement().style.opacity = '1'; });
    }
  }, [activeLayer, opacity, mapReady]);

  /* ── Markers: place / update ─────────────────────────────────────────────── */
  useEffectMap(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const currentIds = new Set(filteredSignals.map(s => s.id));

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    filteredSignals.forEach(sig => {
      const lat = sig.lat;
      const lng = sig.lng;
      if (isNaN(lat) || isNaN(lng)) return;

      const sev      = sig.sev || sig.severity || 1;
      const color    = sevColorHex(sev);
      const isSelected = selectedId === sig.id;

      if (markersRef.current[sig.id]) {
        const el = markersRef.current[sig.id].getElement();
        el.classList.toggle('is-selected', isSelected);
        el.style.color = color;
        return;
      }

      const el = document.createElement('button');
      el.className = `om-marker${isSelected ? ' is-selected' : ''}`;
      el.style.color = color;
      el.style.transition = 'opacity 0.3s ease';
      el.title = `${sig.disease} · ${sig.region || sig.country}`;

      el.innerHTML = `
        <span class="om-marker__pulse"></span>
        <span class="om-marker__dot"></span>
        <span class="om-marker__label">
          <span class="mono-xs">${sig.country || sig.country_code || ''}</span>
          <span class="om-marker__sep">·</span>
          <span class="mono-xs">${sig.disease}</span>
        </span>
      `;

      el.addEventListener('click', e => {
        e.stopPropagation();
        onSelect(sig.id);
      });

      markersRef.current[sig.id] = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 6] })
        .setLngLat([lng, lat])
        .addTo(map);
    });
  }, [mapReady, filteredSignals, selectedId, onSelect]);

  /* ── Update GeoJSON sources when signals change ──────────────────────────── */
  useEffectMap(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    try {
      const arcSrc  = map.getSource('arcs');
      const heatSrc = map.getSource('heat-points');
      if (arcSrc)  arcSrc.setData(buildArcGeoJSON(filteredSignals, DEFAULT_ARCS));
      if (heatSrc) heatSrc.setData(buildHeatGeoJSON(filteredSignals));
    } catch (_) {}
  }, [mapReady, filteredSignals]);

  /* ── FlyTo when flyTarget changes ────────────────────────────────────────── */
  useEffectMap(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 5, duration: 1200, essential: true });
    if (flyTarget.id) onSelect(flyTarget.id);
  }, [flyTarget]);

  const zoomIn   = () => mapRef.current?.zoomIn({ duration: 300 });
  const zoomOut  = () => mapRef.current?.zoomOut({ duration: 300 });
  const resetView = () => mapRef.current?.flyTo({ center: [20, 12], zoom: 1.75, duration: 800 });

  /* ── Layer label ─────────────────────────────────────────────────────────── */
  const layerDesc = {
    outbreaks: 'Outbreak markers + transmission arcs',
    heatmap:   'Severity-weighted outbreak density',
    spread:    'Cross-border transmission routes',
  }[activeLayer] || '';

  return (
    <div style={{ position:'relative', height:'100%', width:'100%', background:'#07090C', overflow:'hidden' }}>

      {/* MapLibre GL canvas */}
      <div ref={mapContainerRef} style={{ position:'absolute', inset:0 }}/>

      {/* Subtle graticule overlay */}
      <div className="om-map__graticule"/>

      {/* ── HUD: top-left layer selector ── */}
      <div className="om-map__hud om-map__hud--tl" style={{ gap:8 }}>
        <div className="mono-xs" style={{ color:'var(--fg-4)', letterSpacing:'.14em' }}>LAYER</div>
        <div className="om-segment">
          {['Outbreaks','Heatmap','Spread'].map(l => (
            <button
              key={l}
              className={activeLayer === l.toLowerCase() ? 'is-active' : ''}
              onClick={() => setActiveLayer(l.toLowerCase())}
            >{l}</button>
          ))}
        </div>

        {/* Opacity slider — shown for heatmap + spread */}
        {(activeLayer === 'heatmap' || activeLayer === 'spread') && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <span className="mono-xs" style={{ color:'var(--fg-4)', minWidth:36 }}>OPACITY</span>
            <input
              type="range" min={20} max={100} value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              style={{ width:72, accentColor:'var(--accent-cyan)', cursor:'pointer' }}
            />
            <span className="mono-xs" style={{ color:'var(--fg-3)', minWidth:26 }}>{opacity}%</span>
          </div>
        )}

        {/* Severity filter */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
          <span className="mono-xs" style={{ color:'var(--fg-4)', minWidth:36 }}>MIN SEV</span>
          <div className="om-segment">
            {[1,2,3,4].map(s => (
              <button key={s} className={minSev === s ? 'is-active' : ''} onClick={() => setMinSev(s)}>{s}</button>
            ))}
          </div>
        </div>

        {layerDesc && (
          <div className="mono-xs" style={{ color:'var(--fg-4)', fontSize:9, marginTop:1 }}>{layerDesc}</div>
        )}
      </div>

      {/* ── HUD: top-right zoom controls ── */}
      <div className="om-map__hud om-map__hud--tr">
        <button className="om-iconbtn" title="Zoom in"   onClick={zoomIn}><MIcon d="M12 5v14M5 12h14" size={13}/></button>
        <button className="om-iconbtn" title="Zoom out"  onClick={zoomOut}><MIcon d="M5 12h14" size={13}/></button>
        <button className="om-iconbtn" title="Reset view" onClick={resetView}>
          <MIcon d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" size={13}/>
        </button>
      </div>

      {/* ── HUD: bottom-left severity legend ── */}
      <div className="om-map__hud om-map__hud--bl">
        <div className="om-legend">
          {[['#E5484D','SEV 4 · CRITICAL'],['#E8743B','SEV 3 · WARNING'],['#E8A33B','SEV 2 · ADVISORY'],['#5BC6E8','SEV 1 · INFO']].map(([c,l]) => (
            <div key={l} className="om-legend__row">
              <span className="om-legend__dot" style={{ background:c }}/>
              <span className="mono-xs">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HUD: bottom-right signal count ── */}
      <div className="om-map__hud om-map__hud--br">
        <span className="mono-xs" style={{ color:'var(--fg-3)' }}>
          {filteredSignals.length} SIGNALS · PROJ WEB MERCATOR
        </span>
      </div>

    </div>
  );
};

window.GeoMap        = GeoMap;
window.MAP_STYLES    = MAP_STYLES;
window.DEFAULT_SIGNALS = DEFAULT_SIGNALS;
window.sevClass      = sevClass;
