(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const actionBtn = document.getElementById("actionBtn");
  const scoreEl = document.getElementById("score");
  const speedEl = document.getElementById("speed");
  const bestEl = document.getElementById("best");
  const atkText = document.getElementById("atkText");
  const atkFill = document.getElementById("atkFill");
  const powText = document.getElementById("powText");
  const powFill = document.getElementById("powFill");

  const BEST_KEY = "aot_odm_best";

  const CFG = {
    gravity: 1050,
    thrustV: 2400,
    thrustH: 900,
    baseBoost: 120,
    maxRise: -620,
    maxFall: 780,
    baseSpeed: 200,
    maxSpeed: 360,
    speedMin: 100,
    speedMax: 560,
    ceiling: 58,
    maxRope: 620,
    attackDuration: 1,
    attackCooldown: 3,
    attackRadius: 165,
    powerDuration: 8,
    powerCooldown: 1.2,
    powerThrust: 1.25,
    gapMax: 245,
    gapMin: 165,
    spawnBase: 620,
    spawnMin: 330,
  };

  let W = 0;
  let H = 0;
  let floorY = 0;
  let lastTime = 0;

  let state = "start";
  let dist = 0;
  let bonus = 0;
  let score = 0;
  let best = getBest();
  let shake = 0;
  let speed = CFG.baseSpeed;

  const player = { x: 0, y: 0, vy: 0, angle: 0 };
  const aim = { x: 0, y: 0 };
  const obstacles = [];
  const particles = [];
  const leaves = [];

  let held = false;
  let anchor = null;
  let attackT = 0;
  let cdT = 0;
  let powerT = 0;

  let audioCtx = null;

  function getBest() {
    try {
      return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
    } catch {
      return 0;
    }
  }

  function setBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // Silencioso
    }
  }

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      // Sin audio
    }
  }

  function sound(freq, slide, dur, vol, type) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime;

      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);

      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Silencioso
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    W = rect.width;
    H = rect.height;
    floorY = H - Math.max(56, H * 0.12);
    player.x = W * 0.26;

    if (state !== "playing") {
      player.y = H * 0.45;
    }
    aim.x = player.x + 130;
    aim.y = player.y - 130;
  }

  function difficulty() {
    return clamp(dist / 3200, 0, 1);
  }

  function reset() {
    initAudio();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();

    state = "playing";
    dist = 0;
    bonus = 0;
    score = 0;
    shake = 0;
    attackT = 0;
    cdT = 0;
    powerT = 0;
    held = false;
    anchor = null;
    speed = CFG.baseSpeed;

    player.y = H * 0.45;
    player.vy = 0;
    player.angle = 0;
    aim.x = player.x + 130;
    aim.y = player.y - 130;

    obstacles.length = 0;
    particles.length = 0;

    obstacles.push(makeObstacle(W + 200));
    obstacles.push(makeObstacle(W + 200 + CFG.spawnBase));

    overlay.classList.add("hidden");
  }

  function gameOver() {
    if (state !== "playing") return;
    state = "over";
    held = false;
    anchor = null;
    sound(140, 60, 0.35, 0.25, "sawtooth");

    if (score > best) {
      best = score;
      setBest(best);
    }

    overlayTitle.textContent = "Has caído";
    overlayText.textContent = `Distancia: ${score} m · Mejor: ${best} m. Engánchate a los muros para girar y mata titanes para activar el poder.`;
    actionBtn.textContent = "Reintentar";
    overlay.classList.remove("hidden");
  }

  function makeObstacle(x) {
    const d = difficulty();
    const gapH = lerp(CFG.gapMax, CFG.gapMin, d);
    const margin = 90;
    const gapY = CFG.ceiling + margin + Math.random() * (floorY - CFG.ceiling - gapH - margin * 2);
    const titan = Math.random() < 0.28 && d > 0.15;
    const titanH = titan ? 190 + Math.random() * 90 : 0;

    return {
      x,
      w: titan ? 74 : 62,
      gapY,
      gapH,
      titan,
      titanH,
      hanging: titan && Math.random() < 0.5,
      dead: false,
      seed: Math.random(),
    };
  }

  function spawnIfNeeded() {
    const last = obstacles[obstacles.length - 1];
    const d = difficulty();
    const gapPx = lerp(CFG.spawnBase, CFG.spawnMin, d) + Math.random() * 90;

    if (!last || last.x - dist < W + 200) {
      obstacles.push(makeObstacle((last ? last.x : dist) + gapPx));
    }
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.35 + Math.random());
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        life: 1,
        decay: 1.4 + Math.random(),
        size: 2 + Math.random() * 3.5,
        color,
        blood: false,
      });
    }
  }

  function bloodBurst(x, y) {
    for (let i = 0; i < 26; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 320 * (0.3 + Math.random());
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 120,
        life: 1,
        decay: 0.8 + Math.random() * 0.6,
        size: 2.5 + Math.random() * 4,
        color: Math.random() < 0.5 ? "#7c141c" : "#c22a2a",
        blood: true,
      });
    }
  }

  function obstacleRects(o, sx) {
    if (o.titan) {
      if (o.hanging) {
        return [{ x: sx, y: CFG.ceiling, w: o.w, h: o.titanH }];
      }
      return [{ x: sx, y: floorY - o.titanH, w: o.w, h: o.titanH }];
    }

    return [
      { x: sx, y: CFG.ceiling, w: o.w, h: o.gapY - CFG.ceiling },
      { x: sx, y: o.gapY + o.gapH, w: o.w, h: floorY - (o.gapY + o.gapH) },
    ];
  }

  // Intersección rayo vs rect. Devuelve t o null.
  function rayRect(r, dirX, dirY, maxT) {
    const ox = player.x;
    const oy = player.y;

    if (ox > r.x && ox < r.x + r.w && oy > r.y && oy < r.y + r.h) return null;

    let tmin = 0;
    let tmax = maxT;

    if (Math.abs(dirX) < 0.0001) {
      if (ox < r.x || ox > r.x + r.w) return null;
    } else {
      let t1 = (r.x - ox) / dirX;
      let t2 = (r.x + r.w - ox) / dirX;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    if (Math.abs(dirY) < 0.0001) {
      if (oy < r.y || oy > r.y + r.h) return null;
    } else {
      let t1 = (r.y - oy) / dirY;
      let t2 = (r.y + r.h - oy) / dirY;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    if (tmin <= 0.001) return null;
    return tmin;
  }

  // Raycast en una dirección: techo o muros/titanes.
  function castRay(dirX, dirY, maxT) {
    let bestT = Infinity;
    let bestPt = null;

    if (dirY < -0.0001) {
      const t = (CFG.ceiling - player.y) / dirY;
      if (t > 24 && t < maxT) {
        const hx = player.x + dirX * t;
        if (hx >= 0 && hx <= W) {
          bestT = t;
          bestPt = { x: hx, y: CFG.ceiling, kind: "ceiling" };
        }
      }
    }

    for (const o of obstacles) {
      if (o.dead) continue;
      const sx = o.x - dist;
      if (sx > player.x + maxT + 200 || sx + o.w < player.x - maxT - 200) continue;

      for (const r of obstacleRects(o, sx)) {
        const t = rayRect(r, dirX, dirY, maxT);
        if (t !== null && t > 24 && t < bestT) {
          bestT = t;
          bestPt = { x: player.x + dirX * t, y: player.y + dirY * t, kind: "wall" };
        }
      }
    }

    return bestPt;
  }

  // Engancha a la superficie más cercana en la dirección del apuntado,
  // con tolerancia de ángulo para que enganchar muros sea fácil.
  function resolveAnchor() {
    const dx = aim.x - player.x;
    const dy = aim.y - player.y;
    const baseA = Math.atan2(dy, dx);
    const maxT = CFG.maxRope;

    let best = null;
    let bestDist = Infinity;

    const offsets = [0, 0.1, -0.1, 0.22, -0.22];

    for (const off of offsets) {
      const a = baseA + off;
      const pt = castRay(Math.cos(a), Math.sin(a), maxT);
      if (pt) {
        const d = Math.hypot(pt.x - player.x, pt.y - player.y);
        if (d < bestDist) {
          bestDist = d;
          best = pt;
        }
      }
    }

    return best;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function destroyObstacle(o, sx) {
    o.dead = true;
    bonus += 50;
    shake = Math.min(11, shake + 7);
    const cy = o.titan
      ? (o.hanging ? CFG.ceiling + o.titanH / 2 : floorY - o.titanH / 2)
      : o.gapY + o.gapH / 2;

    if (o.titan) {
      bloodBurst(sx + o.w / 2, cy);
      powerT = CFG.powerDuration;
      sound(70, 38, 0.45, 0.3, "sawtooth");
      sound(200, 640, 0.3, 0.14, "triangle");
      atkText.textContent = "PODER";
    } else {
      burst(sx + o.w / 2, cy, "#9aa0a8", 26, 280);
      burst(sx + o.w / 2, cy, "#ffffff", 10, 200);
      sound(90, 40, 0.25, 0.3, "sawtooth");
    }
  }

  function attack() {
    if (state !== "playing" || attackT > 0 || cdT > 0) return;

    attackT = CFG.attackDuration;
    sound(320, 90, 0.3, 0.22, "square");
    burst(player.x, player.y, "#f2c200", 18, 240);

    for (const o of obstacles) {
      if (o.dead) continue;
      const sx = o.x - dist;
      const cx = sx + o.w / 2;
      if (cx > player.x - 50 && cx < player.x + CFG.attackRadius) {
        destroyObstacle(o, sx);
      }
    }
  }

  function update(dt) {
    if (state !== "playing") return;

    dist += speed * dt;
    score = Math.floor(dist / 10) + bonus;

    if (powerT > 0) powerT = Math.max(0, powerT - dt);

    if (attackT > 0) {
      attackT = Math.max(0, attackT - dt);
      if (attackT === 0) cdT = powerT > 0 ? CFG.powerCooldown : CFG.attackCooldown;
    } else if (cdT > 0) {
      cdT = Math.max(0, cdT - dt);
    }

    anchor = held ? resolveAnchor() : null;

    const base = lerp(CFG.baseSpeed, CFG.maxSpeed, difficulty());
    speed = lerp(speed, base, 0.6 * dt);

    player.vy += CFG.gravity * dt;

    if (anchor) {
      const dx = anchor.x - player.x;
      const dy = anchor.y - player.y;
      const d = Math.max(30, Math.hypot(dx, dy));
      const boost = powerT > 0 ? CFG.powerThrust : 1;

      player.vy += (dy / d) * CFG.thrustV * boost * dt;
      speed += (dx / d) * CFG.thrustH * boost * dt;
    }

    if (held) speed += CFG.baseBoost * dt;

    speed = clamp(speed, CFG.speedMin, CFG.speedMax);
    player.vy = clamp(player.vy, CFG.maxRise, CFG.maxFall);
    player.y += player.vy * dt;

    if (player.y < CFG.ceiling + 16) {
      player.y = CFG.ceiling + 16;
      player.vy = Math.max(player.vy, 40);
    }

    if (player.y > floorY - 14) {
      player.y = floorY - 14;
      gameOver();
      return;
    }

    player.angle = clamp(player.vy / 700, -0.5, 0.9);

    spawnIfNeeded();

    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const o = obstacles[i];
      const sx = o.x - dist;

      if (sx < -200) {
        obstacles.splice(i, 1);
        continue;
      }

      if (o.dead) continue;

      const pr = { x: player.x - 9, y: player.y - 13, w: 18, h: 26 };

      for (const r of obstacleRects(o, sx)) {
        if (aabb(pr, r)) {
          if (attackT > 0) {
            destroyObstacle(o, sx);
            break;
          }
          gameOver();
          return;
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.vy += (p.blood ? 1500 : 900) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (Math.random() < dt * 6) {
      leaves.push({
        x: Math.random() * W,
        y: -10,
        vx: -20 - Math.random() * 30,
        vy: 40 + Math.random() * 50,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 3,
        size: 3 + Math.random() * 4,
      });
    }

    for (let i = leaves.length - 1; i >= 0; i -= 1) {
      const l = leaves[i];
      l.x += (l.vx - speed * 0.15) * dt;
      l.y += l.vy * dt;
      l.r += l.vr * dt;
      if (l.y > H + 20) leaves.splice(i, 1);
    }

    shake = Math.max(0, shake - dt * 30);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#22302a");
    g.addColorStop(0.55, "#33463a");
    g.addColorStop(1, "#1d2a24");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sun = ctx.createRadialGradient(W * 0.78, H * 0.24, 8, W * 0.78, H * 0.24, 200);
    sun.addColorStop(0, "rgba(242, 194, 0, 0.28)");
    sun.addColorStop(1, "rgba(242, 194, 0, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitanSilhouette() {
    const factor = 0.07;
    const spacing = 1400;
    const off = dist * factor;
    const startI = Math.floor((off - 600) / spacing);
    const endI = Math.floor((off + W + 600) / spacing);

    ctx.fillStyle = "rgba(12, 18, 14, 0.55)";

    for (let i = startI; i <= endI; i += 1) {
      if (hash(i * 3.3) < 0.5) continue;
      const x = i * spacing - off + hash(i) * 400;
      const h = 360 + hash(i + 9) * 140;
      const baseY = floorY - 30;
      const w = h * 0.32;

      ctx.beginPath();
      ctx.moveTo(x - w / 2, baseY);
      ctx.lineTo(x - w / 2, baseY - h * 0.7);
      ctx.quadraticCurveTo(x, baseY - h, x + w / 2, baseY - h * 0.7);
      ctx.lineTo(x + w / 2, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, baseY - h * 0.78, w * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTreeLayer(factor, spacing, hMin, hMax, color, trunk) {
    const off = dist * factor;
    const startI = Math.floor((off - 100) / spacing);
    const endI = Math.floor((off + W + 100) / spacing);

    for (let i = startI; i <= endI; i += 1) {
      const x = i * spacing - off + hash(i) * spacing * 0.4;
      const h = hMin + hash(i + 5) * (hMax - hMin);
      const baseY = floorY - 6;
      const w = h * 0.16;

      ctx.fillStyle = trunk;
      ctx.fillRect(x - w / 2, baseY - h, w, h);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, baseY - h - h * 0.55);
      ctx.lineTo(x - h * 0.28, baseY - h * 0.42);
      ctx.lineTo(x + h * 0.28, baseY - h * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, baseY - h - h * 0.8);
      ctx.lineTo(x - h * 0.2, baseY - h * 0.6);
      ctx.lineTo(x + h * 0.2, baseY - h * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCanopy() {
    const off = dist;

    ctx.fillStyle = "#243b2c";
    ctx.fillRect(0, 0, W, CFG.ceiling - 16);

    for (let x = 0; x <= W + 50; x += 50) {
      const r = 22 + hash(Math.floor((x + off) / 50)) * 14;
      ctx.beginPath();
      ctx.arc(x, CFG.ceiling - 16, r, 0, Math.PI);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(200, 205, 215, 0.16)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, CFG.ceiling);
    ctx.lineTo(W, CFG.ceiling);
    ctx.stroke();
  }

  function drawFog() {
    const band = (y, h, a, factor) => {
      const off = dist * factor;
      const g = ctx.createLinearGradient(0, y - h, 0, y + h);
      g.addColorStop(0, "rgba(180, 200, 180, 0)");
      g.addColorStop(0.5, `rgba(180, 200, 180, ${a})`);
      g.addColorStop(1, "rgba(180, 200, 180, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y - h, W, h * 2);

      ctx.fillStyle = `rgba(190, 210, 190, ${a * 0.5})`;
      for (let x = -off % 220; x < W; x += 220) {
        ctx.beginPath();
        ctx.ellipse(x, y, 120, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    band(H * 0.62, 26, 0.05, 0.2);
    band(floorY - 18, 22, 0.08, 0.5);
  }

  function drawGround() {
    ctx.fillStyle = "#233428";
    ctx.fillRect(0, floorY, W, H - floorY);

    ctx.fillStyle = "#2c4531";
    ctx.fillRect(0, floorY, W, 8);

    const off = dist % 46;
    ctx.strokeStyle = "rgba(120, 160, 110, 0.35)";
    ctx.lineWidth = 1.5;

    for (let x = -off; x < W + 46; x += 46) {
      const h = 6 + hash(Math.floor((x + dist) / 46)) * 8;
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x + 3, floorY - h);
      ctx.moveTo(x + 12, floorY);
      ctx.lineTo(x + 14, floorY - h * 0.7);
      ctx.stroke();
    }
  }

  function drawObstacle(o) {
    const sx = o.x - dist;
    if (sx > W + 120 || sx < -200 || o.dead) return;

    if (o.titan) {
      const r = obstacleRects(o, sx)[0];

      ctx.fillStyle = "#c88d66";
      ctx.fillRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = "rgba(140, 60, 50, 0.35)";
      for (let y = r.y + 14; y < r.y + r.h; y += 26) {
        ctx.fillRect(r.x + 6, y, r.w - 12, 3);
      }

      const headY = o.hanging ? r.y + r.h + 22 : r.y - 22;
      ctx.fillStyle = "#d7a27e";
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, headY, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1a0d0a";
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2 - 7, headY - 3, 2.6, 0, Math.PI * 2);
      ctx.arc(r.x + r.w / 2 + 7, headY - 3, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(150, 40, 40, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2 - 8, headY + 8);
      ctx.lineTo(r.x + r.w / 2 + 8, headY + 8);
      ctx.stroke();

      return;
    }

    for (const r of obstacleRects(o, sx)) {
      ctx.fillStyle = "#6d737c";
      ctx.fillRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      for (let y = r.y + 10; y < r.y + r.h - 6; y += 22) {
        ctx.fillRect(r.x + 4, y, r.w - 8, 2);
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(r.x, r.y, 4, r.h);

      ctx.fillStyle = "#3f6b3a";
      ctx.fillRect(r.x, r.y + r.h - 6, r.w, 6);
    }

    ctx.strokeStyle = "rgba(90, 70, 50, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, o.gapY + 4);
    ctx.lineTo(sx + o.w, o.gapY + 4);
    ctx.moveTo(sx, o.gapY + o.gapH - 4);
    ctx.lineTo(sx + o.w, o.gapY + o.gapH - 4);
    ctx.stroke();
  }

  function drawCable() {
    if (!anchor || !held || state !== "playing") return;

    const x1 = player.x + 2;
    const y1 = player.y - 8;
    const x2 = anchor.x;
    const y2 = anchor.y;
    const sag = anchor.kind === "ceiling" ? 0 : 8;

    ctx.save();
    ctx.strokeStyle = "#c3c9d4";
    ctx.shadowColor = "rgba(200, 206, 218, 0.9)";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const midX = (x1 + x2) / 2 + Math.sin(Date.now() * 0.02) * 2;
    const midY = (y1 + y2) / 2 + sag;
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    // Punto de enganche
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x2, y2, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(220, 226, 236, 0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x2, y2, 6 + Math.sin(Date.now() * 0.02) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawAimGuide() {
    if (!held || state !== "playing") return;

    const dx = aim.x - player.x;
    const dy = aim.y - player.y;
    const d = Math.hypot(dx, dy) || 1;

    ctx.save();
    ctx.globalAlpha = anchor ? 0.2 : 0.1;
    ctx.strokeStyle = "#c3c9d4";
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
      player.x + (dx / d) * Math.min(d, CFG.maxRope),
      player.y + (dy / d) * Math.min(d, CFG.maxRope)
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    if (state === "over") return;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Capa verde (manto de la Legión)
    ctx.fillStyle = "#5a8a44";
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.quadraticCurveTo(-24, 2, -17, 15);
    ctx.lineTo(-2, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#3f6b3a";
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(-16, 4, -11, 13);
    ctx.lineTo(-3, 7);
    ctx.closePath();
    ctx.fill();

    // Cuerpo
    ctx.fillStyle = "#4a5560";
    ctx.fillRect(-6, -8, 12, 18);

    ctx.strokeStyle = "#2b3038";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(6, -2);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 4);
    ctx.stroke();

    ctx.fillStyle = "#8a9098";
    ctx.fillRect(-7, 6, 14, 4);

    ctx.fillStyle = "#e7c9a8";
    ctx.beginPath();
    ctx.arc(0, -12, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#20242a";
    ctx.fillRect(-5, -14, 10, 3);

    ctx.restore();

    // Aura verde del poder
    if (powerT > 0) {
      const pulse = 0.5 + Math.sin(Date.now() * 0.006) * 0.25;
      ctx.save();
      ctx.globalAlpha = 0.25 + pulse * 0.2;
      ctx.strokeStyle = "#7db35f";
      ctx.shadowColor = "#7db35f";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 24 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAttack() {
    if (attackT <= 0) return;

    const p = attackT / CFG.attackDuration;
    const r = CFG.attackRadius;
    const blade = powerT > 0 ? "#7db35f" : "#f2c200";

    ctx.save();
    ctx.translate(player.x, player.y);

    if (p > 0.82) {
      const f = (p - 0.82) / 0.18;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.15);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * f})`);
      g.addColorStop(0.35, `rgba(242,194,0,${0.6 * f})`);
      g.addColorStop(1, "rgba(242,194,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.45 + 0.45 * p;
    ctx.strokeStyle = blade;
    ctx.shadowColor = blade;
    ctx.shadowBlur = 20;
    ctx.lineWidth = 2 + 2 * p;
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.55 + (1 - p) * 0.4), 0, Math.PI * 2);
    ctx.stroke();

    const rot = (1 - p) * Math.PI * 3.2;
    for (let k = 0; k < 2; k += 1) {
      const a0 = rot + k * Math.PI;
      ctx.strokeStyle = blade;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, a0, a0 + 1.15);
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, a0 + 0.05, a0 + 1.1);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.5 * p;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k += 1) {
      const a = rot * 0.5 + k * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.blood) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves() {
    for (const l of leaves) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.r);
      ctx.fillStyle = "#4c7a44";
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawVignette() {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawSky();
    drawTitanSilhouette();
    drawTreeLayer(0.15, 210, 90, 150, "#22332b", "#1b2620");
    drawTreeLayer(0.35, 150, 130, 210, "#2b4232", "#223028");
    drawFog();
    drawCanopy();
    drawGround();

    for (const o of obstacles) drawObstacle(o);

    drawLeaves();
    drawAimGuide();
    drawCable();
    drawPlayer();
    drawAttack();
    drawParticles();

    ctx.restore();
    drawVignette();
  }

  function updateHUD() {
    scoreEl.textContent = score;
    speedEl.textContent = Math.round(speed / 10);
    bestEl.textContent = best;

    if (attackT > 0) {
      atkText.textContent = "ATAQUE";
      atkFill.style.width = "100%";
      atkFill.classList.add("ready");
    } else if (cdT > 0) {
      atkText.textContent = "RECARGA";
      atkFill.style.width = `${((CFG.attackCooldown - cdT) / CFG.attackCooldown) * 100}%`;
      atkFill.classList.remove("ready");
    } else {
      atkText.textContent = "LISTO";
      atkFill.style.width = "100%";
      atkFill.classList.add("ready");
    }

    if (powerT > 0) {
      powText.textContent = "ACTIVO";
      powFill.style.width = `${(powerT / CFG.powerDuration) * 100}%`;
      powFill.classList.add("active");
    } else {
      powText.textContent = "—";
      powFill.style.width = "0%";
      powFill.classList.remove("active");
    }
  }

  function frame(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min(0.033, (time - lastTime) / 1000);
    lastTime = time;

    update(dt);
    draw();
    updateHUD();

    requestAnimationFrame(frame);
  }

  function setAim(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    aim.x = clientX - rect.left;
    aim.y = clientY - rect.top;
  }

  function startHeld(clientX, clientY) {
    initAudio();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (typeof clientX === "number") setAim(clientX, clientY);
    const a = resolveAnchor();
    if (a) burst(a.x, a.y, "#c3c9d4", 6, 140);
    sound(520, 900, 0.12, 0.12, "triangle");
    held = true;
  }

  function endHeld() {
    if (held) sound(700, 380, 0.1, 0.08, "triangle");
    held = false;
    anchor = null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "playing") return;
    e.preventDefault();
    startHeld(e.clientX, e.clientY);
  });

  canvas.addEventListener("pointermove", (e) => {
    setAim(e.clientX, e.clientY);
  });

  window.addEventListener("pointerup", endHeld);
  window.addEventListener("pointercancel", endHeld);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state !== "playing") {
        reset();
        return;
      }
      attack();
    }

    if (e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (state === "playing" && !e.repeat) {
        aim.x = player.x + 130;
        aim.y = player.y - 130;
        startHeld();
      }
    }

    if (e.code === "Enter" && state !== "playing") reset();
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowUp" || e.code === "KeyW") endHeld();
  });

  actionBtn.addEventListener("click", reset);
  window.addEventListener("resize", resize);

  resize();
  requestAnimationFrame(frame);
})();