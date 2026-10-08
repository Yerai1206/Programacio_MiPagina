(() => {
"use strict";
/* SHINGEKI NO KYOJIN · MANIOBRAS 3D — Canvas 2D, JS vanilla.
   Péndulo con cable (restricción de distancia), gas, titanes con ataque telegrafiado,
   combo, puntuación por partida y top 5 local. */
const $ = id => document.getElementById(id);
const cv = $("game"), cx = cv.getContext("2d");
const C = { g: 950, r: 11, range: 720, maxHp: 3, key: "aot_odm_top_v3", gasCost: 30, maxGas: 100 };
const rand = (a, b) => a + Math.random() * (b - a), lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = t => t * t * (3 - 2 * t);
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const diff = () => Math.min(1, Math.max(0, maxX) / 24000);
const PAL = ["#cdb99a", "#b9a283", "#a8947a", "#d4c3a5", "#b7a58c"];
const RANKS = [[0, "Recluta"], [600, "Cadete"], [1500, "Soldado raso"], [3000, "Legión de Reconocimiento"], [5500, "Élite de Maniobras"], [9000, "Capitán"], [14000, "El más fuerte de la humanidad"]];

let W = 0, H = 0, dpr = 1, state = "intro", last = 0, muted = false;
let top = []; try { top = JSON.parse(localStorage.getItem(C.key) || "[]"); } catch (e) {}
let p, hook, miss, aim = null, keys = {}, camX, camY, shake, inv, hp, gas, combo, bestCombo, score, maxX, grounded, groundT, kills, dodges, flash;
let blds, tits, gasBottles, parts, pops, trail, nextX, chase, time, cloudSeed = 3, fireCD = 0, healAt = 600, stagger = 0, wheelBoost = 0;

/* ---------- AUDIO (WebAudio sintetizado) ---------- */
let ac = null;
function tone(f, d, type = "sine", v = .15, slide = 0) { if (muted || !ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), ac.currentTime + d); g.gain.value = v; g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d); }
function noise(d, v = .2, f = 2000) { if (muted || !ac) return; const n = ac.sampleRate * d, b = ac.createBuffer(1, n, ac.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = "bandpass"; fl.frequency.value = f; g.gain.value = v; s.buffer = b; s.connect(fl).connect(g).connect(ac.destination); s.start(); }
const sfx = { hook() { noise(.12, .3, 3500); tone(900, .08, "square", .05, -400); }, miss() { noise(.1, .1, 1500); }, boost() { noise(.35, .3, 900); }, hurt() { tone(160, .35, "sawtooth", .25, -110); noise(.25, .3, 400); }, warn() { tone(520, .12, "square", .05); }, slash() { noise(.25, .4, 5000); tone(1200, .2, "triangle", .1, -800); }, good() { tone(660, .1, "triangle", .1); setTimeout(() => tone(990, .15, "triangle", .1), 80); }, over() { tone(200, .8, "sawtooth", .2, -150); }, crash() { noise(.6, .5, 300); tone(70, .5, "sawtooth", .2, -40); } };

/* ---------- ESTADO ---------- */
function resize() { const r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); W = Math.max(320, r.width | 0); H = Math.max(240, r.height | 0); cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function reset() {
  p = { x: 0, y: -240 - C.r, vx: 260, vy: 0 }; hook = null; miss = null; hp = C.maxHp; gas = C.maxGas; combo = 0; bestCombo = 0; score = 0; maxX = 0;
  inv = 0; shake = 0; flash = 0; grounded = true; groundT = 0; kills = 0; dodges = 0; time = 0;
  blds = [{ x: -260, w: 600, h: 240, h0: 240, br: 0, c: PAL[0], s: .3, rear: false }]; tits = []; gasBottles = []; parts = []; pops = []; trail = []; nextX = 340; chase = { x: -380, ph: 0, s: 0 }; healAt = 600; stagger = 0; fireCD = 0; wheelBoost = 0;
  camX = p.x - W * .42; camY = -H * .85; gen();
}
function gen() {
  while (nextX < p.x + W + 900) {
    const dd = diff(), hasT = nextX > 900 && Math.random() < .12 + .3 * dd;
    const gap = hasT ? rand(320, 400) : rand(120, 220 + 190 * dd), w = rand(130, 240), h = rand(150, 360), x = nextX + gap;
    if (hasT) { const th = rand(150, 260), ty = pickType(); tits.push({ x: nextX + gap / 2, h: th, w: th * .42 * (TW[ty] || 1), st: 0, t: 0, th: -.9, dead: false, fade: 1, near: false, hit: false, passed: false, ph: Math.random() * 6, type: ty, flying: false }); }
    // Titanes voladores: aparecen altos, se pueden enganchar y cortar como objetivos aéreos.
    if (nextX > 1800 && Math.random() < .075 + .11 * dd) {
      const fh = rand(95, 135);
      tits.push({ x: nextX + gap + rand(80, 260), y: -rand(390, 650), h: fh, w: fh * .48, st: 0, t: 0, th: 0, dead: false, fade: 1, near: false, hit: false, passed: false, ph: Math.random() * 6, type: Math.random() < .5 ? "winged" : "harpy", flying: true, bob: rand(0, 6), vx: rand(-25, 25) });
    }
    // Botellas de gas flotando sobre la ruta: recogerlas restaura una buena parte del depósito.
    if (nextX > 1100 && Math.random() < .22) gasBottles.push({ x: x + w * rand(.2, .8), y: -h - rand(45, 145), r: 13, spin: Math.random() * 6, dead: false });
    // Edificios altos de fondo: aparecen con frecuencia y dan un segundo nivel de anclaje.
    if (Math.random() < .48) {
      const bw = rand(100, 170), bh = rand(390, 610), bx = x + rand(-30, Math.max(20, w - 70));
      blds.push({ x: bx, w: bw, h: bh, h0: bh, br: 0, c: PAL[(Math.random() * PAL.length) | 0], s: Math.random(), tall: true, rear: true });
    }
    blds.push({ x, w, h, h0: h, br: 0, c: PAL[(Math.random() * PAL.length) | 0], s: Math.random(), tall: false }); nextX = x + w;
  }
  const mx = p.x - 900; blds = blds.filter(b => b.x + b.w > mx); tits = tits.filter(t => (t.x + (t.flying ? 200 : t.w)) > mx && t.fade > 0); gasBottles = gasBottles.filter(q => q.x > mx && !q.dead);
}
function pop(txt, pts, col = "#d9b25f") { score += pts; pops.push({ x: p.x, y: p.y - 40, txt: txt + (pts ? " +" + pts : ""), l: 1.4, col }); sfx.good(); }
function burst(x, y, col, n = 10, sp = 220, steam = false) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-sp, sp), vy: rand(-sp, sp * .4), l: rand(.3, .8), m: .8, r: steam ? rand(5, 12) : rand(2, 4), c: col, g: steam ? -60 : 500, st: steam }); }

/* ---------- GANCHO (auto-apuntado hacia el cursor) ---------- */
function aimDir() {
  let dx = .7, dy = -.7;
  if (aim) { dx = aim.x + camX - p.x; dy = aim.y + camY - p.y; }
  const l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l };
}
function findAnchor() {
  const a = aimDir(); let best = null, bs = 1e9;
  for (const b of blds) {
    if (b.gone || b.br || b.x > p.x + C.range + 80 || b.x + b.w < p.x - 320) continue;
    for (const f of b.tall ? [.18, .5, .82] : [.1, .5, .9]) {
      const ax = b.x + b.w * f, ay = -b.h, dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy);
      if (d < 70 || d > C.range || dy > 35) continue;
      const ang = Math.acos(clamp((dx * a.x + dy * a.y) / d, -1, 1));
      if (ang > 1.22) continue;
      const forward = dx >= 0 ? 0 : 420, heightBonus = b.tall ? -230 : 0, escapeBonus = (p.y > -b.h + 90 && dx > 0) ? -120 : 0;
      const s = ang * 380 + d * .22 + forward + heightBonus + escapeBonus;
      if (s < bs) { bs = s; best = { x: ax, y: ay, b, target: "building" }; }
    }
  }
  // Los titanes voladores también son puntos de anclaje; se prefieren si están cerca de la dirección del cursor.
  for (const t of tits) {
    if (t.dead) continue;
    const ax = t.flying ? t.x : t.x - t.w * .1, ay = t.flying ? t.y - t.h * .52 : -t.h * .8, dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy);
    if (d < 75 || d > C.range) continue;
    const ang = Math.acos(clamp((dx * a.x + dy * a.y) / d, -1, 1));
    if (ang > 1.05) continue;
    const s = ang * 330 + d * .18 - (dx > 0 ? 120 : 0);
    if (s < bs) { bs = s; best = { x: ax, y: ay, t, target: t.flying ? "flying" : "titan" }; }
  }
  return best;
}
function fire() {
  if (state !== "play" || hook) return; const t = findAnchor();
  if (t) {
    const d = Math.hypot(t.x - p.x, t.y - p.y); hook = { x: t.x, y: t.y, len: d, sh: 0, b: t.b || null, t: t.t || null, target: t.target };
    p.vx += (t.x - p.x) / d * 160; p.vy += (t.y - p.y) / d * 160;
    combo++; bestCombo = Math.max(bestCombo, combo); burst(t.x, t.y, "#fff", 8, 130);
    sfx.hook();
  } else { const a = aimDir(); miss = { x: p.x + a.x * 280, y: p.y + a.y * 280, t: .2 }; sfx.miss(); }
}
const release = () => {
  if (hook && state === "play") { const s = Math.hypot(p.vx, p.vy), r = -p.vy / (p.vx || 1);
    if (s > 420 && p.vx > 0 && p.vy < -80 && r > .25 && r < 1.6) { p.vx *= 1.2; p.vy *= 1.12; pop("¡LANZAMIENTO!", 60, "#9fe8ff"); burst(p.x, p.y, "#9fe8ff", 12, 200, true); sfx.boost(); shake = Math.max(shake, 5); } }
  hook = null;
};
function boost() {
  if (state !== "play" || gas < C.gasCost) return; gas -= C.gasCost; const a = aimDir();
  p.vx += a.x * 430; p.vy += a.y * 430; burst(p.x, p.y + 6, "rgba(255,255,255,.8)", 14, 140, true); sfx.boost(); shake = Math.max(shake, 4);
}
function hurt(msg) {
  if (inv > 0 || state !== "play") return; hp--; inv = 2.2; shake = 16; combo = 0; flash = 1; sfx.hurt(); burst(p.x, p.y, "#b3261e", 16);
  if (hp <= 0) over(msg);
}

/* ---------- ACTUALIZACIÓN ---------- */
function update(dt) {
  time += dt; const sub = 2, h = dt / sub;
  for (let i = 0; i < sub; i++) physics(h);
  if (state !== "play") return;
  const dm = Math.max(0, p.x - maxX) / 10; if (dm > 0) { maxX = p.x; score += dm * (1 + Math.min(combo, 10) * .25); }
  gas = Math.min(C.maxGas, gas + (grounded ? 22 : 9) * dt);
  for (const q of gasBottles) {
    q.spin += dt * 4;
    if (!q.dead && Math.hypot(p.x - q.x, p.y - q.y) < 34) {
      q.dead = true; const gain = 42; gas = Math.min(C.maxGas, gas + gain); pop("⛽ GAS +" + gain, 80, "#9fe8ff"); burst(q.x, q.y, "#9fe8ff", 16, 150, true); tone(780, .12, "triangle", .1, 220);
    }
  }
  inv = Math.max(0, inv - dt); shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt * 2.5);
  // horda
  fireCD -= dt; if (aim && aim.down && !hook && fireCD <= 0) { fireCD = .2; fire(); }
  if (maxX / 10 > healAt) { healAt += 600; if (hp < C.maxHp) { hp++; pop("+1 HOJA", 0, "#8fe3b0"); } }
  const gap = p.x - chase.x; stagger = Math.max(0, stagger - dt); chase.ph += dt * (5 + 3 * diff());
  const sp = (190 + 330 * diff()) * (stagger > 0 ? .35 : 1) * clamp((gap - 120) / 380, .55, 1.15);
  chase.x += sp * dt; chase.x = Math.max(chase.x, p.x - 900);
  const stp = Math.floor(chase.ph / Math.PI); if (stp !== chase.s) { chase.s = stp; const v = clamp(1.3 - gap / 900, .15, 1); tone(55, .25, "sine", .25 * v, -20); noise(.2, .12 * v, 180); shake = Math.max(shake, 3 + 7 * v); }
  smash(dt);
  if (gap < 70) { hurt("El Titán Acorazado te ha atrapado"); if (state === "play") { chase.x -= 480; stagger = 3; p.vx = 650; p.vy = -520; hook = null; } }
  // titanes
  for (const t of tits) titan(t, dt);
  // efectos
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.l -= dt; } parts = parts.filter(q => q.l > 0);
  for (const q of pops) { q.y -= 40 * dt; q.l -= dt; } pops = pops.filter(q => q.l > 0);
  if (miss) { miss.t -= dt; if (miss.t <= 0) miss = null; } if (hook) hook.sh = Math.min(1, hook.sh + dt * 14);
  trail.push({ x: p.x, y: p.y }); if (trail.length > 14) trail.shift();
  const tx = p.x - W * (.42 + Math.min(.12, Math.hypot(p.vx, p.vy) / 9000)); camX = lerp(camX, tx, Math.min(1, dt * 6));
  camY = lerp(camY, Math.min(p.y - H * .42, -H * .85), Math.min(1, dt * 4));
  gen();
}
function physics(dt) {
  if (state !== "play") return;
  p.vy += C.g * dt; const keyHook = keys.w || keys.arrowup;
  if (keyHook && !hook) fire(); if (!keyHook && !aim?.down && hook && keys._kh) release(); keys._kh = keyHook;
  if (hook) {
    if (hook.t && !hook.t.dead) { const T = hook.t; hook.x = T.flying ? T.x : T.x - T.w * .1; hook.y = T.flying ? T.y - T.h * .52 : -T.h * .8; if (!T.flying) { hook.len = Math.max(20, hook.len - 330 * dt); const ddx = hook.x - p.x, ddy = hook.y - p.y, dd = Math.hypot(ddx, ddy) || 1; p.vx += ddx / dd * 1500 * dt; p.vy += ddy / dd * 1500 * dt; } }
    p.vx += 270 * dt;
    // La rueda cambia la longitud del cable: hacia arriba lo alarga, hacia abajo lo recoge.
    if (keys.shift || keys.s) wheelBoost = Math.min(wheelBoost, -420); hook.len = clamp(hook.len + wheelBoost * dt, hook.target === "titan" ? 20 : 70, C.range);
    wheelBoost *= Math.exp(-5.5 * dt);
    if (hook.target === "building" && hook.b && hook.b.br) hook = null;
    if ((hook.target === "flying" || hook.target === "titan") && (!hook.t || hook.t.dead)) hook = null;
    if (hook && (hook.x < p.x - 260 || Math.hypot(hook.x - p.x, hook.y - p.y) > C.range + 160)) hook = null;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (hook) {
    let dx = p.x - hook.x, dy = p.y - hook.y, d = Math.hypot(dx, dy) || 1;
    if (d > hook.len) { const nx = dx / d, ny = dy / d; p.x = hook.x + nx * hook.len; p.y = hook.y + ny * hook.len; const vr = p.vx * nx + p.vy * ny; if (vr > 0) { p.vx -= vr * nx; p.vy -= vr * ny; } }
    if (wheelBoost < -40) { const pull = Math.min(300, -wheelBoost * .55); p.vx += (hook.x - p.x) / d * pull * dt; p.vy += (hook.y - p.y) / d * pull * dt; }
  }
  const spd = Math.hypot(p.vx, p.vy); if (spd > 1150) { p.vx *= 1150 / spd; p.vy *= 1150 / spd; }
  p.vx *= 1 - .12 * dt;
  // edificios: el lateral ya no te deja clavado. A alta velocidad se convierte en un rebote/impulso de salida.
  const was = grounded; grounded = false;
  for (const b of blds) {
    if (b.rear || b.gone || p.x + C.r < b.x || p.x - C.r > b.x + b.w || p.y + C.r < -b.h) continue;
    const prev = p.y - p.vy * dt;
    if (prev + C.r <= -b.h + 20) { p.y = -b.h - C.r; if (p.vy > 0) p.vy = 0; grounded = true; if (p.vx < 280) p.vx += 600 * dt; }
    else {
      const left = p.x < b.x + b.w / 2;
      if (p.y + C.r < -b.h + 65) { p.y = -b.h - C.r; if (p.vy > 0) p.vy = 0; grounded = true; continue; }
      p.x = left ? b.x - C.r - 2 : b.x + b.w + C.r + 2;
      const dir = left ? -1 : 1;
      // Conserva impulso hacia fuera y añade una pequeña elevación para escapar del borde.
      p.vx = dir * Math.max(220, Math.abs(p.vx) * .72);
      if (p.vy > -520) p.vy = -520;
      shake = Math.max(shake, 3);
    }
  }
  // Seguro anti-atasco: si el jugador está pegado a un lateral durante varias frames, lo despega.
  if (!grounded && Math.abs(p.vx) < 180) {
    const nearWall = blds.some(b => !b.gone && Math.abs(p.x - b.x) < C.r + 5 && p.y < -b.h + 70 || !b.gone && Math.abs(p.x - (b.x + b.w)) < C.r + 5 && p.y < -b.h + 70);
    if (nearWall) { p.vx += 260; p.vy = Math.min(p.vy, -360); }
  }
  if (p.y > -C.r) { p.y = -C.r; p.vy = 0; grounded = true; p.vx *= Math.exp(-2.2 * dt); if (p.vx < 130) p.vx = 130; groundT += dt; if (groundT > .9) groundT = 0; } else groundT = Math.max(0, groundT - dt * .5);
  if (grounded && !was && hook === null) combo = 0; if (grounded && combo && !hook) combo = 0;
}
function titan(t, dt) {
  if (t.dead) { t.fade -= dt * .7; return; }
  if (t.flying) {
    t.x += t.vx * dt - 42 * dt; t.bob += dt * 2.2; t.y += Math.sin(t.bob) * 22 * dt;
    const d = Math.hypot(p.x - t.x, p.y - t.y);
    if (d < t.h * .75 + C.r && Math.hypot(p.vx, p.vy) > 330 && p.y < t.y - t.h * .15) { t.dead = true; kills++; burst(t.x, t.y, "#d7a07d", 24, 300); burst(t.x, t.y - t.h*.45, "#fff", 10, 130, true); sfx.slash(); shake = 10; pop("¡TITÁN VOLADOR CORTADO!", 420, "#ff6b5b"); hook = null; return; }
    if (!t.passed && p.x > t.x + t.w) { t.passed = true; if (d < 180) { dodges++; pop("¡ESQUIVE AÉREO!", 160, "#8fe3b0"); } }
    return;
  }
  t.x -= (t.type === "abnormal" ? 75 : t.type === "smiler" ? 48 : 24) * dt; const dx = t.x - p.x;
  const S = { x: t.x - t.w * .25, y: -t.h * .8 }, L = t.h * .95;
  if (t.st === 0) { if (dx < 520 && dx > -60) { t.st = 1; t.t = 0; sfx.warn(); } }
  else if (t.st === 1) { t.t += dt; t.th = lerp(-.9, 1.5, ease(Math.min(1, t.t / .95))); if (t.t >= .95) { t.st = 2; t.t = 0; t.near = false; t.hit = false; } }
  else if (t.st === 2) {
    t.t += dt; t.th = lerp(1.5, -1, Math.min(1, t.t / .28));
    for (const k of [.55, .8, 1]) { const hx = S.x - L * k * Math.cos(t.th), hy = S.y - L * k * Math.sin(t.th), d = Math.hypot(p.x - hx, p.y - hy); if (d < 30 + C.r && !t.hit) { t.hit = true; p.vy = -260; p.vx = -120; hurt("Un titán te ha atrapado"); } else if (d < 140) t.near = true; }
    if (t.t >= .28) { t.st = 3; t.t = 0; if (t.near && !t.hit) { dodges++; pop("¡ESQUIVE PERFECTO!", 150, "#8fe3b0"); } shake = Math.max(shake, 5); }
  } else { t.t += dt; t.th = lerp(-1, -.9, Math.min(1, t.t)); if (t.t > 1.1) t.st = 0; }
  // cuerpo / nuca
  if (Math.abs(p.x - t.x) < t.w / 2 + C.r && p.y > -t.h - C.r && p.y < 0) {
    const sp = Math.hypot(p.vx, p.vy);
    if ((p.y < -t.h * .72 && sp > 400) || (hook && hook.t === t)) { gas = Math.min(C.maxGas, gas + 25); t.dead = true; kills++; burst(t.x, -t.h * .85, "#e0392d", 22, 300); burst(t.x, -t.h, "#fff", 10, 150, true); sfx.slash(); shake = 12; pop("¡NUCA CORTADA!", 300 + 100 * Math.min(combo, 8), "#e0392d"); hook = null; }
    else { p.x = t.x - t.w / 2 - C.r; p.vx = -Math.abs(p.vx) * .4; p.vy = -280; hurt("Chocas con un titán"); }
  }
  if (!t.passed && p.x > t.x + t.w / 2 + 30) { t.passed = true; if (!t.hit && p.y > -t.h - 110 && !t.dead) { dodges++; pop("¡POR LOS PELOS!", 100, "#8fe3b0"); } }
}

function smash(dt) {
  for (const b of blds) {
    if (b.gone || b.rear) continue;
    if (!b.br && chase.x - 40 > b.x) {
      b.br = .001; sfx.crash(); shake = Math.max(shake, 14);
      for (let i = 0; i < 26; i++) parts.push({ x: b.x + rand(0, b.w), y: -rand(20, b.h), vx: rand(60, 520), vy: rand(-420, -60), l: rand(.8, 1.6), m: 1.4, r: rand(3, 8), c: [b.c, "#8a2f24", "#4a3626"][i % 3], g: 900 });
      burst(b.x + b.w / 2, -b.h * .5, "rgba(200,185,160,.7)", 10, 160, true);
    }
    if (b.br) { b.br = Math.min(1, b.br + dt * 1.5); b.h = b.h0 * (1 - ease(b.br)); if (b.br >= 1) b.gone = true; }
  }
}
function drawArmored(gs) {
  const fx = chase.x - camX, ph = chase.ph; if (fx < -700) return;
  const ol = "#120b08", mus = "#7b2a1e", musD = "#4a150e", pl = "#b9a67f", plD = "#8c7a58", plL = "#dccda6";
  cx.save(); cx.translate(fx, gs); cx.lineJoin = "round"; cx.lineCap = "round"; cx.lineWidth = 3; cx.strokeStyle = ol;
  const poly = (f, ...q) => { cx.fillStyle = f; cx.beginPath(); for (let i = 0; i < q.length; i += 2) i ? cx.lineTo(q[i], q[i + 1]) : cx.moveTo(q[i], q[i + 1]); cx.closePath(); cx.fill(); cx.stroke(); };
  cx.fillStyle = "rgba(0,0,0,.35)"; cx.beginPath(); cx.ellipse(-120, 0, 270, 20, 0, 0, 7); cx.fill();
  for (const k of [Math.PI, 0]) {
    const sw = Math.sin(ph + k) * 85, li = Math.max(0, Math.cos(ph + k)) * 40;
    poly(k ? musD : mus, -235 + sw * .3, -260, -85 + sw * .3, -260, -70 + sw * .8, -130 - li * .6, -90 + sw, -40 - li, -50 + sw, -li, -225 + sw, -li, -215 + sw, -50 - li, -215 + sw * .6, -135);
    poly(k ? plD : pl, -225 + sw * .5, -230, -90 + sw * .5, -230, -80 + sw * .6, -160, -220 + sw * .5, -165);
    poly(plD, -215 + sw * .9, -95 - li, -85 + sw * .9, -95 - li, -75 + sw, -45 - li, -218 + sw, -45 - li);
  }
  poly(mus, -340, -250, -315, -470, -230, -545, -70, -552, 45, -480, 55, -330, -40, -255);
  for (let i = 0; i < 6; i++) { const bx = -325 + i * 42, by = -310 - i * 42; poly(i % 2 ? plD : pl, bx, by, bx + 55, by - 30, bx + 75, by + 25, bx + 20, by + 50); }
  poly(pl, -70, -535, 40, -480, 52, -340, -20, -300, -85, -380);
  cx.beginPath(); for (let i = 0; i < 3; i++) { cx.moveTo(-70 + i * 6, -440 + i * 40); cx.lineTo(48, -430 + i * 40); } cx.stroke();
  // brazo en balanceo con hombrera y puño blindado
  const a = Math.cos(ph) * .8 - .2, ex = -110 + Math.sin(a) * 130, ey = -470 + Math.cos(a) * 130, a2 = a + .55 + Math.sin(ph) * .3, hx = ex + Math.sin(a2) * 120, hy = ey + Math.cos(a2) * 120;
  cx.strokeStyle = ol; cx.lineWidth = 80; cx.beginPath(); cx.moveTo(-110, -470); cx.lineTo(ex, ey); cx.lineTo(hx, hy); cx.stroke();
  cx.strokeStyle = mus; cx.lineWidth = 72; cx.stroke(); cx.strokeStyle = ol; cx.lineWidth = 3;
  poly(pl, ex - 38, ey - 25, ex + 38, ey - 25, hx + 32, hy - 18, hx - 32, hy - 18); cx.fillStyle = plD; cx.beginPath(); cx.arc(hx, hy, 42, 0, 7); cx.fill(); cx.stroke();
  poly(plL, -195, -535, -70, -550, -25, -470, -80, -415, -205, -440);
  // cabeza: casco, placas faciales, mandíbula con dientes y ojo brillante
  poly(mus, -70, -540, -45, -615, 20, -640, 75, -610, 92, -560, 88, -505, 50, -470, -20, -480, -60, -505);
  poly(pl, -62, -560, -40, -622, 20, -642, 62, -615, 42, -585, -10, -570);
  poly(plD, 20, -562, 90, -552, 86, -505, 40, -488);
  cx.fillStyle = "#f2e8d0"; for (let i = 0; i < 7; i++) cx.fillRect(34 + i * 8, -524 + (i % 2) * 3, 5, 15);
  cx.fillStyle = "#ffe1a8"; cx.shadowColor = "#ff8a3a"; cx.shadowBlur = 18; cx.beginPath(); cx.ellipse(46, -578, 14, 6, .15, 0, 7); cx.fill(); cx.shadowBlur = 0;
  if (Math.random() < .6) parts.push({ x: chase.x - 20, y: -430, vx: rand(-30, 30), vy: -70, l: 1.2, m: 1.2, r: 8, c: "#fff", g: -30, st: true });
  cx.restore();
}
function drawGate(gs) {
  const wt = gs - 430, gx = ((1300 - camX * .1) % 2600 + 2600) % 2600 - 350;
  cx.fillStyle = "#2b2823"; cx.beginPath(); cx.moveTo(gx, wt + 330); cx.lineTo(gx, wt + 150); cx.quadraticCurveTo(gx + 90, wt + 60, gx + 180, wt + 150); cx.lineTo(gx + 180, wt + 330); cx.fill();
  cx.strokeStyle = "#5a554b"; cx.lineWidth = 4; cx.stroke(); cx.beginPath(); for (let i = 1; i < 6; i++) { cx.moveTo(gx + i * 30, wt + 110 + (i % 3 ? 20 : 0)); cx.lineTo(gx + i * 30, wt + 330); } cx.stroke();
  cx.fillStyle = "#1f3a66"; cx.fillRect(gx - 26, wt + 20, 18, 90); cx.fillRect(gx + 188, wt + 20, 18, 90);
  cx.strokeStyle = "rgba(20,15,15,.55)"; cx.lineWidth = 1.6; const M = W * 1.6;
  for (let i = 0; i < 7; i++) { const bx = (((hash(i + 40) * M + time * (30 + i * 4) - camX * .03) % M) + M) % M - 80, by = gs * (.18 + hash(i + 50) * .3) + Math.sin(time * 2 + i) * 8, f = Math.sin(time * 9 + i) * 5; cx.beginPath(); cx.moveTo(bx - 9, by + f); cx.quadraticCurveTo(bx - 4, by - 4, bx, by); cx.quadraticCurveTo(bx + 4, by - 4, bx + 9, by + f); cx.stroke(); }
}
function drawEmbers() {
  const M = W * 1.4;
  for (let i = 0; i < 28; i++) { const x = (((hash(i) * M - time * (20 + hash(i + 9) * 40) - camX * .2) % M) + M) % M - W * .2, y = (hash(i + 5) * H + time * (14 + hash(i + 3) * 24)) % H; cx.globalAlpha = .25 + .5 * hash(i + 2); cx.fillStyle = i % 3 ? "#ffb35a" : "#fff1cf"; cx.fillRect(x, y, 2, 2); }
  cx.globalAlpha = 1; const d = diff(); if (d > 0 && state === "play") { cx.fillStyle = `rgba(120,18,8,${d * .16})`; cx.fillRect(0, 0, W, H); }
}

/* ---------- FIN / PUNTUACIÓN ---------- */
function over(reason) {
  if (state !== "play") return; state = "over"; hook = null; sfx.over();
  const sc = Math.floor(score), rec = sc > (top[0] || 0); top.push(sc); top.sort((a, b) => b - a); top = top.slice(0, 5);
  try { localStorage.setItem(C.key, JSON.stringify(top)); } catch (e) {}
  $("oTitle").textContent = reason; $("oScore").textContent = sc; $("oNew").hidden = !rec;
  $("oDist").textContent = Math.floor(maxX / 10); $("oKills").textContent = kills; $("oDodge").textContent = dodges; $("oCombo").textContent = bestCombo;
  $("oRank").textContent = "Rango: " + RANKS.filter(r => sc >= r[0]).pop()[1];
  let marked = false; $("oTop").innerHTML = top.map((v, i) => { const me = !marked && v === sc; if (me) marked = true; return `<li class="${me ? "me" : ""}"><span>#${i + 1}</span><span>${v} pts</span></li>`; }).join("");
  setTimeout(() => show("over"), 700);
}

/* ---------- DIBUJO ---------- */
function draw() {
  const gs = -camY, sx = shake ? rand(-shake, shake) * .5 : 0, sy = shake ? rand(-shake, shake) * .5 : 0;
  cx.save(); cx.translate(sx, sy);
  // cielo
  let g = cx.createLinearGradient(0, 0, 0, gs); g.addColorStop(0, "#0b1426"); g.addColorStop(.45, "#3b4a6e"); g.addColorStop(.78, "#b8705a"); g.addColorStop(1, "#f0b86e");
  cx.fillStyle = g; cx.fillRect(-20, -20, W + 40, H + 40);
  g = cx.createRadialGradient(W * .75, gs - 120, 10, W * .75, gs - 120, 380); g.addColorStop(0, "rgba(255,225,160,.7)"); g.addColorStop(1, "rgba(255,225,160,0)"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  cx.fillStyle = "rgba(255,255,255,.12)"; for (let i = 0; i < 6; i++) { const x = ((hash(i + cloudSeed) * 1400 - camX * .04 - time * 6) % 1400 + 1400) % 1400 - 200; cx.beginPath(); cx.ellipse(x, gs * (.2 + hash(i) * .4), 160, 22, 0, 0, 7); cx.fill(); }

  // Retumbar - Eren Fundador y Titanes Colosales
  const bgX = camX * 0.05; 
  const hy = gs - 150;
  cx.save();
  let rg = cx.createLinearGradient(0, hy - 250, 0, hy + 50);
  rg.addColorStop(0, "rgba(220, 40, 20, 0)");
  rg.addColorStop(1, "rgba(220, 40, 20, 0.4)");
  cx.fillStyle = rg;
  cx.fillRect(-20, hy - 300, W + 40, 350);

  cx.fillStyle = "#160604";
  for(let i=0; i<30; i++) {
     const bx = ((i*100 - bgX) % 3000 + 3000) % 3000 - 150;
     const h = 220 + hash(i)*80;
     const walk = Math.sin(time*1.5 + i)*15;
     cx.beginPath(); cx.ellipse(bx, hy - h/2 + walk, 45, h/2, 0, 0, 7); cx.fill();
     if (hash(i*3) > 0.4) {
       cx.fillStyle = "rgba(255,80,30,0.7)";
       cx.beginPath(); cx.arc(bx-10, hy - h + 35 + walk, 4, 0, 7); cx.fill();
       cx.beginPath(); cx.arc(bx+10, hy - h + 35 + walk, 4, 0, 7); cx.fill();
       cx.fillStyle = "#160604";
     }
  }
  const erenX = ((1500 - bgX*1.2) % 4000 + 4000) % 4000 - 300;
  cx.fillStyle = "#09090b";
  cx.beginPath(); cx.moveTo(erenX-40, hy+20); cx.lineTo(erenX, hy-450); cx.lineTo(erenX+40, hy+20); cx.fill();
  for(let i=0; i<14; i++) {
     cx.beginPath(); cx.ellipse(erenX, hy - 400 + i*25, 200 - i*12, 7 + i%2*5, 0, 0, 7); cx.fill();
  }
  cx.beginPath(); cx.arc(erenX, hy - 470, 28, 0, 7); cx.fill();
  cx.fillStyle = "#ff1100"; cx.shadowColor = "#ff1100"; cx.shadowBlur = 18;
  cx.beginPath(); cx.arc(erenX - 10, hy - 475, 5, 0, 7); cx.fill();
  cx.beginPath(); cx.arc(erenX + 10, hy - 475, 5, 0, 7); cx.fill();
  cx.shadowBlur = 0;
  cx.restore();

  // muro lejano
  const wt = gs - 430; g = cx.createLinearGradient(0, wt, 0, gs); g.addColorStop(0, "#8b887e"); g.addColorStop(1, "#4a4843"); cx.fillStyle = g; cx.fillRect(-20, wt, W + 40, 430);
  cx.fillStyle = "#a5a296"; cx.fillRect(-20, wt, W + 40, 8); cx.strokeStyle = "rgba(0,0,0,.25)"; cx.lineWidth = 2; const wo = camX * .1;
  for (let y = wt + 40, r = 0; y < gs; y += 40, r++) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); for (let x = -((wo + r * 35) % 90); x < W; x += 90) { cx.moveTo(x, y); cx.lineTo(x, y + 40); } cx.stroke(); }
  g = cx.createLinearGradient(0, gs - 220, 0, gs); g.addColorStop(0, "rgba(230,185,122,0)"); g.addColorStop(1, "rgba(230,185,122,.75)"); cx.fillStyle = g; cx.fillRect(0, gs - 220, W, 220);
  drawGate(gs);
  cx.fillStyle = "#4b4f5c"; const fo = camX * .3; for (let i = Math.floor(fo / 90) - 1; i < (fo + W) / 90 + 2; i++) { const x = i * 90 - fo, h = 60 + hash(i) * 110; cx.fillRect(x, gs - h, 84, h); cx.beginPath(); cx.moveTo(x - 4, gs - h); cx.lineTo(x + 42, gs - h - 26); cx.lineTo(x + 88, gs - h); cx.fill(); }
  // suelo
  cx.fillStyle = "#3a3329"; cx.fillRect(-20, gs, W + 40, H); cx.fillStyle = "#5a4e3c"; cx.fillRect(-20, gs, W + 40, 4);
  cx.strokeStyle = "rgba(0,0,0,.25)"; cx.beginPath(); for (let x = -(camX % 70); x < W; x += 70) { cx.moveTo(x, gs); cx.lineTo(x - 30, H); } cx.stroke();
  // Arquitectura: primero los edificios altos de fondo, luego titanes y finalmente las casas jugables.
  for (const b of blds) if (b.rear) drawBld(b, gs);
  for (const t of tits) drawTitan(t, gs);
  for (const q of gasBottles) if (!q.dead) drawGasBottle(q, gs);
  for (const b of blds) if (!b.rear) drawBld(b, gs);
  // horda
  drawArmored(gs);
  // estela, cables y jugador
  cx.strokeStyle = "rgba(255,255,255,.25)"; cx.lineWidth = 2; cx.beginPath(); trail.forEach((q, i) => { const X = q.x - camX, Y = q.y - camY; i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }); cx.stroke();
  const px = p.x - camX, py = p.y - camY;
  if (state === "play" && !hook) { const a = findAnchor(); if (a) { cx.strokeStyle = "rgba(255,230,160,.8)"; cx.lineWidth = 2; cx.beginPath(); cx.arc(a.x - camX, a.y - camY, 11 + Math.sin(time * 8) * 2, 0, 7); cx.stroke(); } }
  if (hook) { const hx = lerp(px, hook.x - camX, hook.sh), hy = lerp(py, hook.y - camY, hook.sh); cx.strokeStyle = "#dfe6ee"; cx.lineWidth = 1.6; for (const o of [-4, 4]) { cx.beginPath(); cx.moveTo(px + o, py + 6); cx.lineTo(hx, hy); cx.stroke(); } cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(hx, hy, 4, 0, 7); cx.fill(); }
  if (miss) { cx.strokeStyle = "rgba(223,230,238," + miss.t * 4 + ")"; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(miss.x - camX, miss.y - camY); cx.stroke(); }
  drawPlayer(px, py);
  for (const q of parts) { cx.globalAlpha = clamp(q.l / q.m, 0, 1) * (q.st ? .6 : 1); cx.fillStyle = q.c; cx.beginPath(); cx.arc(q.x - camX, q.y - camY, q.r * (q.st ? 2 - q.l / q.m : 1), 0, 7); cx.fill(); } cx.globalAlpha = 1;
  cx.font = "900 20px Cinzel, serif"; cx.textAlign = "center"; cx.lineWidth = 4; cx.strokeStyle = "#000";
  for (const q of pops) { cx.globalAlpha = clamp(q.l, 0, 1); cx.fillStyle = q.col; cx.strokeText(q.txt, q.x - camX, q.y - camY); cx.fillText(q.txt, q.x - camX, q.y - camY); } cx.globalAlpha = 1;
  const sp = Math.hypot(p.vx, p.vy); if (sp > 620 && state === "play") { cx.strokeStyle = "rgba(255,255,255,.16)"; cx.lineWidth = 1.5; cx.beginPath(); for (let i = 0; i < 14; i++) { const y = hash(i + Math.floor(time * 20)) * H, x = hash(i * 7 + Math.floor(time * 20)) * W; cx.moveTo(x, y); cx.lineTo(x - sp * .09, y - p.vy * .02); } cx.stroke(); }
  cx.restore();
  drawEmbers(); g = cx.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, H * .95); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  if (flash > 0) { cx.fillStyle = `rgba(190,20,10,${flash * .4})`; cx.fillRect(0, 0, W, H); }
  if (state === "play") { const gp = clamp(1 - (p.x - chase.x) / 600, 0, 1); if (gp > 0) { g = cx.createLinearGradient(0, 0, W * .4, 0); g.addColorStop(0, `rgba(140,12,6,${gp * .45})`); g.addColorStop(1, "rgba(140,12,6,0)"); cx.fillStyle = g; cx.fillRect(0, 0, W * .4, H); } }
}
function drawBld(b, gs) {
  const x = b.x - camX + (b.br && b.br < 1 ? rand(-4, 4) : 0), t = -b.h - camY; if (x > W + 20 || x + b.w < -20) return;
  if (b.gone) { cx.globalAlpha = b.rear ? .28 : 1; cx.fillStyle = b.c; for (let i = 0; i < 9; i++) cx.fillRect(x + hash(b.s * 9 + i) * b.w, gs - 6 - hash(b.s * 5 + i) * 14, 16 + hash(i) * 22, 12); cx.globalAlpha = 1; return; }
  cx.globalAlpha = b.rear ? .28 : 1;
  cx.fillStyle = b.c; cx.fillRect(x, t, b.w, gs - t); cx.fillStyle = "rgba(0,0,0,.18)"; cx.fillRect(x + b.w - 14, t, 14, gs - t);
  cx.fillStyle = "#4a3626"; for (let bx = 0; bx <= b.w - 5; bx += 44) cx.fillRect(x + bx, t, 5, gs - t); cx.fillRect(x, t + 46, b.w, 5); cx.fillRect(x, t + 130, b.w, 5);
  for (let yy = t + 66, r = 0; yy < gs - 30 && r < 12; yy += 64, r++) for (let bx = 18, c = 0; bx < b.w - 24; bx += 44, c++) { cx.fillStyle = hash(b.s * 99 + r * 7 + c) > .55 ? "#f4c46b" : "#2a2420"; cx.fillRect(x + bx, yy, 14, 20); }
  cx.fillStyle = "#8a2f24"; cx.beginPath(); cx.moveTo(x - 10, t + 20); cx.lineTo(x + 14, t); cx.lineTo(x + b.w - 14, t); cx.lineTo(x + b.w + 10, t + 20); cx.closePath(); cx.fill(); cx.fillStyle = "rgba(0,0,0,.25)"; for (let rx = 8; rx < b.w - 10; rx += 14) cx.fillRect(x + rx, t + 3, 2, 15); cx.fillStyle = "#c04a3a"; cx.fillRect(x + 14, t, b.w - 28, 3);
  if (b.s > .6) { cx.fillStyle = "#3a332c"; cx.fillRect(x + b.w * .7, t - 22, 14, 20); }
  if (b.s > .42 && !b.rear) { const bx = x + b.w * .18, by = t + 24; cx.fillStyle = "#1f3a66"; cx.fillRect(bx, by, 16, 58); cx.fillStyle = "#f2efe4"; cx.beginPath(); cx.moveTo(bx + 8, by + 12); cx.lineTo(bx + 1, by + 40); cx.lineTo(bx + 8, by + 31); cx.lineTo(bx + 15, by + 40); cx.closePath(); cx.fill(); }
  if (b.rear) { cx.fillStyle = "rgba(255,220,150,.35)"; cx.fillRect(x + b.w*.12, t + 18, b.w*.76, 3); }
  cx.globalAlpha = 1;
}
function drawGasBottle(q, gs) {
  const x = q.x - camX, y = q.y - camY; if (x < -40 || x > W + 40) return;
  cx.save(); cx.translate(x, y); cx.rotate(Math.sin(q.spin) * .08);
  cx.shadowColor = "rgba(100,220,255,.7)"; cx.shadowBlur = 14;
  cx.fillStyle = "#dce9ef"; cx.fillRect(-7, -14, 14, 28); cx.fillStyle = "#6cc7e8"; cx.fillRect(-5, -10, 10, 19);
  cx.fillStyle = "#b9c7cf"; cx.fillRect(-4, -19, 8, 6); cx.fillStyle = "#6cc7e8"; cx.beginPath(); cx.arc(0, -20, 4, 0, 7); cx.fill();
  cx.strokeStyle = "#fff"; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, 18, 0, 7); cx.stroke();
  cx.restore();
}
const TS = {
  classic: { c: ["#e6bda3", "#c98f76", "#8c5548"], hs: 1, mo: 1, hair: "#2a1a15" },
  abnormal: { c: ["#dca28d", "#b86a58", "#7a3b32"], hs: 1.12, mo: 2, hair: "#1a0f0c" },
  lean: { c: ["#d9b9a0", "#b88f7a", "#80574b"], hs: .82, mo: 0, hair: "#4a3524" },
  brute: { c: ["#caa07f", "#a87758", "#6b4533"], hs: .9, mo: 1, hair: "#6b4a2a" },
  fat: { c: ["#efd2b8", "#d4a98c", "#9b6f5d"], hs: 1.05, mo: 2, hair: "#3a2a1c" },
  smiler: { c: ["#e0aa96", "#bf7a66", "#85463a"], hs: 1.2, mo: 3, hair: "#120a08" }
};
const TW = { classic: 1, abnormal: .95, lean: .8, brute: 1.25, fat: 1.45, smiler: 1 }, TT = ["classic", "lean", "brute", "fat"];
const pickType = () => { const d = diff(); return Math.random() < .2 + .3 * d ? (Math.random() < .5 ? "abnormal" : "smiler") : TT[(Math.random() * 4) | 0]; };
function drawTitan(t, gs) {
  const x = t.x - camX; if (x < -320 || x > W + 320) return;
  if (t.flying) { drawFlyingTitan(t, gs); return; }
  const h = t.h, w = t.w, gY = -camY, S = TS[t.type] || TS.classic, wob = Math.sin(time * (t.type === "abnormal" ? 10 : 3.2) + t.ph), ol = "#2a1510", tw = w * .5;
  cx.save(); cx.globalAlpha = t.dead ? Math.max(0, t.fade) : 1; cx.lineJoin = "round";
  if (t.dead) { cx.translate(x, gY); cx.rotate((1 - t.fade) * .9); cx.translate(-x, -gY); }
  const sk = cx.createLinearGradient(x - w, 0, x + w, 0); sk.addColorStop(0, S.c[0]); sk.addColorStop(.5, S.c[1]); sk.addColorStop(1, S.c[2]);
  const lim = (x1, y1, x2, y2, lw) => { cx.lineCap = "round"; cx.strokeStyle = ol; cx.lineWidth = lw + 5; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); cx.strokeStyle = sk; cx.lineWidth = lw; cx.stroke(); };
  // brazo trasero y piernas
  lim(x + tw * .85, gY - h * .74, x + tw * .95 + wob * w * .1, gY - h * .38, w * .24);
  lim(x - w * .2, gY - h * .36, x - w * .26 + wob * w * .1, gY - h * .04, w * .3); lim(x + w * .2, gY - h * .36, x + w * .26 - wob * w * .1, gY - h * .04, w * .3);
  cx.fillStyle = "#4a3126"; cx.fillRect(x - w * .5, gY - h * .05, w * .4, h * .05); cx.fillRect(x + w * .08, gY - h * .05, w * .42, h * .05);
  // torso
  cx.fillStyle = sk; cx.strokeStyle = ol; cx.lineWidth = 3; cx.beginPath();
  cx.moveTo(x - tw * .8, gY - h * .3); cx.quadraticCurveTo(x - tw * 1.2, gY - h * .62, x - tw * .9, gY - h * .8); cx.lineTo(x + tw * .9, gY - h * .8); cx.quadraticCurveTo(x + tw * 1.25, gY - h * .6, x + tw * .85, gY - h * .3); cx.closePath(); cx.fill(); cx.stroke();
  if (t.type === "fat") { cx.beginPath(); cx.ellipse(x, gY - h * .42, w * .62, h * .17, 0, 0, 7); cx.fill(); cx.stroke(); }
  cx.strokeStyle = "rgba(120,35,28,.5)"; cx.lineWidth = 2; cx.beginPath();
  for (let i = 0; i < 4; i++) { const yy = gY - h * (.42 + .07 * i); cx.moveTo(x - tw * .6, yy); cx.quadraticCurveTo(x, yy + h * .03, x + tw * .6, yy); }
  cx.moveTo(x, gY - h * .78); cx.lineTo(x, gY - h * .34); cx.stroke();
  // brazo de ataque (misma geometría que la hitbox)
  const sx = x - w * .25, sy = gY - h * .8, L = h * .95, ang = t.th + (t.type === "abnormal" ? Math.sin(time * 7 + t.ph) * .2 : 0), fx = sx - L * Math.cos(ang), fy = sy - L * Math.sin(ang);
  lim(sx, sy, fx, fy, w * .27); cx.fillStyle = sk; cx.strokeStyle = ol; cx.lineWidth = 3; cx.beginPath(); cx.arc(fx, fy, w * .21, 0, 7); cx.fill(); cx.stroke();
  // cabeza
  const hr = w * .42 * S.hs, hy0 = gY - h + hr * .9;
  lim(x, gY - h * .78, x, hy0 + hr * .3, w * .3);
  cx.fillStyle = S.hair; cx.beginPath(); cx.arc(x + hr * .15, hy0 - hr * .1, hr * 1.1, Math.PI * .9, Math.PI * 2.1); cx.fill();
  cx.fillStyle = sk; cx.strokeStyle = ol; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(x, hy0, hr * .95, hr * 1.05, 0, 0, 7); cx.fill(); cx.stroke();
  cx.fillStyle = S.hair; cx.beginPath(); cx.moveTo(x - hr * .98, hy0 - hr * .15);
  for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI, r = hr * (i % 2 ? 1.4 : 1.02); cx.lineTo(x + Math.cos(a) * r, hy0 - hr * .1 + Math.sin(a) * r); }
  cx.lineTo(x + hr * .98, hy0 - hr * .15); cx.lineTo(x + hr * .4, hy0 - hr * .45); cx.lineTo(x - hr * .2, hy0 - hr * .3); cx.lineTo(x - hr * .6, hy0 - hr * .5); cx.closePath(); cx.fill();
  const ey = hy0 - hr * .02, ex = hr * .4, er = hr * (S.mo >= 2 ? .25 : .2);
  for (const sd of [-1, 1]) {
    cx.fillStyle = "#f6efe0"; cx.strokeStyle = ol; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(x + sd * ex, ey, er, er * .8, 0, 0, 7); cx.fill(); cx.stroke();
    cx.fillStyle = t.st === 1 ? "#e0392d" : "#140a08"; cx.beginPath(); cx.arc(x + sd * ex - er * .3, ey, er * .36, 0, 7); cx.fill();
    cx.strokeStyle = ol; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(x + sd * (ex + er * 1.1), ey - er * 1.5); cx.lineTo(x + sd * (ex - er * 1.1), ey - er * .85); cx.stroke();
  }
  cx.fillStyle = "rgba(60,25,20,.6)"; cx.beginPath(); cx.arc(x - hr * .07, hy0 + hr * .25, hr * .05, 0, 7); cx.arc(x + hr * .1, hy0 + hr * .25, hr * .05, 0, 7); cx.fill();
  const my = hy0 + hr * .55, mw = hr * (S.mo >= 2 ? .85 : .55), mh = hr * (S.mo === 3 ? .42 : S.mo === 2 ? .3 : .15);
  cx.fillStyle = "#3b0d0a"; cx.strokeStyle = ol; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x - mw, my - mh * .2); cx.quadraticCurveTo(x, my + mh * 2.2, x + mw, my - mh * .2); cx.quadraticCurveTo(x, my - mh * .6, x - mw, my - mh * .2); cx.fill(); cx.stroke();
  cx.fillStyle = "#f4ead2"; const n = S.mo ? 10 : 7; for (let i = 0; i < n; i++) { const tx = x - mw * .85 + i * (mw * 1.7 / (n - 1)); cx.fillRect(tx - hr * .035, my - mh * .3, hr * .07, mh * .8); if (S.mo >= 2) cx.fillRect(tx - hr * .035, my + mh * .75, hr * .07, mh * .5); }
  if (S.mo >= 2) { cx.strokeStyle = "rgba(100,30,24,.55)"; cx.lineWidth = 2; cx.beginPath(); cx.arc(x - mw, my - mh, hr * .3, 1.2, 2.6); cx.arc(x + mw, my - mh, hr * .3, .5, 1.9); cx.stroke(); }
  if (!t.dead && Math.hypot(p.x - t.x, -t.h * .8 - p.y) < C.range) { cx.strokeStyle = "rgba(120,230,255,.75)"; cx.lineWidth = 2; cx.beginPath(); cx.arc(x - w * .1, gY - h * .8, 11 + Math.sin(time * 8) * 2, 0, 7); cx.stroke(); }
  if (t.st === 1 && !t.dead) {
    cx.strokeStyle = "rgba(224,57,45,.7)"; cx.lineWidth = 5; cx.beginPath(); cx.arc(sx, sy, L, Math.PI - 1.25, Math.PI + .95); cx.stroke();
    cx.fillStyle = "#e0392d"; cx.font = "900 34px Cinzel,serif"; cx.textAlign = "center"; cx.strokeStyle = "#000"; cx.lineWidth = 4; cx.strokeText("!", x, hy0 - hr * 1.7); cx.fillText("!", x, hy0 - hr * 1.7);
  }
  if (!t.dead && Math.random() < .25) parts.push({ x: t.x + rand(-w, w), y: -t.h + rand(-20, 10), vx: rand(-20, 20), vy: -50, l: 1, m: 1, r: rand(3, 6), c: "#fff", g: -20, st: true });
  cx.restore();
}
function drawFlyingTitan(t, gs) {
  const x = t.x - camX, y = t.y - camY, w = t.w, h = t.h; if (x < -220 || x > W + 220) return;
  cx.save(); cx.globalAlpha = t.dead ? Math.max(0, t.fade) : 1; cx.translate(x, y);
  const bob = Math.sin(t.bob) * .05; cx.rotate(bob);
  cx.strokeStyle = "rgba(40,25,20,.45)"; cx.lineWidth = 5;
  cx.beginPath(); cx.moveTo(-w*.25, 0); cx.lineTo(-w*1.7, -h*.65); cx.lineTo(-w*.75, h*.05); cx.moveTo(w*.25, 0); cx.lineTo(w*1.7, -h*.65); cx.lineTo(w*.75, h*.05); cx.stroke();
  cx.fillStyle = "#b66f5b"; cx.beginPath(); cx.ellipse(0, 0, w*.58, h*.72, 0, 0, 7); cx.fill();
  cx.fillStyle = "#d99a7c"; cx.beginPath(); cx.arc(0, -h*.48, w*.48, 0, 7); cx.fill();
  cx.fillStyle = "#2a1715"; cx.beginPath(); cx.arc(0, -h*.65, w*.52, Math.PI, 0); cx.fill();
  cx.fillStyle = "#170b0a"; cx.beginPath(); cx.arc(-w*.18, -h*.48, 4, 0, 7); cx.arc(w*.18, -h*.48, 4, 0, 7); cx.fill();
  cx.fillStyle = "#f5e8d5"; cx.beginPath(); cx.arc(0, -h*.3, w*.28, .1, 3.04); cx.fill();
  cx.fillStyle = "#7c3027"; cx.fillRect(-w*.18, -h*.2, w*.36, 4);
  // garras
  cx.strokeStyle = "#8f594b"; cx.lineWidth = Math.max(5, w*.14); cx.lineCap = "round"; cx.beginPath(); cx.moveTo(-w*.4,h*.2); cx.lineTo(-w*.9,h*.6); cx.moveTo(w*.4,h*.2); cx.lineTo(w*.9,h*.6); cx.stroke();
  if (Math.hypot(p.x - t.x, p.y - t.y) < C.range && !t.dead) { cx.strokeStyle = "rgba(120,230,255,.65)"; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, -h*.48, w*.75 + Math.sin(time*8)*3, 0, 7); cx.stroke(); }
  cx.restore();
}

function drawPlayer(x, y) {
  const a = Math.atan2(p.vy, p.vx), blink = inv > 0 && Math.floor(time * 18) % 2; if (blink) return; cx.save(); cx.translate(x, y); cx.rotate(clamp(a, -1.1, 1.1) * .6);
  cx.fillStyle = "#2f5b3a"; cx.beginPath(); cx.moveTo(-3, -8); cx.quadraticCurveTo(-26 - Math.min(14, Math.hypot(p.vx, p.vy) / 40), 2 + Math.sin(time * 14) * 3, -22, 16 + Math.sin(time * 12) * 2); cx.lineTo(-2, 8); cx.fill();
  cx.strokeStyle = "#e8f0ff"; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(-14, 4); cx.lineTo(-21, 10); cx.moveTo(-13, 7); cx.lineTo(-19, 14); cx.stroke(); cx.fillStyle = "#6b4a2f"; cx.fillRect(-7, -8, 14, 18); // Dunk Low Panda
  cx.fillStyle = "#fff"; cx.fillRect(-7, 10, 7, 6); cx.fillRect(1, 10, 7, 6);
  cx.fillStyle = "#050505"; cx.fillRect(-7, 13, 3, 3); cx.fillRect(5, 13, 3, 3);
  cx.fillRect(-5, 11, 4, 2); cx.fillRect(3, 11, 4, 2);
  cx.fillStyle = "#9aa4b2"; cx.fillRect(-10, 2, 5, 11); cx.fillRect(5, 2, 5, 11); cx.fillStyle = "#e8c9a4"; cx.beginPath(); cx.arc(1, -13, 5.5, 0, 7); cx.fill(); cx.fillStyle = "#4a3320"; cx.beginPath(); cx.arc(1, -15, 5.8, Math.PI, 0); cx.fill();
  if (hook) { cx.strokeStyle = "#dfe6ee"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(6, -2); cx.lineTo(20, -10); cx.stroke(); }
  cx.restore();
}

/* ---------- HUD ---------- */
function hud() {
  $("hScore").textContent = Math.floor(score); $("hDist").textContent = Math.floor(maxX / 10) + " m"; $("hBest").textContent = Math.max(top[0] || 0, Math.floor(score));
  $("hGas").style.width = gas + "%"; $("hGas").style.opacity = gas >= C.gasCost ? 1 : .45;
  $("hHp").innerHTML = Array.from({ length: C.maxHp }, (_, i) => `<span class="${i < hp ? "" : "off"}">⚔</span>`).join("");
  $("hLv").textContent = ["Calma", "Marcha", "Persecución", "Furia"][Math.min(3, Math.floor(diff() * 4))];
  const c = $("hCombo"); c.hidden = combo < 2; if (combo >= 2) c.textContent = `COMBO ×${(1 + Math.min(combo, 10) * .25).toFixed(2)}`;
}

/* ---------- PANTALLAS ---------- */
const screens = ["intro", "howto", "paused", "over"];
function show(n) { screens.forEach(s => $(s).hidden = s !== n); $("hud").hidden = n !== null && n !== "paused"; if (n === null) $("hud").hidden = false; }
function start() { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} ac && ac.resume(); reset(); state = "play"; show(null); }
function howto(back) { howBack = back; state = back === "play" ? "paused" : "howto"; show("howto"); }
let howBack = "howto", introT = 0;
function endIntro() { clearTimeout(introT); if (state === "intro") { state = "howto"; show("howto"); } }
function pause() { if (state === "play") { state = "paused"; show("paused"); } else if (state === "paused") { state = "play"; show(null); } }

/* ---------- ENTRADA ---------- */
cv.addEventListener("pointerdown", e => { e.preventDefault(); if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (er) {} const r = cv.getBoundingClientRect(); aim = { x: e.clientX - r.left, y: e.clientY - r.top, down: true }; fire(); });
cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); aim = { x: e.clientX - r.left, y: e.clientY - r.top, down: aim ? aim.down : false }; });
window.addEventListener("pointerup", () => { if (aim) aim.down = false; release(); }); window.addEventListener("pointercancel", () => { if (aim) aim.down = false; release(); });
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("wheel", e => {
  if (state !== "play" || !hook) return;
  e.preventDefault();
  const amount = clamp(e.deltaY, -240, 240);
  if (amount > 0) { hook.len = Math.max(70, hook.len - 20); wheelBoost = -600; }
  else { hook.len = Math.min(C.range, hook.len + 30); wheelBoost = 350; }
}, { passive: false });

window.addEventListener("keydown", e => {
  const k = e.key.toLowerCase(); if (e.repeat) return;
  if (k === " ") { e.preventDefault(); if (state === "play") boost(); else if (state === "howto" || state === "over") start(); else if (state === "intro") endIntro(); }
  else if (k === "enter") { if (state === "howto" || state === "over") start(); else if (state === "intro") endIntro(); }
  else if (k === "p" || k === "escape") { e.preventDefault(); pause(); }
  else if (k === "r" && (state === "play" || state === "paused" || state === "over")) start();
  else if (k === "w" || k === "arrowup") { e.preventDefault(); keys[k] = true; }
});
window.addEventListener("keyup", e => { const k = e.key.toLowerCase(); if (k === "w" || k === "arrowup") { keys[k] = false; if (!aim?.down) release(); } });
$("tBoost").addEventListener("pointerdown", e => { e.preventDefault(); boost(); });
$("startBtn").onclick = () => state === "paused" ? pause() : start(); $("resumeBtn").onclick = pause; $("restart1").onclick = start; $("restart2").onclick = start;
$("skipIntro").onclick = endIntro; $("helpBtn").onclick = () => { if (state === "play") { state = "paused"; } if (state !== "intro") show("howto"); };
$("helpBtn2").onclick = () => { state = "howto"; show("howto"); };
$("muteBtn").onclick = () => { muted = !muted; $("muteBtn").textContent = muted ? "🔇" : "🔊"; };
window.addEventListener("keydown", e => { const k = e.key.toLowerCase(); if (k === "shift" || k === "s") keys[k] = true; });
window.addEventListener("keyup", e => { const k = e.key.toLowerCase(); if (k === "shift" || k === "s") keys[k] = false; });
window.addEventListener("blur", () => { if (state === "play") pause(); }); window.addEventListener("resize", resize);

/* ---------- BUCLE ---------- */
function loop(ts) { requestAnimationFrame(loop); const dt = Math.min(.033, (ts - (last || ts)) / 1000); last = ts; if (state === "play") { update(dt); } else { time += dt; if (state === "intro") { camX = p.x - W*.42 + time*120; camY = lerp(camY, -H*0.7, dt*2); } } draw(); if (state === "play") hud(); }
resize(); reset(); show("intro"); state = "intro"; introT = setTimeout(endIntro, 5600); requestAnimationFrame(loop);
})();