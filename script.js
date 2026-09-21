/* scripts.js — Yerai Piera Langa */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== 1. TEMA + localStorage ===== */
  var toggle = document.getElementById("theme-toggle");
  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (toggle) toggle.textContent = theme === "dark" ? "Claro" : "Oscuro";
  }
  setTheme(localStorage.getItem("theme") || "dark");
  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  /* ===== 2. MÁQUINA DE ESCRIBIR ===== */
  var tw = document.getElementById("typewriter");
  if (tw) {
    var full = tw.textContent.replace(/\s+/g, " ").trim();
    if (reduce) { tw.textContent = full; }
    else {
      var i = 0; tw.textContent = "";
      (function type() {
        tw.textContent = full.slice(0, i);
        if (i <= full.length) { i++; setTimeout(type, 28 + Math.random() * 40); }
      })();
    }
  }

  /* ===== AÑO ===== */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ===== CANVAS ===== */
  var fx = document.getElementById("fx");
  var bolt = document.getElementById("bolt");
  var fxc = fx && fx.getContext ? fx.getContext("2d") : null;
  var bc = bolt && bolt.getContext ? bolt.getContext("2d") : null;

  var GOLD = "#ffd24a";
  var WHITE = "#fff7e0";
  var PI2 = Math.PI * 2;
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var flashes = [], bolts = [], nextFlash = 0, screenFlash = null;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    [fx, bolt].forEach(function (c) {
      if (c) { c.width = Math.floor(W * dpr); c.height = Math.floor(H * dpr); }
    });
    if (fxc) fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bc) bc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function hexA(hex, a) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16),
        g = parseInt(h.substr(2, 2), 16),
        b = parseInt(h.substr(4, 2), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")";
  }

  /* ---- Fondo: rayo decorativo en zigzag desde un punto ---- */
  function bgBolt(cx, cy) {
    var ang = Math.random() * PI2;
    var len = 70 + Math.random() * 170;
    var segs = 4 + Math.floor(Math.random() * 4);
    var step = len / segs;
    var pts = [{ x: cx, y: cy }];
    var x = cx, y = cy;
    for (var i = 0; i < segs; i++) {
      ang += (Math.random() - 0.5) * 0.9;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push({ x: x, y: y });
    }
    return pts;
  }
  function spawnFlash() {
    var cx = Math.random() * W;
    var cy = H * (0.12 + Math.random() * 0.6);
    var arr = [];
    var n = 3 + Math.floor(Math.random() * 5);
    for (var i = 0; i < n; i++) arr.push(bgBolt(cx, cy));
    flashes.push({ cx: cx, cy: cy, maxR: 120 + Math.random() * 220, bolts: arr,
                   start: performance.now(), dur: 600 + Math.random() * 500 });
  }
  function drawFlashes(now) {
    if (now >= nextFlash) {
      spawnFlash();
      if (Math.random() < 0.25) spawnFlash();
      nextFlash = now + 2500 + Math.random() * 4500;
    }
    for (var k = flashes.length - 1; k >= 0; k--) {
      var f = flashes[k];
      var t = (now - f.start) / f.dur;
      if (t >= 1) { flashes.splice(k, 1); continue; }
      var a = t < 0.18 ? t / 0.18 : 1 - (t - 0.18) / 0.82; if (a < 0) a = 0;
      var ease = 1 - Math.pow(1 - t, 3);
      var r = f.maxR * ease;
      var g = fxc.createRadialGradient(f.cx, f.cy, 0, f.cx, f.cy, r);
      g.addColorStop(0, hexA(GOLD, 0.5 * a));
      g.addColorStop(0.4, hexA(GOLD, 0.18 * a));
      g.addColorStop(1, hexA(GOLD, 0));
      fxc.fillStyle = g;
      fxc.beginPath(); fxc.arc(f.cx, f.cy, r, 0, PI2); fxc.fill();
      fxc.save();
      fxc.lineJoin = "round"; fxc.lineCap = "round";
      fxc.shadowBlur = 14; fxc.shadowColor = GOLD;
      fxc.strokeStyle = hexA(GOLD, a); fxc.lineWidth = 1.6;
      for (var b = 0; b < f.bolts.length; b++) {
        var pts = f.bolts[b];
        fxc.beginPath(); fxc.moveTo(pts[0].x, pts[0].y);
        for (var p = 1; p < pts.length; p++) fxc.lineTo(pts[p].x, pts[p].y);
        fxc.stroke();
      }
      fxc.restore();
    }
  }

  /* ---- Rayos de clic (normal + MEGA al llegar a 5 en 3s) ---- */
  function heroBottom() {
    var hero = document.querySelector(".hero");
    return hero ? hero.getBoundingClientRect().bottom : 0;
  }
  function jagged(x, topY, botY, segs, amp) {
    var pts = [{ x: x, y: topY }];
    var step = (botY - topY) / segs;
    for (var i = 1; i < segs; i++) pts.push({ x: x + (Math.random() - 0.5) * amp, y: topY + step * i });
    pts.push({ x: x, y: botY });
    return pts;
  }
  function boltLines(x, topY, botY, big) {
    var main = jagged(x, topY, botY, big ? 12 : 6, big ? 70 : 34);
    var lines = [main];
    if (big) { // ramificaciones como en la serie
      var n = 3 + Math.floor(Math.random() * 4);
      for (var k = 0; k < n; k++) {
        var a = main[Math.floor(Math.random() * main.length)];
        var ang = Math.random() * PI2, len = 70 + Math.random() * 140;
        var segs = 4 + Math.floor(Math.random() * 3), step = len / segs;
        var px = a.x, py = a.y, pts = [{ x: px, y: py }];
        for (var s = 0; s < segs; s++) {
          ang += (Math.random() - 0.5) * 1.3;
          px += Math.cos(ang) * step; py += Math.sin(ang) * step;
          pts.push({ x: px, y: py });
        }
        lines.push(pts);
      }
    }
    return lines;
  }
  function addBolt(x, y, big) {
    if (bolts.length > 8) bolts.shift();
    var topY = big ? 0 : heroBottom();
    if (!big) { if (topY < 0) topY = 0; if (y <= topY) topY = 0; }
    bolts.push({
      x: x, topY: topY, botY: y, lines: boltLines(x, topY, y, big), big: !!big,
      start: performance.now(),
      fall: big ? 70 : (170 + Math.random() * 70),
      hold: big ? 520 : (380 + Math.random() * 180)
    });
    if (big) screenFlash = { x: x, y: y, start: performance.now(), dur: 260 };
  }
  function strokeClipped(ctx, pts, curY) {
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.y <= curY) {
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      } else {
        if (i > 0) {
          var prev = pts[i - 1], f = (curY - prev.y) / (p.y - prev.y);
          ctx.lineTo(prev.x + (p.x - prev.x) * f, curY);
        }
        break;
      }
    }
    ctx.stroke();
  }
  function poly(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  function drawBolt(b, now) {
    var el = now - b.start;
    if (b.big) { // MEGA: aparece de golpe, parpadea, con impacto
      var h = el / b.hold; if (h >= 1) return false;
      var fl = 0.55 + 0.45 * Math.sin(h * 30), alpha = (1 - h) * fl;
      bc.save();
      bc.lineJoin = "round"; bc.lineCap = "round"; bc.shadowBlur = 24; bc.shadowColor = GOLD;
      for (var i = 0; i < b.lines.length; i++) {
        var ln = b.lines[i];
        bc.strokeStyle = hexA(GOLD, alpha * 0.5); bc.lineWidth = 8; poly(bc, ln);
        bc.strokeStyle = hexA(WHITE, alpha); bc.lineWidth = 2.6; poly(bc, ln);
      }
      var R = 40 + 30 * (1 - h);
      var g = bc.createRadialGradient(b.x, b.botY, 0, b.x, b.botY, R);
      g.addColorStop(0, hexA(WHITE, alpha * 0.9));
      g.addColorStop(0.4, hexA(GOLD, alpha * 0.5));
      g.addColorStop(1, hexA(GOLD, 0));
      bc.fillStyle = g; bc.beginPath(); bc.arc(b.x, b.botY, R, 0, PI2); bc.fill();
      bc.restore();
      return true;
    }
    // NORMAL: cae desde el final del header hasta el cursor
    var t = el / b.fall, curY, alpha2;
    if (t < 1) { curY = b.topY + (b.botY - b.topY) * t; alpha2 = 1; }
    else {
      curY = b.botY;
      var hh = (el - b.fall) / b.hold; if (hh >= 1) return false;
      alpha2 = (1 - hh) * (0.55 + 0.45 * Math.sin(hh * 45));
    }
    bc.save();
    bc.lineJoin = "round"; bc.lineCap = "round"; bc.shadowBlur = 16; bc.shadowColor = GOLD;
    var ln0 = b.lines[0];
    bc.strokeStyle = hexA(GOLD, alpha2 * 0.5); bc.lineWidth = 5; strokeClipped(bc, ln0, curY);
    bc.strokeStyle = hexA(WHITE, alpha2); bc.lineWidth = 1.8; strokeClipped(bc, ln0, curY);
    bc.restore();
    if (t >= 1) {
      var g2 = bc.createRadialGradient(b.x, b.botY, 0, b.x, b.botY, 22);
      g2.addColorStop(0, hexA(WHITE, alpha2 * 0.8));
      g2.addColorStop(0.4, hexA(GOLD, alpha2 * 0.4));
      g2.addColorStop(1, hexA(GOLD, 0));
      bc.fillStyle = g2; bc.beginPath(); bc.arc(b.x, b.botY, 22, 0, PI2); bc.fill();
    }
    return true;
  }

  /* ---- Contador: 5 rayos en 3s => MEGA ---- */
  var clickTimes = [];
  function registerClick(x, y) {
    var now = performance.now();
    clickTimes.push(now);
    clickTimes = clickTimes.filter(function (t) { return now - t <= 3000; });
    addBolt(x, y, false);
    if (clickTimes.length >= 5) { addBolt(x, y, true); clickTimes = []; }
  }
  document.addEventListener("click", function (e) {
    if (reduce || !bc) return;
    var tag = e.target.tagName;
    if (tag === "A" || tag === "BUTTON") return; // no romper enlaces/botón
    registerClick(e.clientX, e.clientY);
  });

  /* ---- Bucle ---- */
  function loop() {
    var now = performance.now();
    if (fxc) { fxc.clearRect(0, 0, W, H); drawFlashes(now); }
    if (bc) {
      bc.clearRect(0, 0, W, H);
      for (var i = bolts.length - 1; i >= 0; i--) if (!drawBolt(bolts[i], now)) bolts.splice(i, 1);
      if (screenFlash) {
        var st = (now - screenFlash.start) / screenFlash.dur;
        if (st < 1) {
          var R = Math.max(W, H), a = (1 - st) * 0.35;
          var g = bc.createRadialGradient(screenFlash.x, screenFlash.y, 0, screenFlash.x, screenFlash.y, R);
          g.addColorStop(0, hexA(WHITE, a));
          g.addColorStop(0.3, hexA(GOLD, a * 0.6));
          g.addColorStop(1, hexA(GOLD, 0));
          bc.fillStyle = g; bc.fillRect(0, 0, W, H);
        } else screenFlash = null;
      }
    }
    requestAnimationFrame(loop);
  }
  if (!reduce) requestAnimationFrame(loop);
})();