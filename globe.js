// OutbreakOS — 3D Globe (Three.js)
// createGlobe(container, opts?) → { dispose, setSelected, signals }
// Requires THREE in global scope (load three.min.js first).

'use strict';

const GLOBE_R = 1.0;

const GLOBE_SIGNALS = [
  { id: 'KHM-PP-0143', lat:  11.55, lng: 104.92, sev: 3, disease: 'H5N1',        label: 'KHM', cases: 247  },
  { id: 'COD-KN-0291', lat:  -1.66, lng:  29.22, sev: 4, disease: 'Mpox',        label: 'COD', cases: 1983 },
  { id: 'ROU-BU-0078', lat:  44.43, lng:  26.10, sev: 2, disease: 'Measles',     label: 'ROU', cases: 47   },
  { id: 'USA-CA-0011', lat:  36.77, lng:-119.42, sev: 3, disease: 'H5N1',        label: 'USA', cases: 89   },
  { id: 'ARG-BA-0044', lat: -34.61, lng: -58.38, sev: 2, disease: 'Hantavirus',  label: 'ARG', cases: 12   },
  { id: 'IDN-JK-0102', lat:  -6.21, lng: 106.85, sev: 2, disease: 'H5N1',        label: 'IDN', cases: 5    },
  { id: 'SAU-RY-0016', lat:  24.69, lng:  46.72, sev: 2, disease: 'MERS-CoV',    label: 'SAU', cases: 3    },
];

const GLOBE_ARCS = [
  ['COD-KN-0291', 'USA-CA-0011'],
  ['COD-KN-0291', 'ROU-BU-0078'],
  ['KHM-PP-0143', 'IDN-JK-0102'],
  ['USA-CA-0011', 'KHM-PP-0143'],
];

const SEV_HEX = { 4: 0xE5484D, 3: 0xE8743B, 2: 0xE8A33B, 1: 0x5BC6E8 };
const CYAN_HEX = 0x1D6FFF;

/* ---------- coordinate helpers ---------- */
function ll2v(lat, lng, r) {
  const R   = r == null ? GLOBE_R : r;
  const phi = (90 - lat) * (Math.PI / 180);
  const th  = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -R * Math.sin(phi) * Math.cos(th),
     R * Math.cos(phi),
     R * Math.sin(phi) * Math.sin(th)
  );
}

/* ---------- canvas-based earth texture ---------- */
const LAND_POLYS = [
  // North America
  [[71,-141],[71,-90],[68,-68],[55,-55],[50,-55],[44,-66],[25,-80],[18,-88],[15,-90],[20,-103],[24,-110],[30,-115],[32,-117],[47,-124],[58,-137],[60,-140],[71,-141]],
  // South America
  [[12,-72],[10,-62],[8,-60],[2,-52],[0,-50],[-5,-35],[-10,-37],[-20,-40],[-35,-55],[-55,-68],[-55,-72],[-45,-65],[-38,-58],[-25,-48],[-5,-35],[8,-60],[12,-72]],
  // Europe
  [[71,24],[71,-24],[57,-8],[50,-8],[44,-9],[36,-8],[36,10],[44,15],[46,30],[58,28],[63,28],[71,24]],
  // Africa
  [[37,-5],[37,10],[30,32],[22,37],[10,42],[0,41],[-10,40],[-34,18],[-35,26],[-10,32],[5,10],[5,2],[14,-17],[28,-10],[37,-5]],
  // Asia main
  [[71,28],[71,140],[55,145],[45,141],[36,140],[25,122],[10,100],[5,100],[5,78],[20,60],[12,44],[15,42],[28,35],[38,28],[44,38],[58,60],[71,28]],
  // Indian subcontinent
  [[8,77],[8,80],[23,88],[28,85],[35,75],[30,68],[22,68],[10,77]],
  // SE Asia peninsula
  [[20,92],[20,100],[10,100],[5,100],[5,104],[10,104],[16,104],[20,100],[22,98],[20,92]],
  // Australia
  [[-11,130],[-11,141],[-25,153],[-38,147],[-38,140],[-32,120],[-22,114],[-18,124],[-11,130]],
  // Greenland
  [[83,-45],[83,-17],[75,-15],[68,-25],[60,-44],[68,-56],[76,-57],[83,-45]],
  // Japan approx
  [[31,130],[35,137],[40,141],[44,145],[44,141],[38,140],[32,131],[31,130]],
  // UK/Ireland
  [[58,-5],[58,2],[51,1],[50,-5],[54,-5],[58,-5]],
  // New Zealand approx
  [[-34,172],[-34,178],[-46,168],[-46,172],[-34,172]],
];

function buildEarthTexture() {
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');

  // Ocean
  x.fillStyle = '#020914';
  x.fillRect(0, 0, W, H);

  // Land
  const toXY = (lat, lng) => [(lng + 180) / 360 * W, (90 - lat) / 180 * H];
  LAND_POLYS.forEach(poly => {
    x.beginPath();
    const [sx, sy] = toXY(poly[0][0], poly[0][1]);
    x.moveTo(sx, sy);
    for (let i = 1; i < poly.length; i++) {
      const [px, py] = toXY(poly[i][0], poly[i][1]);
      x.lineTo(px, py);
    }
    x.closePath();
    x.fillStyle = '#0B1C38';
    x.fill();
    x.strokeStyle = '#163260';
    x.lineWidth = 2;
    x.stroke();
  });

  // Subtle city dots near outbreak sites (adds realism)
  const cityDots = [
    [11.55, 104.92], [-1.66, 29.22], [44.43, 26.10], [36.77, -119.42],
    [-34.61, -58.38], [-6.21, 106.85], [24.69, 46.72],
    [51.5, -0.12], [40.71, -74.01], [35.69, 139.69], [48.85, 2.35],
    [55.75, 37.62], [31.23, 121.47], [28.61, 77.21], [23.13, 113.26],
  ];
  cityDots.forEach(([lat, lng]) => {
    const [cx, cy] = toXY(lat, lng);
    x.beginPath();
    x.arc(cx, cy, 1.5, 0, Math.PI * 2);
    x.fillStyle = 'rgba(29,111,255,0.3)';
    x.fill();
  });

  return new THREE.CanvasTexture(cv);
}

/* ---------- atmosphere shader ---------- */
function buildAtmosphere() {
  const geo = new THREE.SphereGeometry(GLOBE_R * 1.075, 64, 64);
  const mat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float i = pow(max(0.0, 0.60 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.8);
        gl_FragColor = vec4(0.08, 0.28, 0.95, 1.0) * i;
      }`,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

/* ---------- graticule grid ---------- */
function buildGrid() {
  const g = new THREE.Group();
  const R = GLOBE_R + 0.001;
  const baseMat = new THREE.LineBasicMaterial({ color: CYAN_HEX, opacity: 0.07, transparent: true, depthWrite: false });
  const majorMat = new THREE.LineBasicMaterial({ color: CYAN_HEX, opacity: 0.14, transparent: true, depthWrite: false });

  for (let lat = -80; lat <= 80; lat += 20) {
    const pts = [];
    for (let lng = 0; lng <= 361; lng += 3) pts.push(ll2v(lat, lng, R));
    const isMajor = lat === 0 || lat === 30 || lat === -30;
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), isMajor ? majorMat.clone() : baseMat.clone()));
  }
  for (let lng = 0; lng < 360; lng += 20) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 2) pts.push(ll2v(lat, lng, R));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), baseMat.clone()));
  }
  return g;
}

/* ---------- marker glow helper ---------- */
function buildGlowLayers(pos, color) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const c = new THREE.Color(color);
  [[0.011, 1.0], [0.022, 0.30], [0.042, 0.10], [0.070, 0.04]].forEach(([r, op]) => {
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 8),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })
    ));
  });
  return g;
}

/* ---------- build all markers ---------- */
function buildMarkers() {
  const group = new THREE.Group();
  const animatable = [];

  GLOBE_SIGNALS.forEach((sig, idx) => {
    const color = SEV_HEX[sig.sev] || CYAN_HEX;
    const surfacePos = ll2v(sig.lat, sig.lng, GLOBE_R);

    // Spike cone
    const h = 0.032 + sig.sev * 0.009;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.006, h, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    const spikeCenter = ll2v(sig.lat, sig.lng, GLOBE_R + h * 0.5);
    cone.position.copy(spikeCenter);
    cone.lookAt(0, 0, 0);
    cone.rotateX(Math.PI * 0.5);
    group.add(cone);

    // Core glow dot
    group.add(buildGlowLayers(surfacePos, color));

    // Static base ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.013, 0.021, 32),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false })
    );
    ring.position.copy(ll2v(sig.lat, sig.lng, GLOBE_R + 0.002));
    ring.lookAt(0, 0, 0);
    group.add(ring);

    // Animated pulse ring
    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(0.013, 0.021, 32),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false })
    );
    pulse.position.copy(ll2v(sig.lat, sig.lng, GLOBE_R + 0.002));
    pulse.lookAt(0, 0, 0);
    group.add(pulse);

    animatable.push({ ring, pulse, phase: idx * 0.8 });
  });

  return { group, animatable };
}

/* ---------- build arcs + sparks ---------- */
function buildArcs() {
  const group = new THREE.Group();
  const sparks = [];

  GLOBE_ARCS.forEach(([fromId, toId], i) => {
    const from = GLOBE_SIGNALS.find(s => s.id === fromId);
    const to   = GLOBE_SIGNALS.find(s => s.id === toId);
    if (!from || !to) return;

    const p1  = ll2v(from.lat, from.lng, GLOBE_R);
    const p2  = ll2v(to.lat,   to.lng,   GLOBE_R);
    const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_R * 1.55);
    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);

    // Arc line
    const linePts = curve.getPoints(64);
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(linePts),
      new THREE.LineBasicMaterial({ color: CYAN_HEX, transparent: true, opacity: 0.28, depthWrite: false })
    ));

    // Bright core arc
    const glowPts = curve.getPoints(32);
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(glowPts),
      new THREE.LineBasicMaterial({ color: 0xA0E8F8, transparent: true, opacity: 0.12, depthWrite: false })
    ));

    // Spark
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.0065, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xA0C8FF, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    group.add(spark);
    sparks.push({ curve, spark, t: i * 0.25, speed: 0.0028 + i * 0.0006 });
  });

  return { group, sparks };
}

/* ---------- stars background ---------- */
function buildStars() {
  const count = 1200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 40 + Math.random() * 20;
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8899CC, size: 0.06, transparent: true, opacity: 0.5, sizeAttenuation: true }));
}

/* ============================================================
   createGlobe — main export
   ============================================================ */
function createGlobe(container, opts) {
  opts = opts || {};

  /* renderer */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
  container.appendChild(renderer.domElement);

  /* scene + camera */
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 2.75);

  /* lighting */
  scene.add(new THREE.AmbientLight(0x112244, 1.8));
  const sun = new THREE.DirectionalLight(0x3366CC, 0.5);
  sun.position.set(4, 2, 4);
  scene.add(sun);

  /* globe group */
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);
  globeGroup.rotation.y = -0.45;

  /* sphere */
  globeGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R, 80, 80),
    new THREE.MeshPhongMaterial({ map: buildEarthTexture(), specular: 0x112233, shininess: 10 })
  ));

  /* grid */
  globeGroup.add(buildGrid());

  /* atmosphere (fixed) */
  scene.add(buildAtmosphere());

  /* stars (fixed) */
  scene.add(buildStars());

  /* markers */
  const { group: markerGroup, animatable } = buildMarkers();
  globeGroup.add(markerGroup);

  /* arcs */
  const { group: arcGroup, sparks } = buildArcs();
  globeGroup.add(arcGroup);

  /* resize */
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* drag interaction */
  let dragging = false, lx = 0, ly = 0, vx = 0, vy = 0;
  const onDown = e => {
    dragging = true;
    const pt = e.touches ? e.touches[0] : e;
    lx = pt.clientX; ly = pt.clientY;
    vx = vy = 0;
  };
  const onMove = e => {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - lx, dy = pt.clientY - ly;
    globeGroup.rotation.y += dx * 0.005;
    globeGroup.rotation.x += dy * 0.005;
    globeGroup.rotation.x = Math.max(-1.1, Math.min(1.1, globeGroup.rotation.x));
    vx = dy * 0.004; vy = dx * 0.004;
    lx = pt.clientX; ly = pt.clientY;
  };
  const onUp = () => { dragging = false; };
  renderer.domElement.addEventListener('mousedown', onDown);
  renderer.domElement.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);

  /* scroll zoom */
  renderer.domElement.addEventListener('wheel', e => {
    camera.position.z = Math.max(1.8, Math.min(4.5, camera.position.z + e.deltaY * 0.003));
  }, { passive: true });

  /* animation loop */
  let raf, t = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    t += 0.016;

    /* inertia + auto-rotate */
    if (!dragging) {
      globeGroup.rotation.y += vy + 0.0006;
      globeGroup.rotation.x += vx;
      vx *= 0.94;
      vy *= 0.94;
    }

    /* pulse rings */
    animatable.forEach(({ ring, pulse, phase }) => {
      const p = t * 1.1 + phase;
      ring.material.opacity = 0.25 + 0.25 * Math.sin(p);
      const sc = 1 + 1.8 * ((t * 0.75 + phase * 0.5) % 1);
      pulse.scale.setScalar(sc);
      pulse.material.opacity = Math.max(0, 0.55 * (1 - (sc - 1) / 1.8));
    });

    /* arc sparks */
    sparks.forEach(s => {
      s.t = (s.t + s.speed) % 1;
      s.spark.position.copy(s.curve.getPoint(s.t));
      const fade = 1 - Math.abs(s.t - 0.5) * 2.5;
      s.spark.material.opacity = Math.max(0, fade) * 0.95;
    });

    renderer.render(scene, camera);
  }
  tick();

  if (opts.onReady) setTimeout(opts.onReady, 80);

  return {
    signals: GLOBE_SIGNALS,
    setSelected(id) { /* future: highlight selected marker */ },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    },
  };
}
