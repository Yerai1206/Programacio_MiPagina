(() => {
  const root = document.documentElement;
  const THEME_KEY = "theme";
  const RAY_SELECTOR = "h1, h2, .section-title";
  const NO_UNDERLINE_SELECTOR = "h1, h2, h3, h4, .section-title, .section-label, .hero-motto";

  const themeToggle = document.getElementById("theme-toggle");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("main-nav");
  const toast = document.getElementById("toast");
  const year = document.getElementById("year");
  const canvas = document.getElementById("bolt");
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const COLORS = { ray: "#c98a00", accent: "#b3121f" };
  let bolts = [];
  let rafId = null;
  let toastTimer = null;
  const selectionUnderline = { paths: [] };

  /* =========================================================
     1. TEMA
     ========================================================= */
  const getStoredTheme = () => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } };
  const storeTheme = (t) => { try { localStorage.setItem(THEME_KEY, t); } catch {} };

  function readColors() {
    const cs = getComputedStyle(root);
    COLORS.ray = cs.getPropertyValue("--ray").trim() || COLORS.ray;
    COLORS.accent = cs.getPropertyValue("--accent").trim() || COLORS.accent;
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    storeTheme(theme);
    readColors();
    themeToggle?.setAttribute("aria-label", theme === "dark" ? "Activar tema claro" : "Activar tema oscuro");
    themeColorMeta?.setAttribute("content", theme === "dark" ? "#0e1014" : "#f6f5f1");
    updateSelectionUnderline();
  }

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(getStoredTheme() || (prefersDark ? "dark" : "light"));
  themeToggle?.addEventListener("click", () => applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark"));

  /* =========================================================
     2. UTILIDADES
     ========================================================= */
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function setMenu(open) {
    if (!nav || !menuToggle) return;
    nav.classList.toggle("is-open", open);
    menuToggle.classList.toggle("is-active", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }
  const closeMenu = () => setMenu(false);
  if (year) year.textContent = new Date().getFullYear();

  /* =========================================================
     3. CANVAS: rayos + subrayado de selección
     ========================================================= */
  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makePath(x1, y1, x2, y2, segments, magnitude) {
    const pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() * magnitude - magnitude / 2) * (1 - t),
        y: y1 + (y2 - y1) * t + (Math.random() * magnitude - magnitude / 2) * t,
      });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  function createBolt(x, y, rect) {
    const startY = Math.max(-20, rect.top - 55);
    const startX = x + (Math.random() * 44 - 22);
    const points = makePath(startX, startY, x, y, 12, 18);
    const branches = [];
    if (Math.random() < 0.35) {
      const p = points[Math.floor(Math.random() * points.length)];
      branches.push(makePath(p.x, p.y, p.x + (Math.random() * 70 - 35), p.y + Math.random() * 60 + 25, 6, 14));
    }
    bolts.push({ points, branches, life: 1, decay: 0.065, width: 1.1, color: COLORS.ray, glow: 6 });
  }

  function drawBolt(b) {
    const alpha = Math.max(0, b.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = b.glow * alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = b.width;
    ctx.beginPath();
    b.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, b.width * 0.5);
    b.branches.forEach((br) => {
      ctx.beginPath();
      br.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    });
    ctx.restore();
  }

  function buildLightningLine(rect) {
    const x1 = rect.left, x2 = rect.right, y = rect.bottom + 1.5;
    const len = x2 - x1;
    const segments = Math.max(3, Math.min(40, Math.floor(len / 18) + 2));
    const amp = Math.min(2.2, Math.max(0.7, len / 160));
    const pts = [{ x: x1, y }];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      pts.push({ x: x1 + len * t, y: y + (i % 2 ? 1 : -1) * amp * (0.55 + Math.random() * 0.45) });
    }
    pts.push({ x: x2, y });
    return pts;
  }

  function drawSelectionUnderline() {
    if (!selectionUnderline.paths.length) return;
    ctx.save();
    ctx.strokeStyle = COLORS.ray;
    ctx.shadowColor = COLORS.ray;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    selectionUnderline.paths.forEach((path) => {
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    });
    ctx.restore();
  }

  const renderStatic = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawSelectionUnderline();
  };

  function clearSelectionUnderline() {
    if (!selectionUnderline.paths.length) return;
    selectionUnderline.paths = [];
    if (rafId === null && bolts.length === 0) renderStatic();
  }

  function selectionTouchesHeading() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    return Array.from(document.querySelectorAll(NO_UNDERLINE_SELECTOR)).some((h) => range.intersectsNode(h));
  }

  function updateSelectionUnderline() {
    if (reduceMotion.matches) return clearSelectionUnderline();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !sel.toString().trim()) return clearSelectionUnderline();
    if (selectionTouchesHeading()) return clearSelectionUnderline();

    const rects = Array.from(sel.getRangeAt(0).getClientRects()).filter((r) => r.width > 2 && r.height > 2);
    if (!rects.length) return clearSelectionUnderline();

    selectionUnderline.paths = rects.map(buildLightningLine);
    if (rafId === null) (bolts.length ? startLoop() : renderStatic());
  }

  function loop() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = bolts.length - 1; i >= 0; i--) {
      drawBolt(bolts[i]);
      bolts[i].life -= bolts[i].decay;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }
    drawSelectionUnderline();
    if (bolts.length) rafId = requestAnimationFrame(loop);
    else { rafId = null; renderStatic(); }
  }

  function startLoop() {
    if (reduceMotion.matches || rafId !== null) return;
    rafId = requestAnimationFrame(loop);
  }

  function triggerZap(target) {
    if (!target) return;
    target.classList.remove("is-zapped");
    void target.offsetWidth;
    target.classList.add("is-zapped");
    setTimeout(() => target.classList.remove("is-zapped"), 380);
  }

  /* =========================================================
     4. SCROLL SPY
     ========================================================= */
  const spySections = Array.from(nav.querySelectorAll('a[href^="#"]'))
    .map((link) => ({ link, el: document.getElementById(link.getAttribute("href").slice(1)) }))
    .filter((s) => s.el);

  let spyQueued = false;
  function updateSpy() {
    spyQueued = false;
    if (!spySections.length) return;
    const line = window.innerHeight * 0.35;
    let current = spySections[0];
    for (const s of spySections) if (s.el.getBoundingClientRect().top <= line) current = s;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4) current = spySections[spySections.length - 1];
    spySections.forEach((s) => s.link.classList.toggle("active", s === current));
  }
  const queueSpy = () => { if (!spyQueued) { spyQueued = true; requestAnimationFrame(updateSpy); } };

  /* =========================================================
     5. FORMULARIO REAL (Web3Forms) + respaldo mailto
     ========================================================= */
  (function contactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const statusBox = document.getElementById("form-status");
    const successBox = document.getElementById("form-success");
    const successText = document.getElementById("success-text");
    const submitBtn = document.getElementById("submit-btn");
    const mailtoBtn = document.getElementById("mailto-btn");
    const clearBtn = document.getElementById("clear-btn");
    const againBtn = document.getElementById("again-btn");
    const counter = document.getElementById("msg-count");
    const draftHint = document.getElementById("draft-hint");

    const ENDPOINT = "https://api.web3forms.com/submit";
    const DRAFT_KEY = "contact-draft";
    const TO = "yerpielan@alu.edu.gva.es";

    const RE_NAME = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’\- ]{2,60}$/;
    const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
    const RE_PHONE = /^[+]?[\d\s().-]{7,20}$/;

    const rules = {
      name: { el: form.elements.name, test: (v) => RE_NAME.test(v.trim()), msg: "Nombre mínimo 2 letras, sin números." },
      lastname: { el: form.elements.lastname, test: (v) => RE_NAME.test(v.trim()), msg: "Apellidos mínimos 2 letras." },
      email: { el: form.elements.email, test: (v) => RE_EMAIL.test(v.trim()), msg: "Formato de correo no válido (nombre@dominio.com)." },
      phone: { el: form.elements.phone, optional: true, test: (v) => RE_PHONE.test(v.trim()), msg: "Solo números y + ( ) - ." },
      topic: { el: form.elements.topic, test: (v) => v !== "", msg: "Selecciona un motivo." },
      message: { el: form.elements.message, test: (v) => v.trim().length >= 20, msg: "El mensaje necesita al menos 20 caracteres." },
      consent: { el: form.elements.consent, check: true, test: () => form.elements.consent.checked, msg: "Debes aceptar el tratamiento de datos." },
    };

    const wrapOf = (rule) => rule.el.closest(".field");

    function setError(key, show) {
      const rule = rules[key];
      const wrap = wrapOf(rule);
      const errEl = document.getElementById("err-" + key);
      if (show) {
        wrap.classList.add("is-invalid");
        wrap.classList.remove("is-valid");
        rule.el.setAttribute("aria-invalid", "true");
        if (errEl) errEl.textContent = rule.msg;
      } else {
        wrap.classList.remove("is-invalid");
        rule.el.removeAttribute("aria-invalid");
        if (errEl) errEl.textContent = "";
      }
    }

    function validateField(key) {
      const rule = rules[key];
      const value = rule.check ? "" : rule.el.value;
      if (rule.optional && !value.trim()) { setError(key, false); wrapOf(rule).classList.remove("is-valid"); return true; }
      const ok = rule.test(value);
      setError(key, !ok);
      wrapOf(rule).classList.toggle("is-valid", ok);
      return ok;
    }

    function validateAll() {
      let firstBad = null, ok = true;
      Object.keys(rules).forEach((key) => {
        if (!validateField(key)) { ok = false; if (!firstBad) firstBad = rules[key].el; }
      });
      firstBad?.focus();
      return ok;
    }

    function status(type, html) {
      statusBox.className = "form-status show is-" + type;
      statusBox.innerHTML = html;
    }
    const clearStatus = () => { statusBox.className = "form-status"; statusBox.innerHTML = ""; };

    function updateCounter() {
      const len = form.elements.message.value.trim().length;
      counter.textContent = `${len} / 1000 (mínimo 20)`;
      counter.classList.toggle("is-warn", len > 0 && len < 20);
    }

    /* ---- borrador ---- */
    let draftTimer = null;
    function saveDraft() {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        const data = {};
        ["name", "lastname", "email", "phone", "topic", "message"].forEach((k) => (data[k] = form.elements[k].value));
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
      }, 400);
    }
    function restoreDraft() {
      let raw = null;
      try { raw = localStorage.getItem(DRAFT_KEY); } catch { return; }
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        let used = false;
        Object.keys(data).forEach((k) => {
          if (form.elements[k] && data[k]) { form.elements[k].value = data[k]; used = true; }
        });
        if (used) draftHint.textContent = "Borrador restaurado.";
      } catch {}
    }
    const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} draftHint.textContent = ""; };

    /* ---- honeypot ---- */
    const isSpam = () => form.elements._honey.value.trim() !== "";

    /* ---- envío principal ---- */
    async function submit(e) {
      e.preventDefault();
      clearStatus();

      if (isSpam()) { status("error", "No hemos podido enviar el mensaje."); return; }
      if (!validateAll()) { status("error", "Revisa los campos marcados en rojo antes de enviar."); return; }

      const key = form.elements.access_key.value.trim();
      if (!key) { status("error", "Falta la <b>access_key</b> de Web3Forms en el formulario."); return; }

      if (location.protocol === "file:") {
        status("info",
          "Estás abriendo la web con <code>file://</code> y el navegador bloquea el envío por seguridad. " +
          "Ábrela desde un servidor local (<code>python3 -m http.server 8000</code> o Live Server) " +
          "o usa <b>«Enviar con mi correo»</b>.");
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";

      const payload = new FormData(form);
      payload.set("_replyto", form.elements.email.value.trim());
      payload.append("Ubicación del envío", location.href);

      try {
        const res = await fetch(ENDPOINT, { method: "POST", body: payload, headers: { Accept: "application/json" } });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          const name = form.elements.name.value.trim();
          form.hidden = true;
          successText.innerHTML =
            `Gracias, <b>${name}</b>. Tu mensaje ha llegado a <b>${TO}</b> y hemos enviado una ` +
            `confirmación automática a <b>${form.elements.email.value.trim()}</b>.`;
          successBox.hidden = false;
          clearDraft();
          form.reset();
          Object.keys(rules).forEach((k) => { setError(k, false); wrapOf(rules[k]).classList.remove("is-valid"); });
          updateCounter();
        } else {
          status("error",
            `Web3Forms ha rechazado el envío: <b>${data.message || "respuesta no válida"}</b>. ` +
            `Comprueba la access_key o usa <b>«Enviar con mi correo»</b>.`);
        }
      } catch (err) {
        status("error",
          "Error de red al contactar con el servicio. Prueba de nuevo, o pulsa <b>«Enviar con mi correo»</b> " +
          "para abrir tu gestor con el mensaje ya escrito.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar mensaje";
      }
    }

    /* ---- respaldo mailto (siempre funciona) ---- */
    function mailtoFallback() {
      clearStatus();
      if (!validateAll()) { status("error", "Completa los campos obligatorios antes de usar el respaldo."); return; }

      const f = form.elements;
      const body = [
        `Nombre: ${f.name.value.trim()}`,
        `Apellidos: ${f.lastname.value.trim()}`,
        `Email: ${f.email.value.trim()}`,
        `Teléfono: ${f.phone.value.trim() || "—"}`,
        `Motivo: ${f.topic.value}`,
        "",
        f.message.value.trim(),
        "",
        "— Enviado desde el portafolio de Yerai Piera Langa",
      ].join("\n");

      const href = `mailto:${TO}?subject=${encodeURIComponent("[Portafolio] " + f.topic.value + " — " + f.name.value.trim())}&body=${encodeURIComponent(body)}`;
      window.location.href = href;
      status("info", "Se ha abierto tu gestor de correo con el mensaje redactado. Pulsa enviar ahí.");
    }

    form.addEventListener("submit", submit);

    Object.keys(rules).forEach((key) => {
      const rule = rules[key];
      const evt = rule.check || rule.el.tagName === "SELECT" ? "change" : "blur";
      rule.el.addEventListener(evt, () => validateField(key));
      rule.el.addEventListener("input", () => {
        if (wrapOf(rule).classList.contains("is-invalid")) validateField(key);
        if (key === "message") updateCounter();
        saveDraft();
      });
    });

    mailtoBtn.addEventListener("click", mailtoFallback);

    clearBtn.addEventListener("click", () => {
      form.reset();
      Object.keys(rules).forEach((k) => { setError(k, false); wrapOf(rules[k]).classList.remove("is-valid"); });
      updateCounter(); clearDraft(); clearStatus();
      form.elements.name.focus();
    });

    againBtn.addEventListener("click", () => { successBox.hidden = true; form.hidden = false; form.elements.name.focus(); });

    restoreDraft();
    updateCounter();
  })();

  /* =========================================================
     6. ASISTENTE CONVERSACIONAL
     Motor de intents: normalización, sinónimos, pesos,
     variantes y sugerencias contextuales.
     ========================================================= */
  (function assistant() {
    const log = document.getElementById("chat-log");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const suggest = document.getElementById("chat-suggest");
    const clearBtn = document.getElementById("chat-clear");
    if (!log || !form) return;

    const STORE = "chat-history";
    const EMAIL = "yerpielan@alu.edu.gva.es";
    const GH = "https://github.com/Yerai1206";

    /* ---------- Base de conocimiento ---------- */
    // groups: cada sub-array es un grupo de sinónimos; acierta si algún término aparece.
    // phrases: coincidencia exacta (mayor peso). type: palabra interrogativa esperada.
    const KB = [
      {
        id: "saludo",
        groups: [["hola", "hey", "buenas", "holaa", "saludos", "que tal", "hola que tal", "adios", "chao", "gracias", "buenos dias", "buenas tardes"]],
        type: null,
        weight: 1,
        responses: [
          "¡Hola! Soy el asistente del portafolio de <b>Yerai Piera Langa</b>. Puedo contarte su <b>formación</b>, sus <b>proyectos</b>, las <b>tecnologías</b> que usa, sus <b>gustos</b>, <b>cómo contactar</b> o <b>cómo funciona esta web</b>. ¿Qué quieres saber?",
          "¡Buenas! Pregúntame por Yerai: estudios, DAM, proyectos, el minijuego, disponibilidad para prácticas o el correo. Si prefieres, escribe <b>«ayuda»</b> y te listo los temas.",
        ],
        follow: ["¿Quién eres?", "Formación", "Proyectos", "Cómo contactar"],
      },
      {
        id: "ayuda",
        groups: [["ayuda", "opciones", "que puedes hacer", "temas", "comandos", "menu"]],
        type: null,
        weight: 2,
        responses: ["Puedo responder sobre: <b>formación</b>, <b>qué es DAM</b>, <b>proyectos y experiencia</b>, <b>tecnologías</b>, <b>gustos y hobbies</b>, <b>el minijuego AoT</b>, <b>objetivo profesional</b>, <b>disponibilidad y prácticas</b>, <b>idiomas</b>, <b>ubicación</b>, <b>contacto y redes</b>, <b>accesibilidad y rendimiento</b>, <b>cómo está hecha la web</b> y <b>cómo funciono yo</b>. Escribe cualquiera de esas palabras o usa los botones."],
        follow: ["Formación", "Proyectos", "Tecnologías", "Cómo funcionas"],
      },
      {
        id: "identidad",
        groups: [["quien eres", "quien eres tu", "eres una ia", "eres un bot", "eres humano", "eres real", "como funcionas", "como funciona el chat", "que eres", "eres chatgpt", "eres gpt", "que eres tu"]],
        type: "quien",
        weight: 2,
        responses: [
          "Soy un <b>asistente conversacional local</b> escrito en JavaScript puro, sin librerías ni API externa. Tu pregunta se normaliza (minúsculas, sin tildes), se tokeniza, se limpian las palabras vacías y se puntúa contra una base de conocimiento con <b>sinónimos y pesos</b>. Si la puntuación supera el umbral devuelvo la respuesta; si no, te derivo al formulario. No sale ningún dato de tu navegador.",
          "No soy un modelo de lenguaje: soy un <b>motor de recuperación por similitud de tokens</b>. Cada intención tiene grupos de sinónimos, peso y palabra interrogativa esperada. Calculo la coincidencia, elijo la mejor y te respondo con variantes para que no suene idéntico. Es la parte más «ingeniería» de la web: sin claves expuestas en cliente.",
        ],
        follow: ["Formación", "Cómo está hecha la web", "Proyectos"],
      },
      {
        id: "nombre",
        groups: [["como te llamas", "nombre", "de quien es la pagina", "de quien es la web", "quien es yerai", "yerai", "quien ha hecho", "quien la ha hecho", "autor", "autora", "propietario"]],
        type: "quien",
        weight: 2,
        responses: ["Esta web es de <b>Yerai Piera Langa</b>: estudiante de <b>1º de DAM</b> en el <b>IES Simarro</b>, en <b>Valencia</b>. Bachillerato científico, con interés real en desarrollo web y en entender cómo funcionan las aplicaciones por dentro."],
        follow: ["Formación", "Proyectos", "Cómo contactar"],
      },
      {
        id: "formacion",
        groups: [
          ["formacion", "estudios", "estudia", "estudiando", "que estudias", "que estudia", "ciclo", "dam", "bachillerato", "bachiller", "cientifico", "ies", "simarro", "colegio", "instituto", "asignaturas", "clases", "curso", "nota", "titulo", "titulacion"],
          ["donde estudia", "donde estudias"],
        ],
        type: "que",
        weight: 2,
        responses: [
          "Cursa <b>1º de DAM</b> (Desarrollo de Aplicaciones Multiplataforma) en el <b>IES Simarro</b>, en Valencia. Antes hizo <b>bachillerato científico</b>, lo que le da base de lógica y razonamiento. Su idea es llegar a trabajar de programación.",
          "Su recorrido formativo es <b>bachillerato científico → 1º DAM en el IES Simarro (Valencia)</b>. El ciclo aporta programación orientada a objetos, bases de datos y desarrollo de aplicaciones; la parte científica, método y análisis.",
        ],
        follow: ["Qué es DAM", "Proyectos", "Tecnologías", "Disponibilidad"],
      },
      {
        id: "dam",
        groups: [["que es dam", "dam significa", "significado dam", "multiplataforma", "diferencia dam daw", "daw", "diferencia", "que se hace en dam", "que aprendo"]],
        type: "que",
        weight: 2.4,
        responses: ["<b>DAM</b> = <b>Desarrollo de Aplicaciones Multiplataforma</b>, un ciclo formativo de grado superior. Se centra en aplicaciones de escritorio, móviles y acceso a datos. Se parece al <b>DAW</b> (Desarrollo en Entorno Web), pero DAM da más peso a la aplicación nativa y multiplataforma, y DAW al despliegue web."],
        follow: ["Formación", "Tecnologías", "Proyectos"],
      },
      {
        id: "ubicacion",
        groups: [["donde vives", "donde vive", "ubicacion", "ciudad", "valencia", "pais", "de donde eres", "de donde es", "localizacion", "spain", "espana"]],
        type: "donde",
        weight: 2.4,
        responses: ["Vive en <b>Valencia, España</b>. Está abierto a prácticas presenciales en Valencia y alrededores, y también a trabajo en remoto."],
        follow: ["Disponibilidad", "Cómo contactar", "Formación"],
      },
      {
        id: "proyectos",
        groups: [["proyecto", "proyectos", "portafolio", "he hecho", "has hecho", "experiencia", "trabajo", "trabajos", "practica", "practicas", "cv", "curriculum", "que sabes hacer", "sabe hacer", "obras", "ejemplos"]],
        type: "que",
        weight: 1.8,
        responses: [
          "Sus proyectos actuales: <b>este portafolio</b> (HTML, CSS y JavaScript puros, sin frameworks, con tema claro/oscuro persistido, scroll-spy, validación de formulario y este mismo asistente) y <b>ODM Runner</b>, un minijuego 2D en canvas. Todo con ficheros separados, commits por funciones y control en <a href='https://github.com/Yerai1206' target='_blank' rel='noopener'>GitHub</a>.",
          "De momento, trabajo de aprendizaje y práctica: <b>portafolio propio</b> hecho a mano, <b>minijuego en canvas</b> con física y raycasting, y ejercicios del ciclo. Nada de plantillas descargadas: cada línea está escrita y commiteada por él.",
        ],
        follow: ["El minijuego", "Tecnologías", "Cómo está hecha la web", "GitHub"],
      },
      {
        id: "juego",
        groups: [["juego", "minijuego", "aot", "ataque", "titanes", "titan", "titanes", "flappy", "odm", "maniobras", "cable", "gancho", "donde esta el juego", "jugar"]],
        type: null,
        weight: 2.4,
        responses: ["<b>ODM Runner</b>: scroll horizontal estilo Flappy con <b>equipo de maniobras tridimensional</b>. Mantienes el clic y el cable se engancha a la superficie más cercana mediante <b>raycasting</b> (techo, muros o titanes) para impulsarte o frenar. La barra espaciadora activa un ataque que corta obstáculos y, al matar un titán, se activa el <em>Poder de los Titanes</em>. Está en el botón <b>«Minijuego AoT»</b> del pie de página."],
        follow: ["Proyectos", "Tecnologías", "Cómo está hecha la web"],
      },
      {
        id: "tecnologias",
        groups: [["tecnologias", "lenguajes", "framework", "frameworks", "html", "css", "javascript", "java", "python", "kotlin", "android", "sql", "mysql", "git", "github", "herramientas", "stack", "usa", "sabe", "manejo", "conozco", "programacion"]],
        type: "que",
        weight: 1.8,
        responses: [
          "Ahora mismo trabaja con <b>HTML semántico</b>, <b>CSS</b> (variables, grid, tema con <code>data-theme</code>) y <b>JavaScript vanilla</b>: canvas, fetch, localStorage, validación propia. Control de versiones con <b>Git/GitHub</b>. En el ciclo avanza hacia <b>POO</b>, <b>bases de datos</b> y desarrollo multiplataforma.",
          "Su base es <b>HTML + CSS + JavaScript puro</b>, sin dependencias ni build: todo se sirve estático. Usa <b>Git</b> para versionar y <b>Web3Forms</b> como proxy de correo porque una web estática no puede exponer credenciales SMTP. Próximo paso: POO y bases de datos del ciclo.",
        ],
        follow: ["Proyectos", "Formación", "Cómo está hecha la web"],
      },
      {
        id: "web",
        groups: [["web", "pagina", "disenyo", "diseno", "colores", "modo oscuro", "oscuro", "tema", "rayo", "como esta hecha", "como esta hecha la web", "como funciona la web", "arquitectura", "codigo", "codigo fuente"]],
        type: "como",
        weight: 2,
        responses: ["Tres ficheros: <code>index.html</code>, <code>styles.css</code> y <code>scripts.js</code>. Sin frameworks. Incluye tema claro/oscuro persistido en <code>localStorage</code>, navegación activa calculada por posición real (no con el observador, que fallaba), respeto de <code>prefers-reduced-motion</code>, foco visible, <code>aria-live</code> y el detalle del <b>rayo</b> al pulsar los títulos, dibujado en un <code>canvas</code> 2D con trazado segmentado y ramas aleatorias."],
        follow: ["Accesibilidad", "Cómo funcionas", "Proyectos"],
      },
      {
        id: "accesibilidad",
        groups: [["accesibilidad", "a11y", "accesible", "aria", "contraste", "teclado", "lectores de pantalla", "w3c", "seo", "rendimiento", "rapida", "velocidad", "optimizar"]],
        type: null,
        weight: 2,
        responses: ["Accesibilidad aplicada de verdad: <b>landmarks</b> semánticos, <b>skip link</b>, foco visible en todos los controles, roles ARIA en el chat y el estado del formulario, <code>aria-live</code> para mensajes dinámicos, jerarquía correcta de encabezados, contraste comprobado en los dos temas y <code>prefers-reduced-motion</code> para desactivar animaciones. El rendimiento es alto porque es estático: sin bundles ni peticiones externas salvo el envío del formulario."],
        follow: ["Cómo está hecha la web", "Proyectos", "Formación"],
      },
      {
        id: "gustos",
        groups: [["gustos", "musica", "deporte", "gimnasio", "futbol", "videojuegos", "hobbies", "aficiones", "tiempo libre", "ocio", "rocket league", "vicio", "vicios", "personalidad", "como eres", "que tal eres"]],
        type: null,
        weight: 1.6,
        responses: ["Escucha <b>música de casi todos los estilos</b>, entrena en el <b>gimnasio</b> y juega algún <b>partido los findes</b>. Como referente visual está <b>Ataque a los Titanes</b> (de ahí el juego) y entre videojuegos, <b>Rocket League</b>: reflejos, decisión y práctica, igual que programando."],
        follow: ["El minijuego", "Proyectos", "Formación"],
      },
      {
        id: "objetivo",
        groups: [["objetivo", "futuro", "quiero ser", "meta", "metas", "aspiraciones", "motivacion", "a que te dedicas", "a que se dedica", "por que programa", "porque programa", "por que la programacion", "sueno", "ambicion"]],
        type: "por",
        weight: 2,
        responses: ["Su meta es <b>dedicarse a la programación</b>: le atrae entender el funcionamiento interno de las páginas web y las aplicaciones. Su ruta: consolidar HTML/CSS/JS, dominar accesibilidad y rendimiento, aplicar buenas prácticas y construir proyectos propios que pueda defender."],
        follow: ["Formación", "Disponibilidad", "Proyectos"],
      },
      {
        id: "disponibilidad",
        groups: [["disponible", "disponibilidad", "practicas", "fct", "fct", "horario", "cuando", "cuando responde", "tarda", "respuesta", "plazo", "rapido", "tiempo", "libre", "agenda", "aceptas", "buscas trabajo", "trabajas"]],
        type: "cuando",
        weight: 1.8,
        responses: ["Está <b>buscando prácticas/FCT</b> en Valencia (o remoto) y abierto a colaboraciones. Responde normalmente en <b>menos de 48 h laborables</b>; si en el asunto pones «Prácticas / FCT», se prioriza. Es estudiante, así que su disponibilidad es compatible con el ciclo."],
        follow: ["Cómo contactar", "Formación", "Proyectos"],
      },
      {
        id: "idiomas",
        groups: [["idiomas", "valenciano", "ingles", "ingles nivel", "catalan", "b1", "b2", "nivel de ingles"]],
        type: null,
        weight: 2.2,
        responses: ["<b>Castellano</b> y <b>valenciano</b> como lenguas habituales, e <b>inglés</b> con nivel suficiente para leer documentación técnica y seguir tutoriales. (Actualiza este dato cuando tengas un certificado oficial.)"],
        follow: ["Formación", "Disponibilidad", "Cómo contactar"],
      },
      {
        id: "contacto",
        groups: [["contacto", "correo", "email", "mail", "escribir", "hablar", "telefono", "linkedin", "github", "redes", "redes sociales", "como contactar", "como te contacto", "enviar mensaje", "formulario", "requisitos", "precio", "tarifa", "cobra", "gratis"]],
        type: "como",
        weight: 1.8,
        responses: [
          `Puedes escribirle a <b>${EMAIL}</b>, ver su código en <a href='${GH}' target='_blank' rel='noopener'>github.com/Yerai1206</a> o rellenar el <b>formulario de contacto</b> de esta sección: valida en cliente, envía con <code>fetch</code> y te llega una confirmación automática. También tienes el botón <b>«Enviar con mi correo»</b> como respaldo.`,
          "Arriba tienes el <b>formulario</b> (con validación propia y respuesta automática al remitente) y los enlaces directos a <b>email</b>, <b>GitHub</b> y <b>LinkedIn</b>. Es estudiante, así que no factura: se acuerdan condiciones según el caso (prácticas, colaboración o proyecto).",
        ],
        follow: ["Disponibilidad", "Proyectos", "Formación"],
      },
      {
        id: "gracias",
        groups: [["muchas gracias", "gracias", "genial", "perfecto", "vale", "ok", "entendido", "bien"]],
        type: null,
        weight: 1,
        responses: ["¡A tu disposición! Si quieres, te resumo su <b>formación</b>, sus <b>proyectos</b> o te paso el <b>correo</b>."],
        follow: ["Cómo contactar", "Proyectos", "Ayuda"],
      },
    ];

    const FALLBACK =
      "No tengo esa información registrada. Puedo hablar de su <b>formación</b>, <b>proyectos</b>, <b>tecnologías</b>, <b>gustos</b>, <b>objetivo</b>, <b>disponibilidad</b>, <b>idiomas</b>, <b>ubicación</b>, <b>el minijuego</b>, <b>la web</b> o <b>cómo contactar</b>. Escribe <b>«ayuda»</b> para verlos todos o usa el formulario.";

    const STOP = new Set(
      "de la que el en y a los del las un una por con no su para al lo como mas pero sus le ya o the this es son ser fue ha han hay me se te nos mi tu cual cuales cuando donde porque sobre entre hasta desde muy mas menos todo toda todos he iba voy soy eres esta estoy estamos habe habia hay".split(" ")
    );

    /* ---------- Normalización y stemming ligero ---------- */
    function normalize(text) {
      return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9ñ\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function stem(word) {
      let w = word;
      if (w.length > 5 && w.endsWith("cion")) return w.slice(0, -3) + "c";
      if (w.length > 5 && w.endsWith("mente")) return w.slice(0, -5);
      if (w.length > 5 && w.endsWith("ando")) return w.slice(0, -4);
      if (w.length > 5 && w.endsWith("iendo")) return w.slice(0, -5);
      if (w.length > 4 && w.endsWith("ar")) return w.slice(0, -2);
      if (w.length > 4 && w.endsWith("er")) return w.slice(0, -2);
      if (w.length > 4 && w.endsWith("ir")) return w.slice(0, -2);
      if (w.length > 4 && w.endsWith("es") && !w.endsWith("ues")) return w.slice(0, -1);
      if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
      return w;
    }

    function tokenize(text) {
      return normalize(text).split(" ").map(stem).filter((w) => w.length > 2 && !STOP.has(w));
    }

    const QUESTION_TYPES = ["que", "quien", "donde", "cuando", "como", "cuanto", "porque", "por"];

    function detectType(text) {
      const n = " " + normalize(text) + " ";
      for (const t of QUESTION_TYPES) if (n.includes(" " + t + " ")) return t;
      return null;
    }

    /* ---------- Puntuación de intención ---------- */
    function scoreIntent(entry, query, qTokens, qType) {
      const n = normalize(query);
      let score = 0;

      // 1) coincidencias de grupos de sinónimos
      for (const group of entry.groups) {
        let hitInGroup = 0;
        for (const term of group) {
          const nt = normalize(term);
          if (nt.includes(" ")) {
            if (n.includes(nt)) { score += 4; hitInGroup++; continue; }
          }
          const stems = nt.split(" ").map(stem);
          if (stems.every((s) => qTokens.includes(s))) { score += 2; hitInGroup++; }
          else if (stems.some((s) => s.length > 3 && qTokens.some((t) => t.startsWith(s) || s.startsWith(t)))) { score += 1; hitInGroup++; }
        }
        if (hitInGroup > 1) score += 1.5; // varios sinónimos del mismo tema
      }

      // 2) coherencia con la palabra interrogativa
      if (qType && entry.type === qType) score += 1.4;

      return score * (entry.weight || 1);
    }

    function pickVariant(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function findAnswer(query) {
      const qTokens = tokenize(query);
      const qType = detectType(query);
      let best = null, bestScore = 0;

      for (const entry of KB) {
        const s = scoreIntent(entry, query, qTokens, qType);
        if (s > bestScore) { bestScore = s; best = entry; }
      }

      if (!best || bestScore < 3.2) return { text: FALLBACK, follow: ["Ayuda", "Cómo contactar", "Formación"] };
      return { text: pickVariant(best.responses), follow: best.follow || ["Ayuda", "Cómo contactar"] };
    }

    /* ---------- Render ---------- */
    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function addMsg(html, who) {
      const li = document.createElement("li");
      li.className = "msg msg--" + who;
      if (who === "user") li.textContent = html;
      else li.innerHTML = html;
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;
      return li;
    }

    function setFollow(list) {
      suggest.innerHTML = "";
      (list || []).forEach((q) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip-q";
        b.textContent = q;
        b.addEventListener("click", () => ask(q));
        suggest.appendChild(b);
      });
    }

    function persist() {
      try {
        const data = Array.from(log.children)
          .filter((li) => !li.classList.contains("msg--typing") && !li.classList.contains("msg--sys"))
          .map((li) => ({ w: li.classList.contains("msg--user") ? "user" : "bot", t: li.innerHTML }));
        sessionStorage.setItem(STORE, JSON.stringify(data.slice(-40)));
      } catch {}
    }

    function restore() {
      let raw = null;
      try { raw = sessionStorage.getItem(STORE); } catch { return false; }
      if (!raw) return false;
      try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || !data.length) return false;
        data.forEach((m) => addMsg(m.t, m.w));
        return true;
      } catch { return false; }
    }

    function ask(text) {
      const query = String(text).trim();
      if (!query) return;

      addMsg(query, "user");
      input.value = "";
      persist();

      const typing = document.createElement("li");
      typing.className = "msg msg--bot msg--typing";
      typing.setAttribute("aria-label", "El asistente está escribiendo");
      typing.innerHTML = "<i></i><i></i><i></i>";
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;

      const delay = reduceMotion.matches ? 60 : 420 + Math.random() * 320;
      setTimeout(() => {
        typing.remove();
        const res = findAnswer(query);
        addMsg(res.text, "bot");
        setFollow(res.follow);
        persist();
      }, delay);
    }

    form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });

    clearBtn.addEventListener("click", () => {
      log.innerHTML = "";
      try { sessionStorage.removeItem(STORE); } catch {}
      greet();
    });

    function greet() {
      addMsg("Hola, soy el <b>asistente del portafolio</b> de Yerai Piera Langa. Pregúntame por su <b>formación</b>, <b>proyectos</b>, <b>tecnologías</b>, <b>disponibilidad</b> o <b>cómo contactar</b>. Escribe <b>«ayuda»</b> para ver todos los temas.", "bot");
      setFollow(["¿Quién eres?", "Formación", "Proyectos", "Tecnologías", "Disponibilidad", "Cómo contactar"]);
    }

    if (!restore()) greet();
    else setFollow(["Ayuda", "Proyectos", "Cómo contactar"]);
  })();

  /* =========================================================
     7. EVENTOS GLOBALES
     ========================================================= */
  resizeCanvas();
  window.addEventListener("resize", () => { resizeCanvas(); updateSelectionUnderline(); queueSpy(); });
  window.addEventListener("scroll", queueSpy, { passive: true });
  updateSpy();

  menuToggle?.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  document.addEventListener("click", (event) => {
    if (nav.classList.contains("is-open") && !event.target.closest(".site-header")) closeMenu();
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  const desktopQuery = window.matchMedia("(min-width: 901px)");
  const onDesktop = (e) => e.matches && closeMenu();
  desktopQuery.addEventListener ? desktopQuery.addEventListener("change", onDesktop) : desktopQuery.addListener(onDesktop);

  document.addEventListener("selectionchange", updateSelectionUnderline);
  window.addEventListener("pointerdown", clearSelectionUnderline, true);
  window.addEventListener("pointerup", updateSelectionUnderline);
  window.addEventListener("keyup", updateSelectionUnderline);
  window.addEventListener("scroll", updateSelectionUnderline, true);

  window.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const title = target.closest(RAY_SELECTOR);
    if (!title) return;

    triggerZap(title);
    if (reduceMotion.matches) return;
    createBolt(event.clientX, event.clientY, title.getBoundingClientRect());
    startLoop();
  });
})();