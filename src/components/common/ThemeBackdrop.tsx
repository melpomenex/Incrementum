import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettingsStore } from "../../stores/settingsStore";

/* ------------------------------------------------------------------ */
/*  Animation type registry – each key is a self-contained renderer   */
/* ------------------------------------------------------------------ */

type AnimCtx = {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Particle-count multiplier (0.25–2). Animations should multiply their base count by this. */
  density: number;
  /** Register a timer that will be cleaned up on stop */
  timer: (id: number) => void;
  /** Register a resize listener (auto-cleaned) */
  onResize: (fn: () => void) => void;
  /** Call this with your rAF id each frame */
  frame: (id: number) => void;
};

type AnimFn = (a: AnimCtx) => void;

const _ANIM: Record<string, AnimFn> = {
  /* ── rain ──────────────────────────────────────────────────── */
  rain({ cv, ctx, density, timer, frame }) {
    const drops: { x: number; y: number; len: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < Math.round(150 * density); i++)
      drops.push({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        len: Math.random() * 15 + 8,
        speed: Math.random() * 4 + 6,
        opacity: Math.random() * 0.54 + 0.18,
      });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const d of drops) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 1, d.y + d.len);
        ctx.strokeStyle = `rgba(180,200,220,${d.opacity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        d.y += d.speed;
        d.x += 0.3;
        if (d.y > cv.height) { d.y = -d.len; d.x = Math.random() * cv.width; }
      }
      frame(requestAnimationFrame(draw));
    })();
    timer(window.setInterval(() => {
      if (Math.random() < 0.3) {
        const flash = document.createElement("div");
        flash.className = "anim-flash";
        flash.style.cssText = "position:fixed;inset:0;background:rgba(200,220,255,0.18);z-index:0;pointer-events:none;transition:opacity .15s;";
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = "0"; }, 80);
        setTimeout(() => {
          flash.remove();
          if (Math.random() < 0.5) {
            const f2 = document.createElement("div");
            f2.className = "anim-flash";
            f2.style.cssText = "position:fixed;inset:0;background:rgba(200,220,255,0.12);z-index:0;pointer-events:none;transition:opacity .2s;";
            document.body.appendChild(f2);
            setTimeout(() => { f2.style.opacity = "0"; }, 60);
            setTimeout(() => f2.remove(), 300);
          }
        }, 150);
      }
    }, 8000));
  },

  /* ── deepspace ─────────────────────────────────────────────── */
  deepspace({ cv, ctx, density, timer, frame }) {
    const stars: { x: number; y: number; r: number; speed: number; tw: number }[] = [];
    for (let i = 0; i < Math.round(200 * density); i++)
      stars.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.2 + 0.05, tw: Math.random() * Math.PI * 2 });
    const shooters: { x: number; y: number; len: number; speed: number; a: number }[] = [];
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) {
        s.tw += 0.02;
        const a = Math.min(1, 0.9 + Math.sin(s.tw) * 0.6);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,210,240,${a})`; ctx.fill();
        s.x -= s.speed;
        if (s.x < 0) { s.x = cv.width; s.y = Math.random() * cv.height; }
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.len, sh.y - sh.len * 0.3);
        ctx.strokeStyle = `rgba(255,255,255,${sh.a})`; ctx.lineWidth = 1.2; ctx.stroke();
        sh.x += sh.speed; sh.y += sh.speed * 0.3; sh.a -= 0.01;
        if (sh.a <= 0) shooters.splice(i, 1);
      }
      frame(requestAnimationFrame(draw));
    })();
    timer(window.setInterval(() => {
      if (Math.random() < 0.4) shooters.push({ x: Math.random() * cv.width * 0.5, y: Math.random() * cv.height * 0.3, len: 40 + Math.random() * 40, speed: 6 + Math.random() * 4, a: 0.7 });
    }, 3000));
  },

  /* ── snowfall ──────────────────────────────────────────────── */
  snowfall({ cv, ctx, density, frame }) {
    const flakes: { x: number; y: number; r: number; speed: number; w: number; ws: number; opacity: number }[] = [];
    for (let i = 0; i < Math.round(120 * density); i++)
      flakes.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 2.5 + 0.8, speed: Math.random() * 1 + 0.5, w: Math.random() * Math.PI * 2, ws: Math.random() * 0.02 + 0.01, opacity: Math.random() * 0.6 + 0.3 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const f of flakes) {
        f.w += f.ws; f.x += Math.sin(f.w) * 0.5; f.y += f.speed;
        if (f.y > cv.height + 5) { f.y = -5; f.x = Math.random() * cv.width; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,230,255,${f.opacity})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── fireflies ─────────────────────────────────────────────── */
  fireflies({ cv, ctx, density, frame }) {
    const flies: { x: number; y: number; vx: number; vy: number; phase: number; r: number }[] = [];
    for (let i = 0; i < Math.round(50 * density); i++)
      flies.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, phase: Math.random() * Math.PI * 2, r: Math.random() * 2 + 1 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const f of flies) {
        f.phase += 0.03;
        const a = 0.3 + Math.sin(f.phase) * 0.45;
        f.x += f.vx; f.y += f.vy;
        if (f.x < 0 || f.x > cv.width) f.vx *= -1;
        if (f.y < 0 || f.y > cv.height) f.vy *= -1;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 4);
        g.addColorStop(0, `rgba(180,220,60,${Math.min(1, a + 0.45)})`); g.addColorStop(1, "rgba(180,220,60,0)");
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 4, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,240,80,${Math.min(1, a + 0.6)})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── aurora ────────────────────────────────────────────────── */
  aurora({ cv, ctx, frame }) {
    let t = 0;
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); t += 0.005;
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        const yB = cv.height * 0.15 + b * 50; ctx.moveTo(0, yB);
        for (let x = 0; x <= cv.width; x += 4) {
          const y = yB + Math.sin(x * 0.003 + t + b * 2) * 40 + Math.sin(x * 0.007 + t * 1.5) * 20;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(cv.width, cv.height); ctx.lineTo(0, cv.height); ctx.closePath();
        ctx.fillStyle = ["rgba(40,220,160,0.09)", "rgba(80,120,220,0.09)", "rgba(160,60,200,0.075)"][b]; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── digitalrain ───────────────────────────────────────────── */
  digitalrain({ cv, ctx, frame }) {
    const cols = Math.floor(cv.width / 14);
    const ypos = Array.from({ length: cols }, () => Math.random() * cv.height);
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    const buf = document.createElement("canvas"); buf.width = cv.width; buf.height = cv.height;
    const bctx = buf.getContext("2d")!;
    (function draw() {
      bctx.fillStyle = "rgba(0,0,0,0.05)"; bctx.fillRect(0, 0, buf.width, buf.height);
      bctx.font = "13px monospace";
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        bctx.fillStyle = `rgba(0,${180 + Math.random() * 75},0,0.95)`;
        bctx.fillText(ch, i * 14, ypos[i]); ypos[i] += 14;
        if (ypos[i] > buf.height && Math.random() > 0.98) ypos[i] = 0;
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 0.9; ctx.drawImage(buf, 0, 0); ctx.globalAlpha = 1;
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── neongrid ──────────────────────────────────────────────── */
  neongrid({ cv, ctx, frame }) {
    let offset = 0;
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); offset = (offset + 0.5) % 50;
      const horizon = cv.height * 0.4; const cx = cv.width / 2;
      for (let i = 0; i < 15; i++) {
        const t = (i * 50 + offset) / 750;
        const y = horizon + Math.pow(t, 1.5) * (cv.height - horizon) * 1.2;
        if (y > cv.height) continue;
        const a = Math.min(0.45, t * 0.9);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y);
        ctx.strokeStyle = `rgba(0,200,255,${a})`; ctx.lineWidth = 0.8; ctx.stroke();
      }
      for (let i = -10; i <= 10; i++) {
        const x = cx + i * cv.width * 0.15;
        ctx.beginPath(); ctx.moveTo(cx, horizon); ctx.lineTo(x, cv.height);
        ctx.strokeStyle = `rgba(0,200,255,${Math.min(0.24 + Math.abs(i) * 0.015, 0.45)})`; ctx.lineWidth = 0.6; ctx.stroke();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── underwater ────────────────────────────────────────────── */
  underwater({ cv, ctx, density, frame }) {
    const bubbles: { x: number; y: number; r: number; speed: number; w: number }[] = [];
    for (let i = 0; i < Math.round(60 * density); i++)
      bubbles.push({ x: Math.random() * cv.width, y: cv.height + Math.random() * cv.height, r: Math.random() * 4 + 1, speed: Math.random() * 1.5 + 0.3, w: Math.random() * Math.PI * 2 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const b of bubbles) {
        b.w += 0.02; b.x += Math.sin(b.w) * 0.3; b.y -= b.speed;
        if (b.y < -10) { b.y = cv.height + 10; b.x = Math.random() * cv.width; }
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100,200,230,${Math.min(1, 0.45 + b.r * 0.09)})`; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150,220,240,${Math.min(1, 0.3 + b.r * 0.06)})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── cherryblossom ─────────────────────────────────────────── */
  cherryblossom({ cv, ctx, density, frame }) {
    const petals: { x: number; y: number; r: number; speed: number; drift: number; rot: number; rs: number; opacity: number }[] = [];
    for (let i = 0; i < Math.round(80 * density); i++)
      petals.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 4 + 2, speed: Math.random() * 1 + 0.3, drift: Math.random() * 0.5 + 0.2, rot: Math.random() * Math.PI * 2, rs: Math.random() * 0.03 + 0.01, opacity: Math.random() * 0.6 + 0.15 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of petals) {
        p.y += p.speed; p.x += p.drift + Math.sin(p.rot) * 0.3; p.rot += p.rs;
        if (p.y > cv.height + 10) { p.y = -10; p.x = Math.random() * cv.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,180,200,${p.opacity})`; ctx.fill();
        ctx.restore();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── starwarp ──────────────────────────────────────────────── */
  starwarp({ cv, ctx, density, frame }) {
    const stars: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < Math.round(200 * density); i++)
      stars.push({ x: (Math.random() - 0.5) * cv.width, y: (Math.random() - 0.5) * cv.height, z: Math.random() * 1000 + 1 });
    const buf = document.createElement("canvas"); buf.width = cv.width; buf.height = cv.height;
    const bctx = buf.getContext("2d")!;
    (function draw() {
      bctx.fillStyle = "rgba(0,0,4,0.15)"; bctx.fillRect(0, 0, buf.width, buf.height);
      const cx = cv.width / 2, cy = cv.height / 2;
      for (const s of stars) {
        s.z -= 3;
        if (s.z <= 0) { s.x = (Math.random() - 0.5) * cv.width; s.y = (Math.random() - 0.5) * cv.height; s.z = 1000; }
        const sx = cx + s.x * (500 / s.z), sy = cy + s.y * (500 / s.z);
        const r = Math.max(0.3, (1 - s.z / 1000) * 2);
        bctx.beginPath(); bctx.arc(sx, sy, r, 0, Math.PI * 2);
        bctx.fillStyle = `rgba(200,210,255,${Math.min(1, 1 - s.z / 1000)})`; bctx.fill();
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 0.9; ctx.drawImage(buf, 0, 0); ctx.globalAlpha = 1;
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── ember ─────────────────────────────────────────────────── */
  ember({ cv, ctx, density, frame }) {
    const sparks: { x: number; y: number; vx: number; vy: number; life: number; r: number }[] = [];
    for (let i = 0; i < Math.round(70 * density); i++)
      sparks.push({ x: Math.random() * cv.width, y: cv.height + Math.random() * 100, vx: (Math.random() - 0.5) * 0.5, vy: -(Math.random() * 1.5 + 0.5), life: Math.random(), r: Math.random() * 2 + 0.5 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of sparks) {
        s.x += s.vx + Math.sin(s.life * 10) * 0.2; s.y += s.vy; s.life -= 0.003;
        if (s.life <= 0 || s.y < -10) { s.x = Math.random() * cv.width; s.y = cv.height + 10; s.life = 1; s.vx = (Math.random() - 0.5) * 0.5; s.vy = -(Math.random() * 1.5 + 0.5); }
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3);
        g.addColorStop(0, `rgba(255,${120 + Math.random() * 40},20,${Math.min(1, s.life * 0.9)})`); g.addColorStop(1, "rgba(255,100,0,0)");
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── nebula ────────────────────────────────────────────────── */
  nebula({ cv, ctx, density, frame }) {
    const clouds: { x: number; y: number; r: number; vx: number; vy: number; hue: number; phase: number }[] = [];
    for (let i = 0; i < Math.round(40 * density); i++) {
      const hue = Math.random() * 360;
      clouds.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 60 + 20, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, hue, phase: Math.random() * Math.PI * 2 });
    }
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const c of clouds) {
        c.phase += 0.008; c.x += c.vx; c.y += c.vy;
        if (c.x < -c.r) c.x = cv.width + c.r; if (c.x > cv.width + c.r) c.x = -c.r;
        if (c.y < -c.r) c.y = cv.height + c.r; if (c.y > cv.height + c.r) c.y = -c.r;
        const a = 0.06 + Math.sin(c.phase) * 0.03;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        g.addColorStop(0, `hsla(${c.hue},60%,50%,${Math.min(1, a + 0.06)})`); g.addColorStop(1, `hsla(${c.hue},60%,50%,0)`);
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── confetti ──────────────────────────────────────────────── */
  confetti({ cv, ctx, density, frame }) {
    const colors = ["#ff4466", "#44ff66", "#4488ff", "#ffaa00", "#ff44ff", "#44ffff", "#ffff44"];
    const pieces: { x: number; y: number; w: number; h: number; rot: number; rs: number; speed: number; drift: number; color: string; opacity: number }[] = [];
    for (let i = 0; i < Math.round(80 * density); i++)
      pieces.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, w: Math.random() * 6 + 3, h: Math.random() * 4 + 2, rot: Math.random() * Math.PI * 2, rs: (Math.random() - 0.5) * 0.08, speed: Math.random() * 1.5 + 0.5, drift: Math.random() * 0.5 - 0.25, color: colors[Math.floor(Math.random() * colors.length)], opacity: Math.random() * 0.6 + 0.15 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of pieces) {
        p.y += p.speed; p.x += p.drift; p.rot += p.rs;
        if (p.y > cv.height + 10) { p.y = -10; p.x = Math.random() * cv.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.globalAlpha = 1; ctx.restore();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── campfire ──────────────────────────────────────────────── */
  campfire({ cv, ctx, density, frame }) {
    const embers: { x: number; ox: number; y: number; vy: number; life: number; r: number; w: number }[] = [];
    for (let i = 0; i < Math.round(90 * density); i++) {
      const x = cv.width * 0.3 + Math.random() * cv.width * 0.4;
      embers.push({ x, ox: x, y: cv.height + Math.random() * 50, vy: -(Math.random() * 1.2 + 0.3), life: Math.random(), r: Math.random() * 2 + 0.5, w: Math.random() * Math.PI * 2 });
    }
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const glow = ctx.createRadialGradient(cv.width / 2, cv.height, 0, cv.width / 2, cv.height, cv.height * 0.4);
      glow.addColorStop(0, "rgba(255,100,20,0.09)"); glow.addColorStop(1, "rgba(255,60,0,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, cv.width, cv.height);
      for (const e of embers) {
        e.w += 0.03; e.x = e.ox + Math.sin(e.w) * 20; e.y += e.vy; e.life -= 0.002;
        if (e.life <= 0 || e.y < -10) { e.ox = cv.width * 0.3 + Math.random() * cv.width * 0.4; e.x = e.ox; e.y = cv.height + 10; e.life = 1; }
        const r = e.r * e.life;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${80 + e.life * 100},${e.life * 30},${Math.min(1, e.life * 0.75)})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── oceanwaves ────────────────────────────────────────────── */
  oceanwaves({ cv, ctx, frame }) {
    let t = 0;
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); t += 0.02;
      for (let w = 0; w < 4; w++) {
        ctx.beginPath();
        const yB = cv.height * 0.65 + w * 30; ctx.moveTo(0, cv.height);
        for (let x = 0; x <= cv.width; x += 3) {
          const y = yB + Math.sin(x * 0.005 + t + w * 1.5) * 15 + Math.sin(x * 0.01 + t * 0.7) * 8;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(cv.width, cv.height); ctx.closePath();
        ctx.fillStyle = `rgba(20,80,140,${0.06 + w * 0.015})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── plasma ────────────────────────────────────────────────── */
  plasma({ cv, ctx, frame }) {
    let t = 0;
    const bw = Math.ceil(cv.width / 4), bh = Math.ceil(cv.height / 4);
    const buf = document.createElement("canvas"); buf.width = bw; buf.height = bh;
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(bw, bh);
    (function draw() {
      t += 0.02;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const v = Math.sin(x * 0.05 + t) + Math.sin(y * 0.05 + t * 0.7) + Math.sin((x + y) * 0.03 + t * 0.5) + Math.sin(Math.sqrt(x * x + y * y) * 0.04);
          const idx = (y * bw + x) * 4;
          img.data[idx] = (Math.sin(v * Math.PI) * 0.5 + 0.5) * 120;
          img.data[idx + 1] = (Math.sin(v * Math.PI + 2) * 0.5 + 0.5) * 90;
          img.data[idx + 2] = (Math.sin(v * Math.PI + 4) * 0.5 + 0.5) * 150;
          img.data[idx + 3] = 60;
        }
      }
      bctx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(buf, 0, 0, cv.width, cv.height);
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── alien ─────────────────────────────────────────────────── */
  alien({ cv, ctx, density, frame }) {
    const stars: { x: number; y: number; r: number; tw: number }[] = [];
    for (let i = 0; i < Math.round(100 * density); i++) stars.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.2 + 0.3, tw: Math.random() * Math.PI * 2 });
    const ufos: { x: number; y: number; vx: number; w: number; bob: number; beamOn: boolean; beamTimer: number }[] = [];
    for (let i = 0; i < Math.max(1, Math.round(3 * density)); i++) ufos.push({ x: Math.random() * cv.width, y: 40 + Math.random() * cv.height * 0.25, vx: (Math.random() - 0.5) * 1.2, w: 40 + Math.random() * 20, bob: Math.random() * Math.PI * 2, beamOn: false, beamTimer: 0 });
    const sheep: { x: number; y: number; vx: number; abducted: boolean; abY: number; phase: number; dir: number }[] = [];
    for (let i = 0; i < Math.max(1, Math.round(5 * density)); i++) sheep.push({ x: Math.random() * cv.width, y: cv.height - 30 - Math.random() * 20, vx: (Math.random() - 0.5) * 0.6, abducted: false, abY: 0, phase: Math.random() * Math.PI * 2, dir: Math.random() > 0.5 ? 1 : -1 });
    let t = 0;
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); t += 0.02;
      for (const s of stars) { s.tw += 0.015; const a = Math.min(1, 0.6 + Math.sin(s.tw) * 0.45); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(150,220,180,${a})`; ctx.fill(); }
      for (const sh of sheep) {
        if (!sh.abducted) {
          sh.phase += 0.04; sh.x += sh.vx;
          if (sh.x < 20 || sh.x > cv.width - 20) { sh.vx *= -1; sh.dir *= -1; }
          const bx = sh.x, by = sh.y + Math.sin(sh.phase);
          ctx.fillStyle = "rgba(220,220,210,0.45)"; ctx.beginPath(); ctx.ellipse(bx, by, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(bx - 4, by - 3, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(bx + 4, by - 3, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(180,180,170,0.54)"; ctx.beginPath(); ctx.arc(bx + sh.dir * 8, by - 1, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(200,200,190,0.36)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx - 4, by + 5); ctx.lineTo(bx - 4, by + 10); ctx.moveTo(bx + 4, by + 5); ctx.lineTo(bx + 4, by + 10); ctx.stroke();
        } else {
          sh.abY -= 0.8; const bx = sh.x, by = sh.y + sh.abY;
          if (by < -20) { sh.abducted = false; sh.abY = 0; sh.x = Math.random() * cv.width; sh.y = cv.height - 30 - Math.random() * 20; }
          ctx.fillStyle = `rgba(100,255,150,${Math.min(1, 0.45 + Math.sin(t * 5) * 0.15)})`;
          ctx.beginPath(); ctx.ellipse(bx, by, 8, 6, Math.sin(t * 3) * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(bx - 4, by - 3, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(bx + 4, by - 3, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const u of ufos) {
        u.bob += 0.03; u.x += u.vx; u.y += Math.sin(u.bob) * 0.3;
        if (u.x < -60) u.x = cv.width + 60; if (u.x > cv.width + 60) u.x = -60;
        u.beamTimer--;
        if (u.beamTimer <= 0) { u.beamOn = Math.random() < 0.02; if (u.beamOn) u.beamTimer = 200 + Math.random() * 150; }
        const ux = u.x, uy = u.y;
        const gl = ctx.createRadialGradient(ux, uy + 6, 0, ux, uy + 6, u.w * 0.6);
        gl.addColorStop(0, "rgba(80,255,120,0.18)"); gl.addColorStop(1, "rgba(80,255,120,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(ux, uy + 6, u.w * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(120,255,180,0.36)"; ctx.beginPath(); ctx.ellipse(ux, uy - 5, u.w * 0.25, 8, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "rgba(60,180,100,0.45)"; ctx.beginPath(); ctx.ellipse(ux, uy, u.w * 0.5, 6, 0, 0, Math.PI * 2); ctx.fill();
        for (let li = 0; li < 5; li++) {
          const la = li / 5 * Math.PI * 2 + t * 2;
          const lx = ux + Math.cos(la) * u.w * 0.4, ly = uy + Math.sin(la) * 3;
          ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${li % 2 ? "255,100,100" : "100,255,100"},${Math.min(1, 0.6 + Math.sin(t * 4 + li) * 0.3)})`; ctx.fill();
        }
        if (u.beamOn) {
          const beamW = u.w * 0.3;
          const grd = ctx.createLinearGradient(ux, uy + 8, ux, cv.height);
          grd.addColorStop(0, "rgba(80,255,120,0.24)"); grd.addColorStop(0.5, "rgba(80,255,120,0.12)"); grd.addColorStop(1, "rgba(80,255,120,0)");
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.moveTo(ux - beamW * 0.5, uy + 8); ctx.lineTo(ux - beamW * 1.5, cv.height); ctx.lineTo(ux + beamW * 1.5, cv.height); ctx.lineTo(ux + beamW * 0.5, uy + 8); ctx.closePath(); ctx.fill();
          for (const sh of sheep) { if (!sh.abducted && Math.abs(sh.x - ux) < beamW * 2 && sh.y > uy) { sh.abducted = true; sh.abY = 0; } }
        }
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── lightning ─────────────────────────────────────────────── */
  lightning({ cv, ctx, density, timer, frame }) {
    const bolts: { segs: { x: number; y: number }[]; a: number }[] = [];
    const drops: { x: number; y: number; len: number; speed: number }[] = [];
    for (let i = 0; i < Math.round(80 * density); i++) drops.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, len: Math.random() * 10 + 5, speed: Math.random() * 3 + 4 });
    function mkBolt() {
      const segs: { x: number; y: number }[] = []; let cx = Math.random() * cv.width, cy = 0;
      for (let i = 0; i < 10; i++) { cx += (Math.random() - 0.5) * 60; cy += cv.height / 10; segs.push({ x: cx, y: cy }); }
      return { segs, a: 0.7 };
    }
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const d of drops) {
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 0.5, d.y + d.len);
        ctx.strokeStyle = "rgba(160,170,200,0.18)"; ctx.lineWidth = 0.6; ctx.stroke();
        d.y += d.speed; if (d.y > cv.height) { d.y = -d.len; d.x = Math.random() * cv.width; }
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        ctx.beginPath(); ctx.moveTo(b.segs[0].x, 0);
        for (const s of b.segs) ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = `rgba(180,180,255,${b.a})`; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = `rgba(220,220,255,${b.a * 0.4})`; ctx.lineWidth = 6; ctx.stroke();
        b.a -= 0.025; if (b.a <= 0) bolts.splice(i, 1);
      }
      frame(requestAnimationFrame(draw));
    })();
    timer(window.setInterval(() => {
      if (Math.random() < 0.3) {
        bolts.push(mkBolt());
        const fl = document.createElement("div");
        fl.className = "anim-flash";
        fl.style.cssText = "position:fixed;inset:0;background:rgba(180,180,255,0.15);z-index:0;pointer-events:none;transition:opacity .15s;";
        document.body.appendChild(fl);
        setTimeout(() => { fl.style.opacity = "0"; }, 80);
        setTimeout(() => fl.remove(), 300);
      }
    }, 5000));
  },

  /* ── sandstorm ─────────────────────────────────────────────── */
  sandstorm({ cv, ctx, density, frame }) {
    const grains: { x: number; y: number; r: number; speed: number; vy: number; o: number }[] = [];
    for (let i = 0; i < Math.round(200 * density); i++)
      grains.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.5 + 0.3, speed: Math.random() * 3 + 1, vy: (Math.random() - 0.5) * 0.5, o: Math.random() * 0.45 + 0.09 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const g of grains) {
        g.x += g.speed; g.y += g.vy + Math.sin(g.x * 0.01) * 0.3;
        if (g.x > cv.width + 5) { g.x = -5; g.y = Math.random() * cv.height; }
        if (g.y < 0) g.y = cv.height; if (g.y > cv.height) g.y = 0;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,180,140,${g.o})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── hologram ──────────────────────────────────────────────── */
  hologram({ cv, ctx, density, frame }) {
    let offset = 0;
    const lines: { y: number; speed: number; h: number; o: number }[] = [];
    for (let i = 0; i < Math.round(30 * density); i++) lines.push({ y: Math.random() * cv.height, speed: Math.random() * 1 + 0.5, h: Math.random() * 2 + 1, o: Math.random() * 0.18 + 0.06 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); offset += 0.5;
      for (const l of lines) {
        l.y += l.speed; if (l.y > cv.height) l.y = -l.h;
        ctx.fillStyle = `rgba(0,238,255,${l.o})`; ctx.fillRect(0, l.y, cv.width, l.h);
      }
      for (let y = 0; y < cv.height; y += 3) {
        ctx.fillStyle = `rgba(0,238,255,${0.024 + Math.sin((y + offset) * 0.1) * 0.012})`; ctx.fillRect(0, y, cv.width, 1);
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── meteorshower ──────────────────────────────────────────── */
  meteorshower({ cv, ctx, density, timer, frame }) {
    const stars: { x: number; y: number; r: number; tw: number }[] = [];
    for (let i = 0; i < Math.round(100 * density); i++) stars.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() + 0.3, tw: Math.random() * Math.PI * 2 });
    function mk() { return { x: Math.random() * cv.width * 1.5, y: -20 - Math.random() * 100, speed: Math.random() * 6 + 4, len: Math.random() * 60 + 30, angle: Math.PI * 0.7 + Math.random() * 0.2, a: Math.random() * 0.4 + 0.3 }; }
    const meteors: ReturnType<typeof mk>[] = [];
    for (let i = 0; i < Math.max(1, Math.round(4 * density)); i++) meteors.push(mk());
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) { s.tw += 0.01; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(200,200,240,${0.45 + Math.sin(s.tw) * 0.3})`; ctx.fill(); }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += Math.cos(m.angle) * m.speed; m.y += Math.sin(m.angle) * m.speed;
        const tx = m.x - Math.cos(m.angle) * m.len, ty = m.y - Math.sin(m.angle) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, `rgba(255,200,100,${m.a})`); g.addColorStop(1, "rgba(255,200,100,0)");
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty);
        ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();
        if (m.y > cv.height + 50 || m.x < -100) meteors[i] = mk();
      }
      frame(requestAnimationFrame(draw));
    })();
    timer(window.setInterval(() => { if (meteors.length < 8 && Math.random() < 0.4) meteors.push(mk()); }, 2000));
  },

  /* ── pixelrain ─────────────────────────────────────────────── */
  pixelrain({ cv, ctx, density, frame }) {
    const colors = ["#44dd88", "#22cc66", "#66eebb", "#33bb77", "#55ffaa"];
    const pixels: { x: number; y: number; s: number; speed: number; color: string; o: number }[] = [];
    for (let i = 0; i < Math.round(100 * density); i++)
      pixels.push({ x: Math.floor(Math.random() * cv.width / 8) * 8, y: Math.random() * cv.height, s: Math.floor(Math.random() * 3 + 2) * 2, speed: Math.random() * 2 + 0.5, color: colors[Math.floor(Math.random() * colors.length)], o: Math.random() * 0.6 + 0.15 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of pixels) {
        p.y += p.speed; if (p.y > cv.height) { p.y = -p.s; p.x = Math.floor(Math.random() * cv.width / 8) * 8; }
        ctx.globalAlpha = p.o; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── synthsun ──────────────────────────────────────────────── */
  synthsun({ cv, ctx, frame }) {
    let t = 0;
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); t += 0.01;
      const cx = cv.width / 2, sunY = cv.height * 0.65, sunR = 80;
      const sg = ctx.createRadialGradient(cx, sunY, 0, cx, sunY, sunR);
      sg.addColorStop(0, "rgba(255,60,120,0.24)"); sg.addColorStop(0.5, "rgba(255,120,50,0.12)"); sg.addColorStop(1, "rgba(255,60,120,0)");
      ctx.beginPath(); ctx.arc(cx, sunY, sunR, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
      for (let i = 0; i < 8; i++) {
        const y = sunY - sunR + i * (sunR * 2 / 8) + ((t * 20) % (sunR * 2 / 8));
        if (y > sunY - sunR && y < sunY + sunR) { ctx.fillStyle = "rgba(14,4,26,0.4)"; ctx.fillRect(cx - sunR, y, sunR * 2, 2); }
      }
      const hz = cv.height * 0.65;
      for (let i = 0; i < 12; i++) {
        const ft = (i * 40 + (t * 40) % 40) / 500;
        const y = hz + Math.pow(ft, 1.3) * (cv.height - hz) * 1.5;
        if (y > cv.height) continue;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y);
        ctx.strokeStyle = `rgba(255,60,180,${Math.min(0.24, ft * 0.6)})`; ctx.lineWidth = 0.6; ctx.stroke();
      }
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(cx, hz); ctx.lineTo(cx + i * cv.width * 0.15, cv.height);
        ctx.strokeStyle = "rgba(255,60,180,0.18)"; ctx.lineWidth = 0.5; ctx.stroke();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── toxicrain ─────────────────────────────────────────────── */
  toxicrain({ cv, ctx, density, frame }) {
    const drops: { x: number; y: number; len: number; speed: number; o: number }[] = [];
    for (let i = 0; i < Math.round(120 * density); i++)
      drops.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, len: Math.random() * 12 + 6, speed: Math.random() * 4 + 3, o: Math.random() * 0.36 + 0.12 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const d of drops) {
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 0.5, d.y + d.len);
        ctx.strokeStyle = `rgba(100,255,40,${d.o})`; ctx.lineWidth = 0.8; ctx.stroke();
        d.y += d.speed; if (d.y > cv.height) { d.y = -d.len; d.x = Math.random() * cv.width; }
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── fairydust ─────────────────────────────────────────────── */
  fairydust({ cv, ctx, density, frame }) {
    const colorBases = ["rgba(255,220,100,", "rgba(220,180,255,", "rgba(180,220,255,", "rgba(255,180,220,"];
    const sparks: { x: number; y: number; r: number; ph: number; vx: number; vy: number; ci: number }[] = [];
    for (let i = 0; i < Math.round(60 * density); i++)
      sparks.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 2 + 0.5, ph: Math.random() * Math.PI * 2, vx: (Math.random() - 0.5) * 0.3, vy: -(Math.random() * 0.3 + 0.1), ci: Math.floor(Math.random() * 4) });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of sparks) {
        s.ph += 0.04; s.x += s.vx + Math.sin(s.ph) * 0.3; s.y += s.vy;
        if (s.y < -10) { s.y = cv.height + 10; s.x = Math.random() * cv.width; }
        const a = 0.3 + Math.sin(s.ph) * 0.36;
        const c = colorBases[s.ci];
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3);
        g.addColorStop(0, c + Math.min(1, a + 0.3) + ")"); g.addColorStop(1, c + "0)");
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = c + Math.min(1, a + 0.45) + ")"; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── comettrail ────────────────────────────────────────────── */
  comettrail({ cv, ctx, density, frame }) {
    const stars: { x: number; y: number; r: number; tw: number }[] = [];
    for (let i = 0; i < Math.round(80 * density); i++) stars.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() + 0.2, tw: Math.random() * Math.PI * 2 });
    function mk() { return { x: -50 - Math.random() * 100, y: Math.random() * cv.height * 0.6, speed: Math.random() * 2 + 1.5, a: Math.random() * 0.3 + 0.2, trail: [] as { x: number; y: number }[] }; }
    const comets: ReturnType<typeof mk>[] = [];
    for (let i = 0; i < Math.max(1, Math.round(4 * density)); i++) comets.push(mk());
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) { s.tw += 0.01; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(180,200,240,${0.45 + Math.sin(s.tw) * 0.3})`; ctx.fill(); }
      for (const c of comets) {
        c.x += c.speed; c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 30) c.trail.shift();
        for (let i = 0; i < c.trail.length; i++) {
          const t = c.trail[i], a = c.a * (i / c.trail.length);
          ctx.beginPath(); ctx.arc(t.x, t.y, 1.5 * (i / c.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(140,180,255,${a})`; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,230,255,${c.a})`; ctx.fill();
        if (c.x > cv.width + 100) Object.assign(c, mk());
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── lavalamp ──────────────────────────────────────────────── */
  lavalamp({ cv, ctx, density, frame }) {
    const blobs: { x: number; y: number; r: number; vx: number; vy: number; ph: number; hue: number }[] = [];
    for (let i = 0; i < Math.max(2, Math.round(6 * density)); i++)
      blobs.push({ x: cv.width * 0.2 + Math.random() * cv.width * 0.6, y: cv.height * 0.3 + Math.random() * cv.height * 0.4, r: Math.random() * 60 + 30, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, ph: Math.random() * Math.PI * 2, hue: Math.random() * 40 + 10 });
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const b of blobs) {
        b.ph += 0.008; b.x += b.vx + Math.sin(b.ph) * 0.5; b.y += b.vy + Math.cos(b.ph * 0.7) * 0.3;
        if (b.x < b.r || b.x > cv.width - b.r) b.vx *= -1;
        if (b.y < b.r || b.y > cv.height - b.r) b.vy *= -1;
        const r = b.r + Math.sin(b.ph * 2) * 10;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
        g.addColorStop(0, `hsla(${b.hue},80%,50%,0.12)`);
        g.addColorStop(0.6, `hsla(${b.hue},80%,40%,0.06)`);
        g.addColorStop(1, `hsla(${b.hue},80%,30%,0)`);
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── electricarc ───────────────────────────────────────────── */
  electricarc({ cv, ctx, density, timer, frame }) {
    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < Math.max(2, Math.round(8 * density)); i++) nodes.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8 });
    const arcs: { p: { x: number; y: number }[]; a: number }[] = [];
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > cv.width) n.vx *= -1;
        if (n.y < 0 || n.y > cv.height) n.vy *= -1;
        ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(68,170,255,0.45)"; ctx.fill();
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        ctx.beginPath(); ctx.moveTo(a.p[0].x, a.p[0].y);
        for (let j = 1; j < a.p.length; j++) ctx.lineTo(a.p[j].x, a.p[j].y);
        ctx.strokeStyle = `rgba(100,180,255,${a.a})`; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = `rgba(150,200,255,${a.a * 0.3})`; ctx.lineWidth = 4; ctx.stroke();
        a.a -= 0.02; if (a.a <= 0) arcs.splice(i, 1);
      }
      frame(requestAnimationFrame(draw));
    })();
    timer(window.setInterval(() => {
      if (arcs.length < 3 && nodes.length >= 2) {
        const a = nodes[Math.floor(Math.random() * nodes.length)], b = nodes[Math.floor(Math.random() * nodes.length)];
        if (a !== b) {
          const p = [{ x: a.x, y: a.y }]; let cx = a.x, cy = a.y;
          for (let i = 1; i <= 8; i++) { cx += (b.x - a.x) / 8 + (Math.random() - 0.5) * 40; cy += (b.y - a.y) / 8 + (Math.random() - 0.5) * 40; p.push({ x: cx, y: cy }); }
          arcs.push({ p, a: 0.9 });
        }
      }
    }, 500));
  },

  /* ── galaxy ────────────────────────────────────────────────── */
  galaxy({ cv, ctx, density, frame }) {
    const stars: { dist: number; angle: number; r: number; speed: number; hue: number }[] = [];
    const arms = 3;
    for (let i = 0; i < Math.round(250 * density); i++) {
      const arm = i % arms; const dist = Math.random() * Math.min(cv.width, cv.height) * 0.4;
      const angle = arm * (Math.PI * 2 / arms) + dist * 0.003 + Math.random() * 0.5;
      stars.push({ dist, angle, r: Math.random() * 1.2 + 0.3, speed: 0.0008 + Math.random() * 0.0004, hue: 200 + Math.random() * 60 });
    }
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const cx = cv.width / 2, cy = cv.height / 2;
      for (const s of stars) {
        s.angle += s.speed;
        const x = cx + Math.cos(s.angle) * s.dist, y = cy + Math.sin(s.angle) * s.dist * 0.6;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue},60%,70%,${Math.min(1, 0.45 + 0.3 * (1 - s.dist / (Math.min(cv.width, cv.height) * 0.4)))})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── glitch ────────────────────────────────────────────────── */
  glitch({ cv, ctx, frame }) {
    let f = 0;
    const colors = ["rgba(255,68,102,0.18)", "rgba(68,136,255,0.18)", "rgba(68,255,136,0.18)", "rgba(255,255,68,0.12)"];
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); f++;
      if (f % 3 === 0) {
        for (let i = 0; i < Math.floor(Math.random() * 4) + 1; i++) {
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, Math.random() * 100 + 20, Math.random() * 4 + 1);
        }
        if (Math.random() < 0.03) {
          const sy = Math.random() * cv.height, sh = Math.random() * 15 + 3;
          try { const strip = ctx.getImageData(0, sy, cv.width, sh); ctx.putImageData(strip, Math.random() * 20 - 10, sy); } catch (_) { /* ignore */ }
        }
      }
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── firewall ──────────────────────────────────────────────── */
  firewall({ cv, ctx, frame }) {
    const cols = Math.floor(cv.width / 10);
    const ypos = Array.from({ length: cols }, () => Math.random() * cv.height);
    const chars = "0123456789ABCDEF<>/{}[]|";
    const buf = document.createElement("canvas"); buf.width = cv.width; buf.height = cv.height;
    const bctx = buf.getContext("2d")!;
    (function draw() {
      bctx.fillStyle = "rgba(0,0,0,0.06)"; bctx.fillRect(0, 0, buf.width, buf.height);
      bctx.font = "9px monospace";
      for (let i = 0; i < cols; i++) {
        if (Math.random() > 0.3) continue;
        bctx.fillStyle = `rgba(255,${120 + Math.random() * 60},0,0.7)`;
        bctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 10, ypos[i]); ypos[i] += 10;
        if (ypos[i] > buf.height && Math.random() > 0.97) ypos[i] = 0;
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 0.75; ctx.drawImage(buf, 0, 0); ctx.globalAlpha = 1;
      frame(requestAnimationFrame(draw));
    })();
  },

  /* ── northern ──────────────────────────────────────────────── */
  northern({ cv, ctx, frame }) {
    let t = 0;
    const bands = [{ h: 140, y: 0.12, a: 50 }, { h: 180, y: 0.18, a: 40 }, { h: 280, y: 0.25, a: 35 }, { h: 160, y: 0.10, a: 55 }, { h: 220, y: 0.22, a: 30 }];
    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height); t += 0.006;
      for (const b of bands) {
        ctx.beginPath();
        const yB = cv.height * b.y; ctx.moveTo(0, yB);
        for (let x = 0; x <= cv.width; x += 3) {
          ctx.lineTo(x, yB + Math.sin(x * 0.003 + t + b.h * 0.01) * b.a + Math.sin(x * 0.008 + t * 1.3) * b.a * 0.5);
        }
        ctx.lineTo(cv.width, cv.height); ctx.lineTo(0, cv.height); ctx.closePath();
        ctx.fillStyle = `hsla(${b.h},60%,50%,${Math.min(1, 0.075 + Math.sin(t + b.h) * 0.03)})`; ctx.fill();
      }
      frame(requestAnimationFrame(draw));
    })();
  },
};

/* ------------------------------------------------------------------ */
/*  React component                                                    */
/* ------------------------------------------------------------------ */

export function ThemeBackdrop() {
  const { theme } = useTheme();
  const settings = useSettingsStore((s) => s.settings.interface);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const resizeFnRef = useRef<(() => void) | null>(null);
  const curTypeRef = useRef<string | null>(null);
  // Live-updated brightness ref so the frame callback reads current value each tick
  const brightnessRef = useRef(settings.animationBrightness);
  brightnessRef.current = settings.animationBrightness;
  const [suspended, setSuspended] = useState(false);

  const animation = theme.effects?.backgroundAnimation;
  const density = settings.animationFrequency;

  useEffect(() => {
    const handleSuspend = (event: Event) => {
      const customEvent = event as CustomEvent<{ suspended?: boolean }>;
      setSuspended(Boolean(customEvent.detail?.suspended));
    };

    window.addEventListener("incrementum-theme-backdrop-suspend", handleSuspend as EventListener);
    return () => {
      window.removeEventListener("incrementum-theme-backdrop-suspend", handleSuspend as EventListener);
    };
  }, []);

  const applyBrightnessGain = (
    ctx: CanvasRenderingContext2D,
    cv: HTMLCanvasElement,
    brightnessSetting: number
  ) => {
    const gain = Math.max(0.1, brightnessSetting / 10);
    const wholePasses = Math.floor(gain);
    const partialPass = gain - wholePasses;
    const prevOp = ctx.globalCompositeOperation;
    const prevA = ctx.globalAlpha;

    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < wholePasses; i += 1) {
      ctx.globalAlpha = 1;
      ctx.drawImage(cv, 0, 0);
    }

    if (partialPass > 0.001) {
      ctx.globalAlpha = partialPass;
      ctx.drawImage(cv, 0, 0);
    }

    ctx.globalAlpha = prevA;
    ctx.globalCompositeOperation = prevOp;
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !animation || suspended) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    // Stop previous
    if (animIdRef.current !== null) { cancelAnimationFrame(animIdRef.current); animIdRef.current = null; }
    timersRef.current.forEach(t => clearInterval(t)); timersRef.current = [];
    if (resizeFnRef.current) { window.removeEventListener("resize", resizeFnRef.current); resizeFnRef.current = null; }
    ctx.clearRect(0, 0, cv.width, cv.height);
    document.querySelectorAll(".anim-flash").forEach(e => e.remove());
    curTypeRef.current = animation;

    // Resize handler
    function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
    resize();
    resizeFnRef.current = resize;
    window.addEventListener("resize", resize);

    // Find matching animation function (exact match, or prefix match for backwards compat)
    let fn = _ANIM[animation];
    if (!fn) {
      // Fallback: try first matching key that starts with the animation name
      const keys = Object.keys(_ANIM);
      const match = keys.find(k => k.startsWith(animation) || animation.startsWith(k));
      if (match) fn = _ANIM[match];
    }
    if (!fn) return;

    fn({
      cv,
      ctx,
      density,
      timer(id: number) { timersRef.current.push(id); },
      onResize(fn: () => void) { resizeFnRef.current = fn; },
      frame(id: number) {
        // Brightness is stored in tenths (10 = 1.0x). Apply multiple additive passes
        // so values above 1.0x actually become visible instead of being clamped by canvas.
        applyBrightnessGain(ctx, cv, brightnessRef.current);
        animIdRef.current = id;
      },
    });

    return () => {
      if (animIdRef.current !== null) { cancelAnimationFrame(animIdRef.current); animIdRef.current = null; }
      timersRef.current.forEach(t => clearInterval(t)); timersRef.current = [];
      if (resizeFnRef.current) { window.removeEventListener("resize", resizeFnRef.current); resizeFnRef.current = null; }
      document.querySelectorAll(".anim-flash").forEach(e => e.remove());
      curTypeRef.current = null;
    };
  }, [animation, density, suspended]);

  if (!animation || suspended) return null;

  return (
    <div aria-hidden="true" className="theme-backdrop">
      <canvas ref={canvasRef} className="theme-backdrop-canvas" />
    </div>
  );
}
