(() => {
  const root = document.documentElement;
  const THEME_KEY = "theme";
  const HEADING_SELECTOR = "h1, h2, h3, .chapter__label, .hero__motto";

  const themeToggle = document.getElementById("theme-toggle");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("main-nav");
  const toast = document.getElementById("toast");
  const year = document.getElementById("year");
  const canvas = document.getElementById("bolt");
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const COLORS = {
    ray: "#c98a00",
    blood: "#b3121f",
    ink: "#1c1a17",
    bg: "#f4f1ea",
  };

  let bolts = [];
  let clickTimes = [];
  let rafId = null;
  let flash = 0;
  let toastTimer = null;

  const selectionUnderline = {
    paths: [],
  };

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Silencioso
    }
  }

  function readColors() {
    const cs = getComputedStyle(root);
    COLORS.ray = cs.getPropertyValue("--ray").trim() || COLORS.ray;
    COLORS.blood = cs.getPropertyValue("--blood").trim() || COLORS.blood;
    COLORS.ink = cs.getPropertyValue("--ink").trim() || COLORS.ink;
    COLORS.bg = cs.getPropertyValue("--bg").trim() || COLORS.bg;
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    storeTheme(theme);

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"
      );
    }

    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        "content",
        theme === "dark" ? "#111113" : "#f4f1ea"
      );
    }

    readColors();
    updateSelectionUnderline();
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");

    if (toastTimer) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
  }

  function setMenu(open) {
    if (!nav || !menuToggle) return;

    nav.classList.toggle("is-open", open);
    menuToggle.classList.toggle("is-active", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }

  function closeMenu() {
    setMenu(false);
  }

  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makePath(x1, y1, x2, y2, segments, magnitude) {
    const points = [{ x: x1, y: y1 }];

    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      const jitterX = (Math.random() * magnitude - magnitude / 2) * (1 - t);
      const jitterY = (Math.random() * magnitude - magnitude / 2) * t;

      points.push({
        x: x1 + (x2 - x1) * t + jitterX,
        y: y1 + (y2 - y1) * t + jitterY,
      });
    }

    points.push({ x: x2, y: y2 });
    return points;
  }

  function createBolt(x, y, mega = false) {
    const startX = x + (Math.random() * 140 - 70);
    const points = makePath(startX, -10, x, y, mega ? 36 : 24, mega ? 90 : 55);
    const branches = [];
    const branchCount = mega ? 12 : 5;

    for (let i = 0; i < branchCount; i += 1) {
      const p = points[Math.floor(Math.random() * points.length)];
      const bx = p.x + (Math.random() * 260 - 130);
      const by = p.y + Math.random() * 180 + 60;
      branches.push(makePath(p.x, p.y, bx, by, mega ? 10 : 7, 45));
    }

    bolts.push({
      points,
      branches,
      life: 1,
      decay: mega ? 0.028 : 0.038,
      width: mega ? 4.2 : 2.2,
      color: mega ? COLORS.blood : COLORS.ray,
      glow: mega ? 30 : 18,
    });
  }

  function drawBolt(bolt) {
    const alpha = Math.max(0, bolt.life);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = bolt.color;
    ctx.shadowColor = bolt.color;
    ctx.shadowBlur = bolt.glow * alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = bolt.width;

    ctx.beginPath();
    bolt.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    ctx.lineWidth = Math.max(1, bolt.width * 0.55);

    bolt.branches.forEach((branch) => {
      ctx.beginPath();
      branch.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    });

    ctx.restore();
  }

  function buildSelectionPaths(rects) {
    return rects.map((rect) => {
      const y = rect.bottom + 1.5;
      const x1 = rect.left;
      const x2 = rect.right;
      const width = x2 - x1;
      const segments = Math.max(4, Math.min(60, Math.floor(width / 12)));
      const amp = Math.min(3.2, Math.max(1.2, width / 45));

      const points = [{ x: x1, y: y - amp * 0.35 }];

      for (let i = 1; i < segments; i += 1) {
        const t = i / segments;
        const x = x1 + width * t;
        const dir = i % 2 === 0 ? -1 : 1;
        const jitter = dir * amp * (0.65 + Math.random() * 0.35);
        points.push({ x, y: y + jitter });
      }

      points.push({ x: x2, y: y - amp * 0.35 });
      return points;
    });
  }

  function drawSelectionUnderline() {
    if (!selectionUnderline.paths.length) return;

    ctx.save();
    ctx.strokeStyle = COLORS.ray;
    ctx.shadowColor = COLORS.ray;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    selectionUnderline.paths.forEach((path) => {
      ctx.beginPath();
      path.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    });

    ctx.restore();
  }

  function hasActivity() {
    return bolts.length > 0 || flash > 0 || selectionUnderline.paths.length > 0;
  }

  function renderStatic() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawSelectionUnderline();
  }

  function clearSelectionUnderline() {
    if (!selectionUnderline.paths.length) return;

    selectionUnderline.paths = [];

    if (rafId === null && bolts.length === 0 && flash <= 0) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  function selectionTouchesHeading() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;

    const range = sel.getRangeAt(0);

    const startEl =
      range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;

    const endEl =
      range.endContainer.nodeType === 1
        ? range.endContainer
        : range.endContainer.parentElement;

    if (startEl && startEl.closest(HEADING_SELECTOR)) return true;
    if (endEl && endEl.closest(HEADING_SELECTOR)) return true;

    let node = range.commonAncestorContainer;

    while (node) {
      if (node.nodeType === 1 && node.matches(HEADING_SELECTOR)) return true;
      node = node.parentNode;
    }

    return false;
  }

  function updateSelectionUnderline() {
    if (reduceMotion.matches) {
      clearSelectionUnderline();
      return;
    }

    const sel = window.getSelection();

    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      clearSelectionUnderline();
      return;
    }

    const text = sel.toString();

    if (!text.trim()) {
      clearSelectionUnderline();
      return;
    }

    if (selectionTouchesHeading()) {
      clearSelectionUnderline();
      return;
    }

    const range = sel.getRangeAt(0);
    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 2 && rect.height > 2
    );

    if (!rects.length) {
      clearSelectionUnderline();
      return;
    }

    selectionUnderline.paths = buildSelectionPaths(rects);

    if (rafId === null) {
      if (bolts.length > 0 || flash > 0) {
        startLoop();
      } else {
        renderStatic();
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, flash * 0.22);
      ctx.fillStyle = COLORS.ray;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.restore();
      flash = Math.max(0, flash - 0.08);
    }

    for (let i = bolts.length - 1; i >= 0; i -= 1) {
      const bolt = bolts[i];
      drawBolt(bolt);
      bolt.life -= bolt.decay;

      if (bolt.life <= 0) {
        bolts.splice(i, 1);
      }
    }

    drawSelectionUnderline();

    if (hasActivity()) {
      rafId = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      rafId = null;
    }
  }

  function startLoop() {
    if (reduceMotion.matches || rafId !== null) return;
    rafId = requestAnimationFrame(loop);
  }

  function triggerZap(target) {
    if (!target) return;

    target.classList.remove("zap");
    void target.offsetWidth;
    target.classList.add("zap");

    setTimeout(() => {
      target.classList.remove("zap");
    }, 520);
  }

  // Tema
  setTheme(getStoredTheme() || "light");

  themeToggle?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  // Año
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Canvas
  resizeCanvas();
  window.addEventListener("resize", () => {
    resizeCanvas();
    updateSelectionUnderline();
  });

  // Menú móvil
  menuToggle?.addEventListener("click", () => {
    setMenu(!nav.classList.contains("is-open"));
  });

  document.addEventListener("click", (event) => {
    if (nav.classList.contains("is-open") && !event.target.closest(".site-header")) {
      closeMenu();
    }
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      clearSelectionUnderline();
    }
  });

  const desktopQuery = window.matchMedia("(min-width: 901px)");
  function onDesktopChange(event) {
    if (event.matches) closeMenu();
  }

  if (desktopQuery.addEventListener) {
    desktopQuery.addEventListener("change", onDesktopChange);
  } else {
    desktopQuery.addListener(onDesktopChange);
  }

  // Copiar email
  document.querySelectorAll("[data-copy-email]").forEach((button) => {
    button.addEventListener("click", async () => {
      const email = button.getAttribute("data-copy-email");

      try {
        await navigator.clipboard.writeText(email);
        showToast("Email copiado");
      } catch {
        showToast("No se pudo copiar");
      }
    });
  });

  // Navegación activa
  const navLinks = new Map(
    Array.from(nav.querySelectorAll('a[href^="#"]')).map((link) => [
      link.getAttribute("href").slice(1),
      link,
    ])
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        navLinks.forEach((link) => link.classList.remove("active"));
        const activeLink = navLinks.get(entry.target.id);

        if (activeLink) {
          activeLink.classList.add("active");
        }
      });
    },
    {
      rootMargin: "-40% 0px -55% 0px",
      threshold: 0,
    }
  );

  document.querySelectorAll("main section[id]").forEach((section) => {
    if (navLinks.has(section.id)) {
      observer.observe(section);
    }
  });

  // Subrayado por selección
  document.addEventListener("selectionchange", updateSelectionUnderline);
  window.addEventListener("mouseup", updateSelectionUnderline);
  window.addEventListener("keyup", updateSelectionUnderline);
  window.addEventListener("scroll", updateSelectionUnderline, true);

  // Limpiar subrayado al hacer click / mousedown
  window.addEventListener("mousedown", clearSelectionUnderline);
  window.addEventListener("click", clearSelectionUnderline);

  // Rayo al hacer clic
  window.addEventListener("click", (event) => {
    clearSelectionUnderline();

    if (reduceMotion.matches) return;

    const now = Date.now();
    clickTimes.push(now);
    clickTimes = clickTimes.filter((time) => now - time <= 3000);

    const mega = clickTimes.length >= 5;

    if (mega) {
      clickTimes = [];
      flash = 1;
    }

    const zapTarget = event.target.closest(HEADING_SELECTOR);
    triggerZap(zapTarget);
    createBolt(event.clientX, event.clientY, mega);
    startLoop();
  });
})();