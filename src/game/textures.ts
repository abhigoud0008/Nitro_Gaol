import * as THREE from 'three';

export interface ProceduralTextureSet {
  pitchAlbedo: THREE.CanvasTexture;
  pitchNormal: THREE.CanvasTexture;
  pitchRoughness: THREE.CanvasTexture;
  ballAlbedo: THREE.CanvasTexture;
  ballNormal: THREE.CanvasTexture;
  ballRoughness: THREE.CanvasTexture;
  carbonNormal: THREE.CanvasTexture;
  carbonRoughness: THREE.CanvasTexture;
  tireNormal: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  particleGlow: THREE.CanvasTexture;
  ledAdTexture: THREE.CanvasTexture;
  ledAdCanvas: HTMLCanvasElement;
  ledAdCtx: CanvasRenderingContext2D;
  jumbotronTexture: THREE.CanvasTexture;
  jumbotronCanvas: HTMLCanvasElement;
  jumbotronCtx: CanvasRenderingContext2D;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function heightMapToNormalTexture(
  heightData: Float32Array,
  size: number,
  strength: number,
  anisotropy: number
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const hL = heightData[y * size + xm];
      const hR = heightData[y * size + xp];
      const hD = heightData[ym * size + x];
      const hU = heightData[yp * size + x];

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      const idx = (y * size + x) * 4;
      d[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createProceduralTextureSet(
  textureSize: number,
  anisotropy: number
): ProceduralTextureSet {
  const pitchSize = Math.min(2048, Math.max(512, textureSize));
  const [pitchCanvas, pCtx] = makeCanvas(pitchSize, pitchSize);

  // Pitch stripes (16 alternating mowed turf lanes along Z)
  const stripes = 16;
  const stripeH = pitchSize / stripes;
  for (let i = 0; i < stripes; i++) {
    pCtx.fillStyle = i % 2 === 0 ? '#0d2b18' : '#123820';
    pCtx.fillRect(0, i * stripeH, pitchSize, stripeH + 1);
  }

  // Subtle cross-cut turf micro-grain
  const grassImg = pCtx.getImageData(0, 0, pitchSize, pitchSize);
  const gData = grassImg.data;
  const pitchHeight = new Float32Array(pitchSize * pitchSize);
  const [roughCanvas, rCtx] = makeCanvas(pitchSize, pitchSize);
  const roughImg = rCtx.createImageData(pitchSize, pitchSize);
  const rData = roughImg.data;

  for (let y = 0; y < pitchSize; y++) {
    const stripeIdx = Math.floor((y / pitchSize) * stripes);
    const evenStripe = stripeIdx % 2 === 0;
    for (let x = 0; x < pitchSize; x++) {
      const idx = (y * pitchSize + x) * 4;
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const frac = hash - Math.floor(hash);
      const blade = (frac - 0.5) * 18;

      gData[idx] = Math.max(0, Math.min(255, gData[idx] + blade));
      gData[idx + 1] = Math.max(0, Math.min(255, gData[idx + 1] + blade * 1.15));
      gData[idx + 2] = Math.max(0, Math.min(255, gData[idx + 2] + blade * 0.7));

      pitchHeight[y * pitchSize + x] = frac * 0.65 + (evenStripe ? 0.1 : -0.1);

      const roughVal = Math.round((evenStripe ? 215 : 190) + (frac - 0.5) * 28);
      rData[idx] = roughVal;
      rData[idx + 1] = roughVal;
      rData[idx + 2] = roughVal;
      rData[idx + 3] = 255;
    }
  }
  pCtx.putImageData(grassImg, 0, 0);
  rCtx.putImageData(roughImg, 0, 0);

  // Crisp white stadium pitch markings
  const marginX = pitchSize * 0.055;
  const marginY = pitchSize * 0.045;
  const fieldW = pitchSize - marginX * 2;
  const fieldH = pitchSize - marginY * 2;
  const lw = Math.max(3, pitchSize * 0.0055);

  pCtx.strokeStyle = 'rgba(241, 245, 249, 0.92)';
  pCtx.lineWidth = lw;

  // Outer touchline & goal lines
  pCtx.strokeRect(marginX, marginY, fieldW, fieldH);

  // Halfway line
  pCtx.beginPath();
  pCtx.moveTo(marginX, pitchSize * 0.5);
  pCtx.lineTo(pitchSize - marginX, pitchSize * 0.5);
  pCtx.stroke();

  // Center circle & center spot
  pCtx.beginPath();
  pCtx.arc(pitchSize * 0.5, pitchSize * 0.5, fieldW * 0.145, 0, Math.PI * 2);
  pCtx.stroke();

  pCtx.fillStyle = 'rgba(248, 250, 252, 0.95)';
  pCtx.beginPath();
  pCtx.arc(pitchSize * 0.5, pitchSize * 0.5, lw * 1.4, 0, Math.PI * 2);
  pCtx.fill();

  // Penalty & goal boxes (both ends)
  const penW = fieldW * 0.52;
  const penH = fieldH * 0.155;
  const goalBoxW = fieldW * 0.28;
  const goalBoxH = fieldH * 0.058;

  // Top end (-Z)
  pCtx.strokeRect((pitchSize - penW) * 0.5, marginY, penW, penH);
  pCtx.strokeRect((pitchSize - goalBoxW) * 0.5, marginY, goalBoxW, goalBoxH);
  pCtx.beginPath();
  pCtx.arc(pitchSize * 0.5, marginY + penH * 0.72, fieldW * 0.1, 0.22 * Math.PI, 0.78 * Math.PI);
  pCtx.stroke();

  // Bottom end (+Z)
  pCtx.strokeRect((pitchSize - penW) * 0.5, pitchSize - marginY - penH, penW, penH);
  pCtx.strokeRect((pitchSize - goalBoxW) * 0.5, pitchSize - marginY - goalBoxH, goalBoxW, goalBoxH);
  pCtx.beginPath();
  pCtx.arc(
    pitchSize * 0.5,
    pitchSize - marginY - penH * 0.72,
    fieldW * 0.1,
    1.22 * Math.PI,
    1.78 * Math.PI
  );
  pCtx.stroke();

  // Subtle team-end zone tint glow lines
  pCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  pCtx.lineWidth = lw * 1.5;
  pCtx.beginPath();
  pCtx.moveTo(marginX, marginY + lw);
  pCtx.lineTo(pitchSize - marginX, marginY + lw);
  pCtx.stroke();

  pCtx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  pCtx.beginPath();
  pCtx.moveTo(marginX, pitchSize - marginY - lw);
  pCtx.lineTo(pitchSize - marginX, pitchSize - marginY - lw);
  pCtx.stroke();

  const pitchAlbedo = new THREE.CanvasTexture(pitchCanvas);
  pitchAlbedo.colorSpace = THREE.SRGBColorSpace;
  pitchAlbedo.anisotropy = anisotropy;

  const pitchNormal = heightMapToNormalTexture(pitchHeight, pitchSize, 1.35, anisotropy);

  const pitchRoughness = new THREE.CanvasTexture(roughCanvas);
  pitchRoughness.colorSpace = THREE.NoColorSpace;
  pitchRoughness.anisotropy = anisotropy;

  // --- Football PBR Texture Set (Geodesic Panel Seams + Leather Micro-Grain) ---
  const ballRes = Math.min(1024, Math.max(512, textureSize));
  const [ballCanvas, bCtx] = makeCanvas(ballRes, ballRes);
  const [ballRoughCanvas, brCtx] = makeCanvas(ballRes, ballRes);
  const ballHeight = new Float32Array(ballRes * ballRes);

  // Base ceramic-white synthetic leather
  bCtx.fillStyle = '#e8edf5';
  bCtx.fillRect(0, 0, ballRes, ballRes);
  brCtx.fillStyle = '#5a5a5a'; // ~0.35 roughness glossy composite panels
  brCtx.fillRect(0, 0, ballRes, ballRes);

  // Geometric soccer panels grid in UV space
  const cols = 6;
  const rows = 4;
  const cellW = ballRes / cols;
  const cellH = ballRes / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW;
      const cy = (r + 0.5) * cellH;
      const isDarkPanel = (r + c) % 2 === 0;
      bCtx.fillStyle = isDarkPanel ? '#111827' : '#f1f5f9';
      bCtx.beginPath();
      const rad = Math.min(cellW, cellH) * 0.42;
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + (r % 2) * 0.2;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (k === 0) bCtx.moveTo(px, py);
        else bCtx.lineTo(px, py);
      }
      bCtx.closePath();
      bCtx.fill();

      // Accent geometric piping along dark panels
      bCtx.strokeStyle = isDarkPanel ? '#38bdf8' : '#334155';
      bCtx.lineWidth = Math.max(2, ballRes * 0.004);
      bCtx.stroke();

      // Roughness difference between matte dark carbon & gloss white panel
      brCtx.fillStyle = isDarkPanel ? '#a5a5a5' : '#4a4a4a';
      brCtx.fill();
    }
  }

  // Panel seam bevels & leather micro-grain into heightmap
  const bImg = bCtx.getImageData(0, 0, ballRes, ballRes);
  for (let y = 0; y < ballRes; y++) {
    for (let x = 0; x < ballRes; x++) {
      const idx = (y * ballRes + x) * 4;
      const lum = (bImg.data[idx] + bImg.data[idx + 1] + bImg.data[idx + 2]) / (3 * 255);
      const grain = (Math.sin(x * 0.8) * Math.cos(y * 0.8)) * 0.12;
      ballHeight[y * ballRes + x] = lum * 0.7 + grain;
    }
  }

  const ballAlbedo = new THREE.CanvasTexture(ballCanvas);
  ballAlbedo.colorSpace = THREE.SRGBColorSpace;
  ballAlbedo.wrapS = THREE.RepeatWrapping;
  ballAlbedo.wrapT = THREE.RepeatWrapping;
  ballAlbedo.anisotropy = anisotropy;

  const ballNormal = heightMapToNormalTexture(ballHeight, ballRes, 2.4, anisotropy);
  ballNormal.wrapS = THREE.RepeatWrapping;
  ballNormal.wrapT = THREE.RepeatWrapping;

  const ballRoughness = new THREE.CanvasTexture(ballRoughCanvas);
  ballRoughness.colorSpace = THREE.NoColorSpace;
  ballRoughness.wrapS = THREE.RepeatWrapping;
  ballRoughness.wrapT = THREE.RepeatWrapping;
  ballRoughness.anisotropy = anisotropy;

  // --- Carbon Fiber Weave Normal & Roughness ---
  const cfSize = 128;
  const cfHeight = new Float32Array(cfSize * cfSize);
  const [cfRoughCanvas, cfRCtx] = makeCanvas(cfSize, cfSize);
  const cfImg = cfRCtx.createImageData(cfSize, cfSize);
  for (let y = 0; y < cfSize; y++) {
    for (let x = 0; x < cfSize; x++) {
      const cellX = Math.floor(x / 8);
      const cellY = Math.floor(y / 8);
      const weave = (cellX + cellY) % 2 === 0;
      const lx = (x % 8) / 8;
      const ly = (y % 8) / 8;
      const h = weave ? Math.sin(lx * Math.PI) : Math.sin(ly * Math.PI);
      cfHeight[y * cfSize + x] = h;
      const rv = weave ? 65 : 105;
      const idx = (y * cfSize + x) * 4;
      cfImg.data[idx] = rv;
      cfImg.data[idx + 1] = rv;
      cfImg.data[idx + 2] = rv;
      cfImg.data[idx + 3] = 255;
    }
  }
  cfRCtx.putImageData(cfImg, 0, 0);
  const carbonNormal = heightMapToNormalTexture(cfHeight, cfSize, 2.2, anisotropy);
  carbonNormal.wrapS = THREE.RepeatWrapping;
  carbonNormal.wrapT = THREE.RepeatWrapping;
  carbonNormal.repeat.set(6, 6);

  const carbonRoughness = new THREE.CanvasTexture(cfRoughCanvas);
  carbonRoughness.colorSpace = THREE.NoColorSpace;
  carbonRoughness.wrapS = THREE.RepeatWrapping;
  carbonRoughness.wrapT = THREE.RepeatWrapping;
  carbonRoughness.repeat.set(6, 6);

  // --- Tire Tread Normal ---
  const tireSize = 128;
  const tireHeight = new Float32Array(tireSize * tireSize);
  for (let y = 0; y < tireSize; y++) {
    for (let x = 0; x < tireSize; x++) {
      const groove = (y % 16 < 4) || (Math.abs(x - tireSize / 2) < 5);
      tireHeight[y * tireSize + x] = groove ? 0.15 : 0.85;
    }
  }
  const tireNormal = heightMapToNormalTexture(tireHeight, tireSize, 2.5, anisotropy);
  tireNormal.wrapS = THREE.RepeatWrapping;
  tireNormal.wrapT = THREE.RepeatWrapping;
  tireNormal.repeat.set(1, 6);

  // --- Soft Radial Contact Shadow ---
  const [shadowCanvas, sCtx] = makeCanvas(128, 128);
  const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  // --- Particle Glow Sprite ---
  const [partCanvas, partCtx] = makeCanvas(64, 64);
  const pGrad = partCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  pGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
  pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  partCtx.fillStyle = pGrad;
  partCtx.fillRect(0, 0, 64, 64);
  const particleGlow = new THREE.CanvasTexture(partCanvas);

  // --- Animated LED Perimeter Advertising Board ---
  const [ledAdCanvas, ledAdCtx] = makeCanvas(1024, 128);
  const ledAdTexture = new THREE.CanvasTexture(ledAdCanvas);
  ledAdTexture.colorSpace = THREE.SRGBColorSpace;
  ledAdTexture.wrapS = THREE.RepeatWrapping;
  ledAdTexture.wrapT = THREE.ClampToEdgeWrapping;
  ledAdTexture.anisotropy = anisotropy;

  // --- Stadium Jumbotron Digital Scoreboard ---
  const [jumbotronCanvas, jumbotronCtx] = makeCanvas(512, 256);
  const jumbotronTexture = new THREE.CanvasTexture(jumbotronCanvas);
  jumbotronTexture.colorSpace = THREE.SRGBColorSpace;
  jumbotronTexture.anisotropy = anisotropy;

  const dispose = () => {
    pitchAlbedo.dispose();
    pitchNormal.dispose();
    pitchRoughness.dispose();
    ballAlbedo.dispose();
    ballNormal.dispose();
    ballRoughness.dispose();
    carbonNormal.dispose();
    carbonRoughness.dispose();
    tireNormal.dispose();
    contactShadow.dispose();
    particleGlow.dispose();
    ledAdTexture.dispose();
    jumbotronTexture.dispose();
  };

  return {
    pitchAlbedo,
    pitchNormal,
    pitchRoughness,
    ballAlbedo,
    ballNormal,
    ballRoughness,
    carbonNormal,
    carbonRoughness,
    tireNormal,
    contactShadow,
    particleGlow,
    ledAdTexture,
    ledAdCanvas,
    ledAdCtx,
    jumbotronTexture,
    jumbotronCanvas,
    jumbotronCtx,
    dispose,
  };
}

export function drawLedAdBanner(
  ctx: CanvasRenderingContext2D,
  tex: THREE.CanvasTexture,
  scrollOffset: number
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = '#050811';
  ctx.fillRect(0, 0, w, h);

  // Top/Bottom LED trim
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(0, 0, w, 6);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, h - 6, w, 6);

  ctx.font = '700 44px "Chakra Petch", sans-serif';
  ctx.textBaseline = 'middle';
  const items = [
    { text: 'NITRO GOAL ARENA', color: '#f8fafc' },
    { text: 'CHAMPIONSHIP SERIES', color: '#38bdf8' },
    { text: 'APEX MOTORSPORT', color: '#f59e0b' },
    { text: 'VALKYRIE AERO', color: '#f8fafc' },
  ];

  const segmentW = 540;
  const totalW = segmentW * items.length;
  const shift = ((scrollOffset * 90) % totalW + totalW) % totalW;

  for (let rep = -1; rep <= 1; rep++) {
    for (let i = 0; i < items.length; i++) {
      const x = i * segmentW - shift + rep * totalW + 24;
      if (x > w || x + segmentW < 0) continue;
      ctx.fillStyle = items[i].color;
      ctx.fillText(items[i].text, x, h * 0.52);
    }
  }
  tex.needsUpdate = true;
}

export function drawJumbotronScoreboard(
  ctx: CanvasRenderingContext2D,
  tex: THREE.CanvasTexture,
  blueScore: number,
  amberScore: number,
  timeRemaining: number,
  isOvertime: boolean
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, w, h);

  // Side team blocks
  ctx.fillStyle = '#0f2859';
  ctx.fillRect(18, 22, 140, h - 44);
  ctx.fillStyle = '#4a2608';
  ctx.fillRect(w - 158, 22, 140, h - 44);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 22px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BLUE', 88, 62);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText('AMBER', w - 88, 62);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 96px "JetBrains Mono", monospace';
  ctx.fillText(String(blueScore), 88, 170);
  ctx.fillText(String(amberScore), w - 88, 170);

  // Clock center
  const mins = Math.floor(Math.max(0, timeRemaining) / 60);
  const secs = Math.floor(Math.max(0, timeRemaining) % 60);
  const clockStr = isOvertime
    ? 'OVERTIME'
    : `${mins}:${secs.toString().padStart(2, '0')}`;

  ctx.fillStyle = isOvertime ? '#f59e0b' : '#e2e8f0';
  ctx.font = isOvertime
    ? '700 32px "Chakra Petch", sans-serif'
    : '700 54px "JetBrains Mono", monospace';
  ctx.fillText(clockStr, w * 0.5, 128);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px "Chakra Petch", sans-serif';
  ctx.fillText('NITRO GOAL ARENA', w * 0.5, 196);

  tex.needsUpdate = true;
}
