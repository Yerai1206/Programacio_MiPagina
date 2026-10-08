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

  /* 1. Tema Claro / Oscuro */
  const THEME_KEY = "portafolio-theme-estudiante";
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

  /* 2. Menú Móvil Responsive */
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

  /* 3. Scroll Suave y Scrollspy */
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

  /* 4. Buscador y Filtro de Proyectos */
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

  /* Toggle del Case Study de AOT */
  const toggleAotBtn = document.getElementById("toggleAotBtn");
  const caseStudy = document.getElementById("caseStudy");
  
  if (toggleAotBtn && caseStudy) {
    toggleAotBtn.addEventListener("click", () => {
      caseStudy.classList.toggle("hidden");
      if (caseStudy.classList.contains("hidden")) {
        toggleAotBtn.textContent = "Ver análisis técnico";
      } else {
        toggleAotBtn.textContent = "Ocultar análisis";
        // Scroll suave al aparecer
        caseStudy.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  /* 5. Estimador / Calculadora Ajustado */
  const projectTypeSelect = document.getElementById("projectType");
  const pageCountSelect = document.getElementById("pageCount");
  const featFormCheck = document.getElementById("featForm");
  const featDarkCheck = document.getElementById("featDark");

  const resHours = document.getElementById("resHours");
  const resComplexity = document.getElementById("resComplexity");
  const resTech = document.getElementById("resTech");
  const btnApplyCalc = document.getElementById("btnApplyCalc");

  function calculateEstimate() {
    if (!projectTypeSelect) return;

    let baseHours = 10;
    let complexity = "Baja";
    let techList = ["HTML", "CSS"];

    const type = projectTypeSelect.value;
    if (type === "landing") {
      baseHours = 15;
      complexity = "Baja";
    } else if (type === "dinamico") {
      baseHours = 30;
      complexity = "Media";
      techList.push("PHP", "SQL");
    } else if (type === "canvas") {
      baseHours = 40;
      complexity = "Alta";
      techList = ["HTML", "CSS", "JavaScript Vanilla"];
    }

    const pages = pageCountSelect.value;
    if (pages === "medium") {
      baseHours += 10;
    } else if (pages === "large") {
      baseHours += 20;
      complexity = type === "landing" ? "Media" : "Alta";
    }

    if (featFormCheck?.checked) {
      baseHours += 3;
      if (!techList.includes("JS")) techList.push("JS/API");
    }
    if (featDarkCheck?.checked) {
      baseHours += 2;
    }

    const minH = Math.max(10, baseHours - 5);
    const maxH = baseHours + 5;

    if (resHours) resHours.textContent = `${minH} - ${maxH} horas`;
    if (resComplexity) resComplexity.textContent = complexity;
    if (resTech) resTech.textContent = techList.join(", ");
  }

  [projectTypeSelect, pageCountSelect, featFormCheck, featDarkCheck].forEach((el) => {
    el?.addEventListener("change", calculateEstimate);
  });

  calculateEstimate();

  btnApplyCalc?.addEventListener("click", () => {
    const subjectInput = document.getElementById("subject_input");
    const messageInput = document.getElementById("message");

    if (subjectInput && projectTypeSelect) {
      const selectedTypeLabel = projectTypeSelect.options[projectTypeSelect.selectedIndex].text;
      subjectInput.value = `Práctica: ${selectedTypeLabel}`;
    }

    if (messageInput && resHours && resTech) {
      messageInput.value = `Hola Yerai, me gustaría que hablásemos sobre una práctica tipo "${projectTypeSelect.options[projectTypeSelect.selectedIndex].text}".
Estimación calculada: ${resHours.textContent}.
Tecnologías: ${resTech.textContent}.`;
    }

    scrollToId("#contacto");
  });

  /* 6. Formulario Web3Forms & Autoresponder */
  const form = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const replytoInput = document.getElementById("replytoInput");

  function setFieldError(input, message) {
    const field = input.closest(".field");
    if (!field) return;
    const error = field.querySelector(".field-error");
    if (error) error.textContent = message || "";
  }

  function clearFormErrors() {
    if (!form) return;
    form.querySelectorAll(".field-error").forEach((error) => (error.textContent = ""));
  }

  function showStatus(type, text) {
    if (!formStatus) return;
    formStatus.textContent = text;
    formStatus.className = `form-status ${type}`;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form) return;

    const honey = form.elements["_honey"];
    if (honey && honey.value) return; 

    clearFormErrors();

    const emailInput = form.elements["email"];
    if (replytoInput && emailInput) {
      replytoInput.value = emailInput.value.trim();
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.message);
      form.reset();
      showStatus("success", "✅ Mensaje enviado de prueba. Recibirás respuesta automática.");
    } catch (error) {
      showStatus("error", `❌ Ocurrió un error. Escríbeme directamente.`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  /* 7. Asistente Virtual / Chatbot Básico */
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatLog = document.getElementById("chatLog");
  const chatStatus = document.getElementById("chatStatus");

  function addChat(text, sender, isHtml = false) {
    if (!chatLog) return;
    const msg = document.createElement("div");
    msg.className = `chat-msg ${sender}`;
    if (isHtml) msg.innerHTML = text;
    else msg.textContent = text;
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function getLocalResponse(query) {
    const q = query.toLowerCase();
    if (q.includes("estudio") || q.includes("dam") || q.includes("curso")) {
      return "Estudio 1º de Grado Superior en Desarrollo de Aplicaciones Multiplataforma (DAM) en el IES Simarro.";
    }
    if (q.includes("juego") || q.includes("aot")) {
      return "El <b>Juego de Aot</b> es una práctica hecha con HTML5 Canvas y JS nativo. Se puede jugar desde la sección proyectos.";
    }
    if (q.includes("formulario") || q.includes("contact")) {
      return "El formulario usa la API gratuita de Web3Forms y tiene un sistema de respuesta automática.";
    }
    return "Hola, soy un bot básico configurado para mi práctica. Pregunta sobre 'estudios', 'juego aot' o 'formulario'.";
  }

  if (chatForm && chatInput) {
    addChat("¡Hola! Soy el asistente automático del portafolio. ¿En qué te ayudo?", "bot");

    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      addChat(text, "user");
      chatInput.value = "";
      if (chatStatus) chatStatus.textContent = "Escribiendo...";
      setTimeout(() => {
        if (chatStatus) chatStatus.textContent = "";
        addChat(getLocalResponse(text), "bot", true);
      }, 500);
    });

    document.querySelectorAll(".chip[data-question]").forEach((chip) => {
      chip.addEventListener("click", () => {
        chatInput.value = chip.dataset.question;
        chatForm.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    });
  }
})();