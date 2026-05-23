/**
 * Itzune — ASCII Sphere Hero Animation
 *
 * Approach: Vanilla Canvas + requestAnimationFrame
 * Algorithm: Classic z-buffered sphere projection (donut.c style)
 *   - Parametric sphere coordinates rotated on two axes
 *   - Characters sampled from a luminance ramp based on surface-normal · light-direction
 *   - Z-buffer prevents back-face overdraw
 *   - Rendered as ctx.fillText() on a 2D canvas for crisp monospace output
 *
 * Dependencies: none
 * Bundle size: ~3KB
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const CONFIG = {
    // Character ramp: dark → bright (luminance mapping)
    // Wider ramp = more texture depth on the sphere surface
    charRamp: ' .`\'^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',

    // Monospace grid cell dimensions (must match canvas font size)
    cellW: 10,   // px per character column
    cellH: 18,   // px per character row (slightly taller for aspect ratio)

    // Sphere geometry
    sphereScale: 0.38,    // fraction of min(width, height)
    viewerDist:  5,       // K2: moves sphere further/closer from viewer

    // Rotation speeds (radians per frame)
    speedA: 0.006,        // Y-axis rotation
    speedB: 0.002,        // X-axis rotation

    // Light direction (unit vector) — top-right-front
    lightX:  0.6,
    lightY: -0.5,
    lightZ: -0.6,

    // Render style
    baseColor:   '202, 213, 226', // --color-mist in RGB
    baseOpacity: 0.055,           // very faint — bioluminescent glow
    accentColor: '75, 184, 232',  // --color-itzune-sky for brightest chars
    accentThreshold: 0.75,        // luminance above this → sky blue tint

    // Scroll parallax
    parallaxFactor: 0.18,         // sphere center drifts up this fraction of scrollY

    // Angular step for sphere tessellation
    thetaStep: 0.035,   // smaller = denser horizontal bands
    phiStep:   0.018,   // smaller = denser vertical bands
  };

  // ─── State ────────────────────────────────────────────────────────────────
  let A = 0;   // rotation angle A (Y-axis)
  let B = 0.8; // rotation angle B (X-axis), offset for initial tilt
  let raf = null;
  let canvas, ctx, cols, rows, zbuf, output, lumbuf;

  // Normalise light direction once
  const lMag = Math.sqrt(CONFIG.lightX ** 2 + CONFIG.lightY ** 2 + CONFIG.lightZ ** 2);
  const LX = CONFIG.lightX / lMag;
  const LY = CONFIG.lightY / lMag;
  const LZ = CONFIG.lightZ / lMag;

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    loop();
  }

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    cols  = Math.floor(canvas.width  / CONFIG.cellW);
    rows  = Math.floor(canvas.height / CONFIG.cellH);
    zbuf  = new Float32Array(cols * rows);
    output = new Uint8Array(cols * rows);      // char ramp index
    lumbuf = new Float32Array(cols * rows);    // luminance per cell
  }

  // ─── Render one frame ─────────────────────────────────────────────────────
  function frame() {
    const { charRamp, sphereScale, viewerDist, thetaStep, phiStep } = CONFIG;
    const rampLen = charRamp.length - 1;

    // Clear buffers
    zbuf.fill(0);
    output.fill(0);
    lumbuf.fill(0);

    const R  = Math.min(cols * CONFIG.cellW, rows * CONFIG.cellH) * sphereScale;
    const K2 = viewerDist;
    const K1 = R * K2 * 0.9;

    // Pre-compute rotation matrices
    const cosA = Math.cos(A), sinA = Math.sin(A);
    const cosB = Math.cos(B), sinB = Math.sin(B);

    // Project sphere points
    for (let theta = 0; theta < Math.PI * 2; theta += thetaStep) {
      const sinT = Math.sin(theta), cosT = Math.cos(theta);

      for (let phi = 0; phi < Math.PI; phi += phiStep) {
        const sinP = Math.sin(phi), cosP = Math.cos(phi);

        // Unit sphere point (before rotation)
        const sx = sinP * cosT;
        const sy = sinP * sinT;
        const sz = cosP;

        // Surface normal == position on unit sphere (before rotation)
        const nx = sx, ny = sy, nz = sz;

        // Rotate: first around Y axis (A), then around X axis (B)
        // Y-rotation:
        const sx1 =  sx * cosA + sz * sinA;
        const sz1 = -sx * sinA + sz * cosA;
        const sy1 =  sy;

        // X-rotation:
        const sx2 =  sx1;
        const sy2 =  sy1 * cosB - sz1 * sinB;
        const sz2 =  sy1 * sinB + sz1 * cosB;

        // Rotate normal the same way
        const nx1 =  nx * cosA + nz * sinA;
        const nz1 = -nx * sinA + nz * cosA;
        const ny1 =  ny;

        const nx2 =  nx1;
        const ny2 =  ny1 * cosB - nz1 * sinB;
        const nz2 =  ny1 * sinB + nz1 * cosB;

        // Projection: perspective divide
        const depth = sz2 + K2;
        if (depth <= 0) continue;

        const ooz = 1 / depth;

        // Screen coords — centre Y drifts with scroll for parallax
        const scrollOffset = (window.scrollY || 0) * CONFIG.parallaxFactor;
        const px = Math.round(canvas.width  * 0.5 + K1 * sx2 * ooz);
        const py = Math.round(canvas.height * 0.5 - scrollOffset - K1 * sy2 * ooz);

        // Convert pixel → grid cell
        const col = Math.floor(px / CONFIG.cellW);
        const row = Math.floor(py / CONFIG.cellH);

        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

        const idx = row * cols + col;

        // Z-buffer test
        if (ooz <= zbuf[idx]) continue;
        zbuf[idx] = ooz;

        // Luminance: dot(rotated normal, light direction)
        const lum = nx2 * LX + ny2 * LY + nz2 * LZ;
        lumbuf[idx] = lum;

        // Map luminance to character ramp index (clamp to [0, rampLen])
        const ci = Math.max(0, Math.min(rampLen, Math.floor((lum * 0.5 + 0.5) * rampLen)));
        output[idx] = ci;
      }
    }

    // ── Draw to canvas ────────────────────────────────────────────────────
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${CONFIG.cellH - 2}px var(--font-jetbrains-mono, 'JetBrains Mono', monospace)`;
    ctx.textBaseline = 'top';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (zbuf[idx] === 0) continue; // empty cell

        const ci  = output[idx];
        const lum = lumbuf[idx];
        const ch  = charRamp[ci];
        if (ch === ' ') continue;

        // Brighter cells → sky-blue tint; others → mist
        let opacity;
        if (lum > CONFIG.accentThreshold) {
          const t = (lum - CONFIG.accentThreshold) / (1 - CONFIG.accentThreshold);
          opacity = CONFIG.baseOpacity + t * 0.09;
          ctx.fillStyle = `rgba(${CONFIG.accentColor}, ${opacity.toFixed(3)})`;
        } else {
          // Scale opacity with luminance so back-face is darker
          opacity = CONFIG.baseOpacity * Math.max(0.3, (lum + 1) * 0.5);
          ctx.fillStyle = `rgba(${CONFIG.baseColor}, ${opacity.toFixed(3)})`;
        }

        ctx.fillText(ch, col * CONFIG.cellW, row * CONFIG.cellH);
      }
    }

    // Advance rotation
    A += CONFIG.speedA;
    B += CONFIG.speedB;
  }

  // ─── Animation loop ───────────────────────────────────────────────────────
  function loop() {
    frame();
    raf = requestAnimationFrame(loop);
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.AsciiSphere = { init, destroy };

  // Auto-init if a canvas#ascii-hero exists
  document.addEventListener('DOMContentLoaded', function () {
    const el = document.getElementById('ascii-hero');
    if (el) AsciiSphere.init(el);
  });

})();
