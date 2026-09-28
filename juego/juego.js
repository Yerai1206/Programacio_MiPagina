(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const pauseBtn = document.getElementById("pause-btn");

  const bestKey = "aot_odm_best";

  let W = 0;
  let H = 0;
  let dpr = 1;
  let floor = 0;
  let best = Number(localStorage.getItem(bestKey) || 0);
  let last = performance.now();
  let state;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    floor = H - 70;

    if (state && state.player) {
      state.player.x = Math.max(60, Math.min(state.player.x, W * 0.68));
      state.player.y = Math.min(state.player.y, floor - 20);
    }
  }

  function reset() {
    state = {
      started: false,
      paused: false,
      gameOver: false,
      time: 0,
      distance: 0,
      bonus: 0,
      score: 0,
      speed: 200,
      spawnTimer: 0.9,
      player: {
        x: W * 0.28,
        y: floor - 120,
        vx: 0,
        vy: 0,
        r: 18
      },
      obstacles: [],
      particles: [],
      pointer: false,
      hooked: false,
      anchor: null,
      cableLen: 0,
      attack: {
        active: false,
        timer: 0,
        cooldown: 0
      },
      power: {
        timer: 0
      },
      shake: 0
    };

    updateHUD();
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(state.score);
    if (bestEl) bestEl.textContent = String(best);
  }

  function start() {
    if (state.gameOver) reset();
    state.started = true;
    state.paused = false;
    state.gameOver = false;
  }

  function restart() {
    reset();
    start();
  }

  function togglePause() {
    if (!state.started || state.gameOver) return;
    state.paused = !state.paused;
  }

  function gameOver() {
    if (state.gameOver) return;

    state.gameOver = true;
    state.pointer = false;
    state.hooked = false;

    if (state.score > best) {
      best = state.score;
      localStorage.setItem(bestKey, String(best));
    }

    updateHUD();
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 0.8) * 280,
        life: 0.6 + Math.random() * 0.4,
        color,
        r: 2 + Math.random() * 3
      });
    }
  }

  function killObstacle(index) {
    const o = state.obstacles[index];
    if (!o) return;

    const isTitan = o.type === "titan";
    state.bonus += isTitan ? 50 : 10;

    addParticles(
      o.x + o.w / 2,
      o.y + o.h / 2,
      isTitan ? "#dc2626" : "#94a3b8",
      isTitan ? 30 : 14
    );

    state.obstacles.splice(index, 1);

    if (isTitan) {
      state.power.timer = 8;
      state.shake = 0.6;
    }
  }

  function spawnObstacle() {
    const x = W + 80;
    const roll = Math.random();

    if (roll < 0.42) {
      const h = 130 + Math.random() * 170;
      state.obstacles.push({
        type: "wall",
        x,
        y: floor - h,
        w: 48,
        h,
        seed: Math.random() * 100
      });
    } else if (roll < 0.66) {
      const h = 90 + Math.random() * 110;
      state.obstacles.push({
        type: "pillar",
        x,
        y: floor - h,
        w: 34,
        h,
        seed: Math.random() * 100
      });
    } else if (roll < 0.86) {
      const w = 84 + Math.random() * 40;
      const h = 38 + Math.random() * 18;
      const y = floor - 150 - Math.random() * 140;
      state.obstacles.push({
        type: "block",
        x,
        y,
        w,
        h,
        seed: Math.random() * 100
      });
    } else {
      state.obstacles.push({
        type: "titan",
        x,
        y: floor - 210 - Math.random() * 70,
        w: 76,
        h: 120,
        seed: Math.random() * 100
      });
    }
  }

  function findAnchor() {
    const p = state.player;
    const maxCable = 620;

    let bestAnchor = null;
    let bestDistance = Infinity;

    function addCandidate(x, y) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestDistance && d <= maxCable) {
        bestDistance = d;
        bestAnchor = { x, y };
      }
    }

    addCandidate(p.x, 0);

    for (const o of state.obstacles) {
      const cx = Math.max(o.x, Math.min(p.x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(p.y, o.y + o.h));

      if (cy <= p.y - 4 || cx >= p.x + 4) {
        addCandidate(cx, cy);
      }
    }

    return bestAnchor;
  }

  function circleRect(px, py, pr, o) {
    const cx = Math.max(o.x, Math.min(px, o.x + o.w));
    const cy = Math.max(o.y, Math.min(py, o.y + o.h));
    return Math.hypot(px - cx, py - cy) < pr;
  }

  function attack() {
    if (!state.started || state.gameOver || state.paused) return;
    if (state.attack.cooldown > 0) return;

    state.attack.active = true;
    state.attack.timer = 0.22;
    state.attack.cooldown = state.power.timer > 0 ? 0.45 : 1.2;
  }

  function update(dt) {
    if (!state.started || state.paused || state.gameOver) return;

    state.time += dt;

    state.speed = Math.min(360, 200 + state.score * 0.18);
    state.distance += state.speed * dt;
    state.score = Math.floor(state.distance / 10) + state.bonus;

    if (state.power.timer > 0) {
      state.power.timer = Math.max(0, state.power.timer - dt);
    }

    if (state.attack.cooldown > 0) {
      state.attack.cooldown = Math.max(0, state.attack.cooldown - dt);
    }

    if (state.attack.active && state.attack.timer <= 0) {
      state.attack.active = false;
    } else if (state.attack.active) {
      state.attack.timer -= dt;
    }

    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 2);
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnObstacle();
      state.spawnTimer = Math.max(0.58, 1.25 - state.speed / 520);
    }

    for (const o of state.obstacles) {
      o.x -= state.speed * dt;

      if (o.type === "titan") {
        o.y += Math.sin(state.time * 2 + o.seed) * 14 * dt;
      }
    }

    state.obstacles = state.obstacles.filter((o) => o.x + o.w > -120);

    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 600 * dt;
      pt.life -= dt;
    }

    state.particles = state.particles.filter((pt) => pt.life > 0);

    const p = state.player;

    if (state.attack.active) {
      for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
        const o = state.obstacles[i];
        if (o.x + o.w > p.x - 10 && o.x < p.x + 120) {
          killObstacle(i);
        }
      }
    }

    const wasHooked = state.hooked;

    if (state.pointer) {
      const anchor = findAnchor();

      if (anchor) {
        state.hooked = true;
        state.anchor = anchor;

        if (!wasHooked) {
          state.cableLen = Math.min(
            Math.hypot(anchor.x - p.x, anchor.y - p.y),
            620
          );
        }
      } else {
        state.hooked = false;
      }
    } else {
      state.hooked = false;
    }

    if (state.hooked && state.anchor) {
      const dx = state.anchor.x - p.x;
      const dy = state.anchor.y - p.y;
      const spring = 24;

      p.vx += dx * spring * dt;
      p.vy += dy * spring * dt;

      const dist = Math.hypot(dx, dy) || 1;

      if (dist > state.cableLen) {
        const nx = dx / dist;
        const ny = dy / dist;

        p.x = state.anchor.x - nx * state.cableLen;
        p.y = state.anchor.y - ny * state.cableLen;

        const dot = p.vx * nx + p.vy * ny;
        p.vx -= dot * nx;
        p.vy -= dot * ny;
      }

      p.vx *= 0.995;
      p.vy *= 0.995;
    } else {
      const gravity = state.power.timer > 0 ? 920 : 1050;
      p.vy += gravity * dt;
      p.vx *= 0.99;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.x = Math.max(60, Math.min(W * 0.68, p.x));

    if (p.y < p.r) {
      p.y = p.r;
      p.vy = Math.max(0, p.vy * 0.2);
    }

    if (p.y >= floor - p.r) {
      p.y = floor - p.r;
      gameOver();
      return;
    }

    for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
      const o = state.obstacles[i];

      if (circleRect(p.x, p.y, p.r - 2, o)) {
        if (state.power.timer > 0 && o.type === "titan") {
          killObstacle(i);
        } else {
          state.shake = 1;
          gameOver();
          return;
        }
      }
    }

    updateHUD();
  }

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b1220");
    bg.addColorStop(1, "#111827");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 2;

    const offset = (state.distance * 0.25) % 80;
    for (let x = -offset; x < W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, W, 18);
    ctx.fillStyle = "#475569";
    ctx.fillRect(0, 16, W, 3);

    ctx.fillStyle = "#111827";
    ctx.fillRect(0, floor, W, H - floor);
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, floor, W, 4);
  }

  function drawObstacle(o) {
    ctx.save();

    if (o.type === "titan") {
      ctx.fillStyle = "#7f1d1d";
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.fillStyle = "#b91c1c";
      ctx.fillRect(o.x + 10, o.y + 18, o.w - 20, o.h - 42);

      ctx.fillStyle = "#000000";
      ctx.fillRect(o.x + 18, o.y + 34, 12, 8);
      ctx.fillRect(o.x + o.w - 30, o.y + 34, 12, 8);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(o.x + 18, o.y + 34, 6, 4);
      ctx.fillRect(o.x + o.w - 30, o.y + 34, 6, 4);

      ctx.fillStyle = "#fca5a5";
      ctx.fillRect(o.x + 16, o.y + 70, o.w - 32, 8);

      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(o.x + 18 + i * 8, o.y + 72, 4, 6);
      }
    } else if (o.type === "block") {
      ctx.fillStyle = "#475569";
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(o.x, o.y, o.w, 5);

      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8);
    } else {
      ctx.fillStyle = "#334155";
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.fillStyle = "#475569";
      ctx.fillRect(o.x, o.y, o.w, 8);

      ctx.fillStyle = "rgba(251,191,36,0.35)";
      ctx.fillRect(o.x + 4, o.y + 14, o.w - 8, 4);
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawCable() {
    if (!state.hooked || !state.anchor) return;

    ctx.strokeStyle = "#c3c9d4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(state.anchor.x, state.anchor.y);
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(state.anchor.x, state.anchor.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    const p = state.player;

    ctx.save();

    if (state.power.timer > 0) {
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 28;
    }

    ctx.fillStyle = state.power.timer > 0 ? "#22d3ee" : "#fbbf24";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r - 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(p.x - 5, p.y - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(p.x + 5, p.y - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    if (state.attack.active) {
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 10, -0.6, 0.9);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(15,23,42,0.72)";
    ctx.fillRect(12, 28, 230, 86);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Puntos: ${state.score}`, 24, 54);
    ctx.fillText(`Récord: ${best}`, 24, 78);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.fillText(`Velocidad: ${Math.round(state.speed)} px/s`, 24, 102);

    if (state.power.timer > 0) {
      const w = 200 * (state.power.timer / 8);
      ctx.fillStyle = "#0891b2";
      ctx.fillRect(W - w - 24, 32, w, 8);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "right";
      ctx.fillText("Poder de los Titanes", W - 24, 28);
      ctx.textAlign = "left";
    }

    const cdMax = state.power.timer > 0 ? 0.45 : 1.2;
    const ratio = 1 - Math.min(1, state.attack.cooldown / cdMax);

    ctx.fillStyle = "rgba(148,163,184,0.25)";
    ctx.fillRect(W - 132, 52, 100, 10);

    ctx.fillStyle = ratio >= 1 ? "#22c55e" : "#f59e0b";
    ctx.fillRect(W - 132, 52, 100 * ratio, 10);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.fillText("Ataque", W - 24, 74);
    ctx.textAlign = "left";
  }

  function drawStart() {
    ctx.fillStyle = "rgba(2,6,23,0.72)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";

    ctx.font = "bold 42px Arial";
    ctx.fillText("ODM Runner", W / 2, H / 2 - 70);

    ctx.font = "18px Arial";
    ctx.fillText(
      "Clic mantenido: cable · Espacio: ataque · P: pausa · R: reiniciar",
      W / 2,
      H / 2 - 20
    );

    ctx.fillText(
      "Engánchate al techo, muros o titanes para impulsarte.",
      W / 2,
      H / 2 + 10
    );

    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Pulsa clic o Iniciar", W / 2, H / 2 + 55);

    ctx.textAlign = "left";
  }

  function drawGameOver() {
    ctx.fillStyle = "rgba(2,6,23,0.72)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";

    ctx.font = "bold 40px Arial";
    ctx.fillText("Fin de la partida", W / 2, H / 2 - 40);

    ctx.font = "22px Arial";
    ctx.fillText(`Puntos: ${state.score}`, W / 2, H / 2 + 5);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Mejor: ${best}`, W / 2, H / 2 + 40);

    ctx.fillStyle = "#fbbf24";
    ctx.fillText("R o Iniciar para volver", W / 2, H / 2 + 85);

    ctx.textAlign = "left";
  }

  function drawPause() {
    ctx.fillStyle = "rgba(2,6,23,0.65)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.font = "bold 38px Arial";
    ctx.fillText("Pausa", W / 2, H / 2);
    ctx.textAlign = "left";
  }

  function draw() {
    ctx.save();

    if (state.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * state.shake * 8,
        (Math.random() - 0.5) * state.shake * 8
      );
    }

    drawBackground();

    for (const o of state.obstacles) {
      drawObstacle(o);
    }

    drawCable();
    drawParticles();
    drawPlayer();
    drawHUD();

    if (!state.started) drawStart();
    if (state.gameOver) drawGameOver();
    if (state.paused) drawPause();

    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    if (!state.paused) update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  function bindEvents() {
    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      if (!state.started || state.gameOver) {
        start();
        state.pointer = true;
      } else {
        state.pointer = true;
      }
    });

    canvas.addEventListener("pointerup", () => {
      state.pointer = false;
    });

    canvas.addEventListener("pointerleave", () => {
      state.pointer = false;
    });

    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();

        if (!state.started || state.gameOver) {
          start();
        } else {
          attack();
        }
      }

      if (event.key === "r" || event.key === "R") {
        restart();
      }

      if (event.key === "p" || event.key === "P") {
        togglePause();
      }
    });

    startBtn?.addEventListener("click", start);
    restartBtn?.addEventListener("click", restart);
    pauseBtn?.addEventListener("click", togglePause);
  }

  function init() {
    resize();
    reset();
    bindEvents();

    window.addEventListener("resize", resize);
    requestAnimationFrame(loop);
  }

  init();
})();