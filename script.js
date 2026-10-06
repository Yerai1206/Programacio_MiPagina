(function () {
  "use strict";

  const siteHeader = document.getElementById("header");
  const nav = document.getElementById("nav");
  const menuToggle = document.getElementById("menuToggle");
  const themeToggle = document.getElementById("themeToggle");
  const root = document.documentElement;
  const yearSpan = document.getElementById("year");

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  /* -----------------------------
     1. Tema Claro / Oscuro
  ------------------------------ */
  const THEME_KEY = "portafolio-theme-yerai";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const savedTheme = localStorage.getItem(THEME_KEY);

  if (savedTheme) {
    root.setAttribute("data-theme", savedTheme);
  } else if (prefersDark) {
    root.setAttribute("data-theme", "dark");
  }

  function updateThemeIcon() {
    if (!themeToggle) return;
    themeToggle.textContent = root.getAttribute("data-theme") === "dark" ? "☀" : "☾";
  }

  updateThemeIcon();

  themeToggle?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon();
  });

  /* -----------------------------
     2. Menú Móvil Responsive
  ------------------------------ */
  function closeNav() {
    if (!nav || !menuToggle) return;
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  menuToggle?.addEventListener("click", () => {
    if (!nav) return;
    const open = nav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (event) => {
    if (!nav || !menuToggle) return;
    if (!nav.classList.contains("open")) return;
    if (nav.contains(event.target) || menuToggle.contains(event.target)) return;
    closeNav();
  });

  document.querySelectorAll(".nav-list a").forEach((link) => {
    link.addEventListener("click", closeNav);
  });

  /* -----------------------------
     3. Scroll Suave y Scrollspy
  ------------------------------ */
  function scrollToId(hash) {
    const target = document.querySelector(hash);
    if (!target) return;
    const offset = (siteHeader?.offsetHeight || 72) + 20;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      if (hash.length > 1 && document.querySelector(hash)) {
        event.preventDefault();
        scrollToId(hash);
        history.pushState(null, "", hash);
      }
    });
  });

  const navLinks = Array.from(document.querySelectorAll('.nav-list a[href^="#"]'));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  let ticking = false;

  function updateActiveSection() {
    if (!sections.length) return;
    const offset = (siteHeader?.offsetHeight || 72) + 30;
    let current = sections[0];

    for (const section of sections) {
      if (section.getBoundingClientRect().top <= offset) {
        current = section;
      }
    }

    const activeLink = navLinks.find((link) => link.getAttribute("href") === `#${current.id}`);
    if (activeLink) {
      navLinks.forEach((l) => l.classList.toggle("active", l === activeLink));
    }
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateActiveSection();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  updateActiveSection();

  /* -----------------------------
     4. Buscador y Filtro de Proyectos
  ------------------------------ */
  const projectSearch = document.getElementById("projectSearch");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const projectCards = document.querySelectorAll("#projectsGrid .project-card");

  let currentCategory = "all";
  let currentSearchQuery = "";

  function filterProjects() {
    projectCards.forEach((card) => {
      const categories = (card.dataset.category || "").toLowerCase();
      const text = card.textContent.toLowerCase();

      const matchesCategory = currentCategory === "all" || categories.includes(currentCategory);
      const matchesSearch = !currentSearchQuery || text.includes(currentSearchQuery);

      if (matchesCategory && matchesSearch) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.filter.toLowerCase();
      filterProjects();
    });
  });

  projectSearch?.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    filterProjects();
  });

  /* -----------------------------
     5. Estimador / Calculadora
  ------------------------------ */
  const projectTypeSelect = document.getElementById("projectType");
  const featFormCheck = document.getElementById("featForm");
  const featDarkCheck = document.getElementById("featDark");
  const featDbCheck = document.getElementById("featDb");
  const urgencySelect = document.getElementById("urgency");

  const resHours = document.getElementById("resHours");
  const resComplexity = document.getElementById("resComplexity");
  const resTech = document.getElementById("resTech");
  const btnApplyCalc = document.getElementById("btnApplyCalc");

  function calculateEstimate() {
    if (!projectTypeSelect) return;

    let baseHours = 15;
    let complexity = "Media";
    let techList = ["HTML5", "CSS3", "JavaScript"];

    const type = projectTypeSelect.value;
    if (type === "landing") {
      baseHours = 12;
      complexity = "Baja - Media";
    } else if (type === "corporate") {
      baseHours = 25;
      complexity = "Media";
      techList.push("Web3Forms API");
    } else if (type === "canvas") {
      baseHours = 35;
      complexity = "Alta";
      techList.push("Canvas 2D", "Algoritmos / Física");
    } else if (type === "java") {
      baseHours = 30;
      complexity = "Media - Alta";
      techList = ["Java", "SQL", "JDBC", "Eclipse/VSCode"];
    }

    if (featFormCheck?.checked && !techList.includes("Web3Forms API")) {
      baseHours += 3;
      techList.push("Web3Forms API");
    }
    if (featDarkCheck?.checked) {
      baseHours += 2;
    }
    if (featDbCheck?.checked && !techList.includes("SQL")) {
      baseHours += 10;
      techList.push("Base de Datos / SQL");
      complexity = "Alta";
    }

    if (urgencySelect?.value === "express") {
      baseHours = Math.round(baseHours * 0.9);
    }

    const minH = Math.max(10, baseHours - 3);
    const maxH = baseHours + 5;

    if (resHours) resHours.textContent = `${minH} - ${maxH} horas`;
    if (resComplexity) resComplexity.textContent = complexity;
    if (resTech) resTech.textContent = techList.join(", ");
  }

  [projectTypeSelect, featFormCheck, featDarkCheck, featDbCheck, urgencySelect].forEach((el) => {
    el?.addEventListener("change", calculateEstimate);
  });

  calculateEstimate();

  btnApplyCalc?.addEventListener("click", () => {
    const contactForm = document.getElementById("contactForm");
    const subjectInput = document.getElementById("subject_input");
    const messageInput = document.getElementById("message");

    if (subjectInput && projectTypeSelect) {
      const selectedTypeLabel = projectTypeSelect.options[projectTypeSelect.selectedIndex].text;
      subjectInput.value = `Consulta: ${selectedTypeLabel}`;
    }

    if (messageInput && resHours && resTech) {
      messageInput.value = `Hola Yerai, he utilizado el estimador de tu web para un proyecto tipo "${projectTypeSelect.options[projectTypeSelect.selectedIndex].text}".

Estimación calculada: ${resHours.textContent}.
Tecnologías previas: ${resTech.textContent}.

Me gustaría recibir más información.`;
    }

    scrollToId("#contacto");
  });

  /* -----------------------------
     6. Formulario Web3Forms & Autoresponder
  ------------------------------ */
  const form = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const copyEmailBtn = document.getElementById("copyEmail");
  const replytoInput = document.getElementById("replytoInput");
  const userEmail = "yerpielan@alu.edu.gva.es";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setFieldError(input, message) {
    const field = input.closest(".field");
    if (!field) return;
    const error = field.querySelector(".field-error");
    if (error) error.textContent = message || "";
    input.classList.toggle("invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function clearFormErrors() {
    if (!form) return;
    form.querySelectorAll(".field-error").forEach((error) => (error.textContent = ""));
    form.querySelectorAll(".invalid").forEach((input) => {
      input.classList.remove("invalid");
      input.setAttribute("aria-invalid", "false");
    });
  }

  function showStatus(type, text) {
    if (!formStatus) return;
    formStatus.textContent = text;
    formStatus.className = `form-status ${type}`;
  }

  function validateForm() {
    if (!form) return false;
    let ok = true;

    const name = form.elements["name"];
    const emailInput = form.elements["email"];
    const message = form.elements["message"];
    const consent = form.elements["consent"];

    if (name.value.trim().length < 2) {
      setFieldError(name, "Por favor, escribe tu nombre.");
      ok = false;
    } else {
      setFieldError(name, "");
    }

    if (!emailRegex.test(emailInput.value.trim())) {
      setFieldError(emailInput, "Introduce una dirección de correo válida.");
      ok = false;
    } else {
      setFieldError(emailInput, "");
    }

    if (message.value.trim().length < 10) {
      setFieldError(message, "El mensaje debe tener al menos 10 caracteres.");
      ok = false;
    } else {
      setFieldError(message, "");
    }

    if (!consent.checked) {
      setFieldError(consent, "Debes aceptar el consentimiento para responderte.");
      ok = false;
    } else {
      setFieldError(consent, "");
    }

    return ok;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form) return;

    const honey = form.elements["_honey"];
    if (honey && honey.value) return; // Spam prevention

    clearFormErrors();

    if (!validateForm()) {
      showStatus("error", "Por favor, revisa los campos señalados.");
      return;
    }

    // Configurar replyto dinámico para el correo de autorespuesta
    const emailInput = form.elements["email"];
    if (replytoInput && emailInput) {
      replytoInput.value = emailInput.value.trim();
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando mensaje...";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Ocurrió un problema con el envío.");
      }

      form.reset();
      clearFormErrors();
      showStatus("success", "✅ Mensaje enviado con éxito. Te hemos enviado un correo de confirmación automático.");
    } catch (error) {
      showStatus("error", `❌ ${error?.message || "No se pudo enviar."} Puedes escribirme directamente a ${userEmail}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  copyEmailBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(userEmail);
      copyEmailBtn.textContent = "¡Correo copiado! ✓";
      setTimeout(() => {
        copyEmailBtn.textContent = "Copiar correo";
      }, 2000);
    } catch (err) {
      showStatus("info", `Correo: ${userEmail}`);
    }
  });

  /* -----------------------------
     7. Asistente Virtual / Chatbot
  ------------------------------ */
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatLog = document.getElementById("chatLog");
  const chatStatus = document.getElementById("chatStatus");

  function addChat(text, sender, isHtml = false) {
    if (!chatLog) return;
    const msg = document.createElement("div");
    msg.className = `chat-msg ${sender}`;
    if (isHtml) {
      msg.innerHTML = text;
    } else {
      msg.textContent = text;
    }
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function getLocalResponse(query) {
    const q = query.toLowerCase();

    if (q.includes("quien") || q.includes("yerai") || q.includes("presentacion")) {
      return "Soy <b>Yerai Piera Langa</b>, estudiante de 19 años de 1º DAM en el IES Simarro (Valencia). Apasionado de la programación web, Java y el desarrollo funcional.";
    }
    if (q.includes("estudio") || q.includes("dam") || q.includes("simarro")) {
      return "Estudio 1º de Grado Superior en Desarrollo de Aplicaciones Multiplataforma (DAM) en el IES Simarro en Xàtiva (Valencia).";
    }
    if (q.includes("juego") || q.includes("aot") || q.includes("tit")) {
      return "El <b>Juego de Aot</b> es un desarrollo propio en HTML5 Canvas con física de maniobras tridimensionales, raycasting y modo Poder de Titán. Puedes probarlo desde el botón de la web.";
    }
    if (q.includes("correo") || q.includes("contact") || q.includes("web3forms")) {
      return "El correo de contacto principal es <b>yerpielan@alu.edu.gva.es</b>. El formulario utiliza Web3Forms con confirmación por correo automática al remitente.";
    }
    if (q.includes("proyectos") || q.includes("java") || q.includes("habilidades")) {
      return "En la sección de proyectos encontrarás el Juego de Aot, el Portafolio web y sistemas en Java con bases de datos SQL.";
    }

    return "Puedo darte información sobre los proyectos de Yerai, sus estudios en DAM, el Juego de Aot o el formulario de contacto.";
  }

  if (chatForm && chatInput) {
    addChat("¡Hola! Soy el asistente virtual del portafolio. ¿En qué te puedo ayudar hoy?", "bot");

    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      addChat(text, "user");
      chatInput.value = "";

      if (chatStatus) chatStatus.textContent = "Escribiendo...";

      setTimeout(() => {
        if (chatStatus) chatStatus.textContent = "";
        const reply = getLocalResponse(text);
        addChat(reply, "bot", true);
      }, 400);
    });

    document.querySelectorAll(".chip[data-question]").forEach((chip) => {
      chip.addEventListener("click", () => {
        chatInput.value = chip.dataset.question;
        chatForm.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    });
  }

  /* -----------------------------
     8. Reproductor de Música Lateral
  ------------------------------ */
  const musicDock = document.getElementById("musicDock");
  const musicToggle = document.getElementById("musicToggle");
  const musicClose = document.getElementById("musicClose");
  const spotifyFrame = document.getElementById("spotifyFrame");

  function openMusic() {
    if (!musicDock) return;
    musicDock.classList.add("open");
    musicToggle?.setAttribute("aria-expanded", "true");
    if (spotifyFrame && !spotifyFrame.src) {
      spotifyFrame.src = spotifyFrame.dataset.src || "";
    }
  }

  function closeMusic() {
    if (!musicDock) return;
    musicDock.classList.remove("open");
    musicToggle?.setAttribute("aria-expanded", "false");
  }

  musicToggle?.addEventListener("click", () => {
    if (musicDock.classList.contains("open")) {
      closeMusic();
    } else {
      openMusic();
    }
  });

  musicClose?.addEventListener("click", closeMusic);
})();