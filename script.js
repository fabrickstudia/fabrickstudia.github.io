// Studio contact details & configuration for FABRI'K (г. Ухта, просп. Мира, д. 2, офис 5)
const SITE_CONFIG = {
  phone: "+7 (904) 274-73-63",
  address: "г. Ухта, просп. Мира, д. 2, офис 5",
  openingHours: "Пн—Вс: 08:00 – 21:00",
  socialLinks: [
    { label: "Онлайн-запись DIKIDI", url: "https://dikidi.net/56245" },
    { label: "ВКонтакте", url: "https://vk.com/club111739287" },
    { label: "Telegram-бот", url: "https://t.me/fabrik_salon_bot" }
  ],
  yandexMapsUrl: "https://yandex.ru/map-widget/v1/?ll=53.705357%2C63.557776&z=17&pt=53.705357,63.557776,pm2rdm",
};

// DOM references
const phoneNode = document.querySelector("#contact-phone");
const addressNode = document.querySelector("#contact-address");
const hoursNode = document.querySelector("#contact-hours");
const socialLinksNode = document.querySelector("#social-links");
const mapPlaceholder = document.querySelector("#map-placeholder");
const yandexMap = document.querySelector("#yandex-map");

if (phoneNode && SITE_CONFIG.phone) {
  phoneNode.href = `tel:${SITE_CONFIG.phone.replace(/[^\d+]/g, "")}`;
  phoneNode.textContent = SITE_CONFIG.phone;
}

if (addressNode && SITE_CONFIG.address) addressNode.textContent = SITE_CONFIG.address;
if (hoursNode && SITE_CONFIG.openingHours) hoursNode.textContent = SITE_CONFIG.openingHours;

// Mobile navigation toggle
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");

function closeMenu() {
  if (!menuButton || !navigation) return;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Открыть меню");
  navigation.classList.remove("is-open");
}

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Открыть меню" : "Закрыть меню");
    navigation.classList.toggle("is-open", !isOpen);
  });
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

// Interactive Pricing Tabs
const pricingTabs = document.querySelectorAll(".pricing-tab");
const pricingCards = document.querySelectorAll(".pricing-card");

pricingTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    pricingTabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");

    const category = tab.dataset.tab;
    pricingCards.forEach((card) => {
      if (category === "all" || card.dataset.category === category) {
        card.style.display = "";
        card.classList.remove("is-revealed");
        void card.offsetWidth; // force reflow for animation
        card.classList.add("is-revealed");
      } else {
        card.style.display = "none";
      }
    });
  });
});

// Click on service highlight cards triggers corresponding tab filter
document.querySelectorAll(".service-card[data-category]").forEach((card) => {
  card.addEventListener("click", (e) => {
    const category = card.dataset.category;
    const targetTab = document.querySelector(`.pricing-tab[data-tab='${category}']`);
    if (targetTab) {
      targetTab.click();
    }
  });
});

// Scroll Reveal Animations with IntersectionObserver
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
  );

  document
    .querySelectorAll(
      ".section-heading, .service-card, .pricing-card, .studio-copy, .telegram-banner, .gallery-item, .booking-intro, .contacts-top, .contact-details"
    )
    .forEach((el) => {
      el.classList.add("reveal-item");
      revealObserver.observe(el);
    });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

let chatSessionId = localStorage.getItem("fabrik_chat_session");
if (!chatSessionId) {
  chatSessionId = "user_" + Math.random().toString(36).substring(2, 9);
  localStorage.setItem("fabrik_chat_session", chatSessionId);
}

const API_BASE = window.location.hostname.includes("github.io")
  ? "https://fabrik-ukhta.netlify.app"
  : "";

// Helper to deliver leads and questions directly to master's Telegram
async function sendLeadToTelegram({ text = "", name = "", phone = "", service = "", date = "" }) {
  const token = "8842149950:AAHQhK1lTFVUS-XIFiqmkjYsk-dp7vPH7V0";
  const chatId = "8941327288";

  let msg = `💬 <b>Новое обращение с сайта FABRI'K</b>\n\n`;
  if (name) msg += `👤 <b>Имя:</b> ${escapeHtml(name)}\n`;
  if (phone) msg += `📞 <b>Телефон:</b> ${escapeHtml(phone)}\n`;
  if (service) msg += `✂️ <b>Услуга:</b> ${escapeHtml(service)}\n`;
  if (date) msg += `📅 <b>Желаемая дата:</b> ${escapeHtml(date)}\n`;
  if (text) msg += `\n💬 <b>Сообщение:</b>\n«${escapeHtml(text)}»\n`;
  msg += `\n<i>Отправлено с сайта фабрик</i>`;

  const payload = JSON.stringify({
    chat_id: chatId,
    text: msg,
    parse_mode: "HTML"
  });

  // 1. Direct Telegram Bot API
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    if (res.ok) {
      return { success: true, method: "direct" };
    }
  } catch {}

  // 2. Fallback proxy (works when TSPPU blocks api.telegram.org)
  try {
    const proxyUrl = `https://corsproxy.io/?url=` + encodeURIComponent(`https://api.telegram.org/bot${token}/sendMessage`);
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    if (res.ok) {
      return { success: true, method: "proxy" };
    }
  } catch {}

  return { success: false };
}

// Booking form handler
const form = document.querySelector("#booking-form");
const bookingResult = document.querySelector("#booking-result");
const status = document.querySelector("#form-status");
const bookingActions = document.querySelector("#booking-actions");
let bookingRequest = "";

if (form && status) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const invalidField = form.querySelector(":invalid");
    if (invalidField) {
      invalidField.focus();
      status.textContent = "Пожалуйста, заполните все обязательные поля (имя, телефон, услуга, дата).";
      if (bookingResult) bookingResult.hidden = false;
      return;
    }
    const values = new FormData(form);
    const name = values.get("name") || "";
    const phone = values.get("phone") || "";
    const service = values.get("service") || "";
    const rawDate = values.get("date");
    let formattedDate = rawDate;
    try {
      const date = new Date(`${rawDate}T12:00:00`);
      formattedDate = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch {
      // Keep raw date
    }

    bookingRequest = [
      "Здравствуйте! Хочу записаться в студию FABRI’K.",
      `Имя: ${name}`,
      `Телефон: ${phone}`,
      `Услуга: ${service}`,
      `Желаемая дата: ${formattedDate}`,
    ].join("\n");

    // Copy to clipboard automatically
    try {
      await navigator.clipboard.writeText(bookingRequest);
    } catch {
      // Ignore
    }

    if (bookingResult) bookingResult.hidden = false;
    status.innerHTML = "Отправка заявки мастеру в Telegram...";

    const res = await sendLeadToTelegram({
      name,
      phone,
      service,
      date: formattedDate,
      text: `Заявка на запись: ${service} на ${formattedDate}`
    });

    const waUrl = `https://wa.me/79042747363?text=${encodeURIComponent(bookingRequest)}`;

    if (res.success) {
      status.innerHTML = "<strong>✅ Заявка отправлена прямо в Telegram мастеру Юлии!</strong> Мы свяжемся с вами в ближайшее время для подтверждения.";
      if (bookingActions) {
        bookingActions.innerHTML = `
          <a class="booking-action-btn" href="https://dikidi.net/56245" target="_blank" rel="noopener noreferrer">
            Выбрать точное время в DIKIDI ↗
          </a>
          <a class="booking-action-btn secondary" href="https://t.me/fabrik_salon_bot" target="_blank" rel="noopener noreferrer">
            Открыть Telegram-бот ↗
          </a>
          <a class="booking-action-btn secondary" href="${waUrl}" target="_blank" rel="noopener noreferrer">
            Написать в WhatsApp ↗
          </a>
        `;
      }
    } else {
      status.innerHTML = "<strong>Заявка сформирована и скопирована в буфер.</strong> Выберите удобный способ отправки мастеру:";
      if (bookingActions) {
        bookingActions.innerHTML = `
          <a class="booking-action-btn" href="https://t.me/fabrik_salon_bot" target="_blank" rel="noopener noreferrer">
            Отправить в Telegram ↗
          </a>
          <a class="booking-action-btn" href="${waUrl}" target="_blank" rel="noopener noreferrer">
            Отправить в WhatsApp ↗
          </a>
          <a class="booking-action-btn secondary" href="https://dikidi.net/56245" target="_blank" rel="noopener noreferrer">
            Записаться в DIKIDI ↗
          </a>
        `;
      }
    }
  });
}

// Interactive Booking from Pricing Cards
document.querySelectorAll(".pricing-card").forEach((card) => {
  const btn = card.querySelector(".pricing-btn");
  const nameEl = card.querySelector(".pricing-name");
  if (!btn || !nameEl) return;
  const serviceName = nameEl.textContent.trim();
  btn.setAttribute("href", "#booking");
  btn.removeAttribute("target");
  btn.removeAttribute("rel");
  btn.innerHTML = `Записаться <span>↓</span>`;
  
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const bookingSection = document.querySelector("#booking");
    const serviceSelect = document.querySelector('select[name="service"]');
    const nameInput = document.querySelector('input[name="name"]');
    
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: "smooth" });
    }
    
    if (serviceSelect) {
      let matched = false;
      const lowerName = serviceName.toLowerCase();
      for (const opt of serviceSelect.options) {
        const lowerOpt = opt.value.toLowerCase();
        if (lowerName.includes(lowerOpt) || lowerOpt.includes(lowerName)) {
          serviceSelect.value = opt.value;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const customOpt = new Option(serviceName, serviceName, true, true);
        serviceSelect.add(customOpt);
      }
    }
    
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 600);
  });
});

// Gallery Lightbox
const galleryImages = Array.from(document.querySelectorAll(".gallery-item img"));
const lightbox = document.querySelector("#lightbox");

if (lightbox && galleryImages.length > 0) {
  const lightboxImage = lightbox.querySelector("img");
  const lightboxCaption = lightbox.querySelector(".lightbox-caption");
  let activeImage = 0;

  function showImage(index) {
    activeImage = (index + galleryImages.length) % galleryImages.length;
    const source = galleryImages[activeImage];
    lightboxImage.src = source.currentSrc || source.src;
    lightboxImage.alt = source.alt;
    const captionEl = source.closest(".gallery-item")?.querySelector("span");
    lightboxCaption.textContent = captionEl ? captionEl.textContent : "";
  }

  document.querySelectorAll("[data-lightbox]").forEach((button) => {
    button.addEventListener("click", () => {
      showImage(Number(button.dataset.lightbox));
      lightbox.showModal();
    });
  });

  const closeBtn = document.querySelector(".lightbox-close");
  const prevBtn = document.querySelector(".lightbox-prev");
  const nextBtn = document.querySelector(".lightbox-next");

  if (closeBtn) closeBtn.addEventListener("click", () => lightbox.close());
  if (prevBtn) prevBtn.addEventListener("click", () => showImage(activeImage - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => showImage(activeImage + 1));

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") showImage(activeImage + 1);
    if (event.key === "ArrowLeft") showImage(activeImage - 1);
  });
}


// --- Live Chat Widget (Связь с мастером) ---
const chatTrigger = document.querySelector("#chat-trigger");
const chatWindow = document.querySelector("#chat-window");
const chatCloseBtn = document.querySelector("#chat-close-btn");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatMessages = document.querySelector("#chat-messages");
const chatChips = document.querySelectorAll(".chat-chip");

function toggleChat(open) {
  if (!chatWindow) return;
  const shouldOpen = open !== undefined ? open : !chatWindow.classList.contains("is-open");
  chatWindow.classList.toggle("is-open", shouldOpen);
  chatWindow.setAttribute("aria-hidden", String(!shouldOpen));
  if (shouldOpen) {
    if (chatInput) chatInput.focus();
    scrollChatBottom();
  }
}

function scrollChatBottom() {
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessage(text, sender = "user", time = "сейчас") {
  if (!chatMessages) return;
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg msg-${sender}`;
  msgEl.innerHTML = `${escapeHtml(text)}<span class="chat-msg-time">${time}</span>`;
  chatMessages.appendChild(msgEl);
  scrollChatBottom();
}

if (chatTrigger) chatTrigger.addEventListener("click", () => toggleChat());
if (chatCloseBtn) chatCloseBtn.addEventListener("click", () => toggleChat(false));

// Smart knowledge base for instant expert answers
const QUICK_ANSWERS = {
  "Сколько длится сложное окрашивание?": {
    text: "Сложные техники (Airtouch, балаяж, микромелирование, шатуш) занимают от 3,5 до 6 часов в зависимости от длины и густоты волос. В стоимость (от 6 000 ₽) входит бережное осветление, уход для защиты связей волоса, тонирование и укладка.",
    buttons: [
      { text: "Выбрать время в DIKIDI ↗", url: "https://dikidi.net/56245" },
      { text: "Спросить в Telegram (@fabrik_salon_bot) ↗", url: "https://t.me/fabrik_salon_bot" }
    ]
  },
  "Как подготовиться к выходу из черного?": {
    text: "Выход из черного проводится бережно в 1–2 этапа через смывку с защитой дисульфидных связей (plex). Стоимость от 10 000 ₽. Рекомендуем начать с очной консультации мастера или тест-пряди (500 ₽), чтобы оценить качество волос.",
    buttons: [
      { text: "Записаться на консультацию в DIKIDI ↗", url: "https://dikidi.net/56245" },
      { text: "Написать мастеру в Telegram ↗", url: "https://t.me/fabrik_salon_bot" }
    ]
  },
  "Свободные окна на этой неделе": {
    text: "Актуальное расписание и свободные окна мастера в реальном времени всегда открыты в онлайн-записи DIKIDI. Вы можете моментально выбрать подходящий день и время:",
    buttons: [
      { text: "Смотреть свободные окна в DIKIDI ↗", url: "https://dikidi.net/56245" },
      { text: "Уточнить у мастера в Telegram ↗", url: "https://t.me/fabrik_salon_bot" }
    ]
  }
};

function appendRichMessage(text, buttons = [], sender = "admin") {
  if (!chatMessages) return;
  const nowTime = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg msg-${sender}`;
  
  let buttonsHtml = "";
  if (buttons && buttons.length > 0) {
    buttonsHtml = `<div class="chat-action-buttons">` +
      buttons.map(b => `<a class="chat-action-btn" href="${b.url}" target="_blank" rel="noopener noreferrer">${b.text}</a>`).join("") +
      `</div>`;
  }
  
  msgEl.innerHTML = `${escapeHtml(text)}${buttonsHtml}<span class="chat-msg-time">${nowTime}</span>`;
  chatMessages.appendChild(msgEl);
  scrollChatBottom();
}

chatChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const question = chip.dataset.question;
    if (!question) return;
    
    appendMessage(question, "user");
    
    setTimeout(() => {
      if (QUICK_ANSWERS[question]) {
        const ans = QUICK_ANSWERS[question];
        appendRichMessage(ans.text, ans.buttons);
      } else {
        appendRichMessage(
          "Вы можете задать этот вопрос мастеру напрямую в Telegram или выбрать услугу в DIKIDI:",
          [
            { text: "Открыть диалог в Telegram (@fabrik_salon_bot) ↗", url: "https://t.me/fabrik_salon_bot" },
            { text: "Онлайн-запись DIKIDI ↗", url: "https://dikidi.net/56245" }
          ]
        );
      }
    }, 400);
  });
});

let apiIsOnline = false;

if (chatForm && chatInput) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    
    chatInput.value = "";
    appendMessage(text, "user");

    // Copy to clipboard so client doesn't lose it
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore
    }

    const waUrl = `https://wa.me/79042747363?text=${encodeURIComponent(text)}`;

    // Send lead directly to Telegram via Netlify Functions or direct API
    const res = await sendLeadToTelegram({ text });

    if (res.success) {
      apiIsOnline = (res.method === "serverless");
      setTimeout(() => {
        appendRichMessage(
          "✅ Ваш вопрос успешно отправлен Юлии в Telegram! Мастер ответит вам в ближайшее время.",
          [
            { text: "Открыть диалог в Telegram (@fabrik_salon_bot) ↗", url: "https://t.me/fabrik_salon_bot" },
            { text: "Выбрать время в DIKIDI ↗", url: "https://dikidi.net/56245" }
          ]
        );
      }, 400);
    } else {
      // Offline / blocked fallback
      setTimeout(() => {
        appendRichMessage(
          "Вопрос скопирован в буфер! Чтобы мастер ответила как можно быстрее, отправьте его напрямую в мессенджер:",
          [
            { text: "💬 Отправить в Telegram (@fabrik_salon_bot) ↗", url: "https://t.me/fabrik_salon_bot" },
            { text: "📱 Отправить в WhatsApp (+7 904 274-73-63) ↗", url: waUrl },
            { text: "📅 Записаться онлайн в DIKIDI ↗", url: "https://dikidi.net/56245" }
          ]
        );
      }, 400);
    }
  });
}

// Poll for master replies while chat is open
setInterval(async () => {
  if (!chatWindow || !chatWindow.classList.contains("is-open")) return;
  try {
    const res = await fetch(`${API_BASE}/api/chat/messages?sessionId=${chatSessionId}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        const currentAdminMsgs = chatMessages.querySelectorAll(".msg-admin").length;
        const serverAdminMsgs = data.messages.filter(m => m.sender === "admin");
        if (serverAdminMsgs.length > currentAdminMsgs - 1) {
          const newMsgs = serverAdminMsgs.slice(currentAdminMsgs - 1);
          newMsgs.forEach(m => appendMessage(m.text, "admin", m.time));
        }
      }
    }
  } catch {
    // Soft ignore
  }
}, 2500);
