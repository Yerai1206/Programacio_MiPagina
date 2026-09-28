(() => {
  const ACCESS_KEY = "2a0f1853-afa5-4c6d-9309-bddaae2da455";
  const EMAIL = "yerpielan@alu.edu.gva.es";
  const THEME_KEY = "yp_theme";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function normalizeText(text) {
    return String(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function initTheme() {
    const toggle = document.getElementById("theme-toggle");

    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;

      if (toggle) {
        const icon = toggle.querySelector(".theme-icon");
        if (icon) icon.textContent = theme === "dark" ? "☾" : "☀";
      }
    }

    const stored = localStorage.getItem(THEME_KEY);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(stored || systemTheme);

    toggle?.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(event.matches ? "dark" : "light");
      }
    });
  }

  function initScrollspy() {
    const links = [...document.querySelectorAll(".nav-link")];
    const sections = links
      .map((link) => document.querySelector(link.hash))
      .filter(Boolean);

    if (!sections.length) return;

    function setActive(id) {
      links.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
      });
    }

    function onScroll() {
      const lineY = window.innerHeight * 0.35;
      let current = sections[0].id;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= lineY) current = section.id;
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1].id;
      }

      setActive(current);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  function initYear() {
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function initContactForm() {
    const form = document.getElementById("contact-form");
    const formWrap = document.getElementById("contact-form-wrap");
    const successBox = document.getElementById("form-success");
    const errorBox = document.getElementById("form-error");
    const mailto = document.getElementById("mailto-fallback");

    if (!form || !formWrap || !successBox || !errorBox || !mailto) return;

    function updateMailto() {
      const name = form.elements["name"]?.value || "Visita";
      const email = form.elements["email"]?.value || "";
      const message = form.elements["message"]?.value || "";

      const subject = encodeURIComponent("Portafolio Yerai · mensaje desde web");
      const body = encodeURIComponent(`Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`);

      mailto.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
    }

    function clearFormState() {
      form.reset();
      errorBox.textContent = "";
      successBox.hidden = true;
      successBox.innerHTML = "";
      formWrap.hidden = false;
      updateMailto();
    }

    form.addEventListener("input", updateMailto);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      const honey = form.elements["_honey"];
      if (honey && honey.value.trim() !== "") return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent || "Enviar correo";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Enviando…";
      }

      errorBox.textContent = "";

      const data = Object.fromEntries(new FormData(form).entries());

      const payload = {
        access_key: ACCESS_KEY,
        subject: `Web portafolio · mensaje de ${data.name || "Visitante"}`,
        from_name: "Portafolio Yerai Piera",
        name: data.name,
        email: data.email,
        message: data.message,
        page: window.location.href,
        datetime: new Date().toLocaleString("es-ES"),
        _captcha: "false",
        _autoresponse: true,
        _template: "table"
      };

      try {
        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload)
        });

        const json = await response.json().catch(() => ({}));

        if (!response.ok || !json.success) {
          throw new Error(json.message || "No se pudo enviar el correo.");
        }

        formWrap.hidden = true;
        successBox.hidden = false;
        successBox.innerHTML = `
          <div class="success-head">✔ Correo enviado</div>
          <p>
            Gracias, ${escapeHtml(data.name)}. Tu mensaje ha llegado correctamente.
            Te responderé a <strong>${escapeHtml(data.email)}</strong> lo antes posible.
          </p>
          <button type="button" class="btn secondary" id="contact-reset-btn">
            Nuevo mensaje
          </button>
        `;

        successBox
          .querySelector("#contact-reset-btn")
          ?.addEventListener("click", () => {
            clearFormState();
            form.elements["name"]?.focus();
          });
      } catch (error) {
        errorBox.textContent =
          `No se pudo enviar: ${error.message}. Prueba con el botón de respaldo.`;
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });

    clearFormState();

    window.addEventListener("pageshow", (event) => {
      if (event.persisted) clearFormState();
    });
  }

  function initChatbot() {
    const toggle = document.getElementById("chat-toggle");
    const panel = document.getElementById("chat-panel");
    const close = document.getElementById("chat-close");
    const messages = document.getElementById("chat-messages");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");

    if (!toggle || !panel || !messages || !form || !input) return;

    const knowledge = [
      {
        keys: ["hola", "buenas", "hey", "saludos", "que tal", "qué tal"],
        responses: [
          "Hola, soy el asistente del portafolio de Yerai. Puedes preguntarme por <b>ODM Runner</b>, formación, contacto o proyectos."
        ]
      },
      {
        keys: ["juego", "odm", "runner", "aot", "minijuego", "maniobras", "raycasting", "titan", "titán", "equipo", "espaciadora", "ataque"],
        responses: [
          "<b>ODM Runner</b>: scroll horizontal estilo Flappy con <b>equipo de maniobras tridimensional</b>. Mantienes el clic y el cable se engancha a la superficie más cercana con <b>raycasting</b> (techo, muros o titanes) para impulsarte o frenar. La barra espaciadora activa un ataque que corta obstáculos y, al matar un titán, se activa el <em>Poder de los Titanes</em>. Está en <a href='juego/juego.html'>Minijuego AoT</a>."
        ]
      },
      {
        keys: ["correo", "email", "contacto", "contactar", "mail", "escribir"],
        responses: [
          "Puedes escribir a <b>yerpielan@alu.edu.gva.es</b> o usar el formulario de contacto. También tengo <a href='https://github.com/Yerai1206' target='_blank' rel='noopener noreferrer'>GitHub</a> y LinkedIn."
        ]
      },
      {
        keys: ["estudios", "dam", "bachillerato", "ies", "simarro", "formacion", "formación", "edad"],
        responses: [
          "Estudié Bachillerato científico y curso <b>1º de DAM</b> en el IES Simarro, Valencia. Tengo 19 años."
        ]
      },
      {
        keys: ["github", "repositorio", "code", "codigo", "código"],
        responses: [
          "Mi GitHub es <a href='https://github.com/Yerai1206' target='_blank' rel='noopener noreferrer'>github.com/Yerai1206</a>."
        ]
      },
      {
        keys: ["linkedin", "profesional", "empleo", "practicas", "prácticas"],
        responses: [
          "Puedes ver mi perfil profesional en LinkedIn desde la sección de contacto. En el portafolio también hay proyectos y el juego ODM Runner."
        ]
      },
      {
        keys: ["ayuda", "puedes", "que sabes", "qué sabes", "info"],
        responses: [
          "Puedo responder sobre <b>ODM Runner</b>, mis estudios, contacto, GitHub y proyectos."
        ]
      },
      {
        keys: ["gracias", "genial", "bien", "perfecto"],
        responses: [
          "¡A tu servicio! Si quieres, pregunta por <b>ODM Runner</b> o por contacto."
        ]
      }
    ];

    function getBotReply(text) {
      const normalized = normalizeText(text);
      let best = null;
      let bestScore = 0;

      for (const item of knowledge) {
        let score = 0;

        for (const key of item.keys) {
          const normalizedKey = normalizeText(key);
          if (normalized.includes(normalizedKey)) {
            score += normalizedKey.length;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }

      if (!best) {
        return "No tengo una respuesta exacta para eso. Prueba con: <b>ODM Runner</b>, <b>contacto</b>, <b>estudios</b>, <b>GitHub</b>.";
      }

      return best.responses[Math.floor(Math.random() * best.responses.length)];
    }

    function addMessage(role, html) {
      const div = document.createElement("div");
      div.className = `chat-message ${role}`;
      div.innerHTML = html;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function setOpen(open) {
      panel.classList.toggle("open", open);
      panel.setAttribute("aria-hidden", String(!open));
      toggle.setAttribute("aria-expanded", String(open));

      const text = toggle.querySelector(".chat-toggle-text");
      if (text) {
        text.textContent = open ? "Cerrar chat IA" : "Abrir chat IA";
      }

      if (open) {
        if (!messages.dataset.greeted) {
          addMessage(
            "bot",
            "Puedo contarte qué hace <b>ODM Runner</b>, mi formación, contacto o proyectos. También puedes pulsar <a href='juego/juego.html'>aquí</a> para jugar."
          );
          messages.dataset.greeted = "1";
        }

        setTimeout(() => input.focus(), 50);
      }
    }

    toggle.addEventListener("click", () => {
      setOpen(!panel.classList.contains("open"));
    });

    close?.addEventListener("click", () => setOpen(false));

    document.querySelectorAll(".chat-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const question = chip.dataset.q || "";
        input.value = question;
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.classList.contains("open")) {
        setOpen(false);
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const value = input.value.trim();
      if (!value) return;

      addMessage("user", escapeHtml(value));
      input.value = "";

      setTimeout(() => {
        addMessage("bot", getBotReply(value));
      }, 220);
    });
  }

  function init() {
    initTheme();
    initYear();
    initScrollspy();
    initContactForm();
    initChatbot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();