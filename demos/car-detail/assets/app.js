import { loadStudio } from "./studio-store.mjs";
import { api, visitorToken } from "./supabase-client.mjs";
import { createBooking } from "./booking.js";
import { initInstall } from "./install.js";
import { initPrivacy } from "./privacy.js";
import { initLegal } from "./legal.js";
import { applyCompany } from "./company.mjs";

const refreshPrivacy = initPrivacy();
initLegal();

initInstall();

const serviceExplorer = document.querySelector("#service-explorer");
const staticServices = document.querySelector("#static-services");
const serviceCategories = document.querySelector("#service-categories");
const serviceOptions = document.querySelector("#service-options");
const serviceOptionsViewport = document.querySelector("#service-options-viewport");
const serviceSelect = document.querySelector("#service-select");
const faqList = document.querySelector("#faq-list");
const form = document.querySelector("#request-form");
const formStatus = document.querySelector("#form-status");
const footerContact = document.querySelector("#footer-contact");
const bookingDialog = document.querySelector("#booking-dialog");
const galleryCarousel = document.querySelector(".gallery-carousel");
const galleryTrack = document.querySelector("#gallery-track");
const gallerySlides = [...galleryTrack.querySelectorAll("[data-gallery-slide]")];
const galleryCurrent = document.querySelector("#gallery-current");
const galleryPrevious = document.querySelector("#gallery-previous");
const galleryNext = document.querySelector("#gallery-next");
const serviceFeature = document.querySelector(".service-feature");
const serviceFeaturePhoto = document.querySelector("#service-feature-photo");
const serviceFeatureNumber = document.querySelector("#service-feature-number");
const serviceFeatureTitle = document.querySelector("#service-feature-title");
const serviceFeatureDescription = document.querySelector("#service-feature-description");
const serviceFeaturePrice = document.querySelector("#service-feature-price");
const serviceFeatureBooking = document.querySelector("#service-feature-booking");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let selectedServiceId = "";
let allServices = [];
let activeServiceCategory = "";
let serviceChangeTimeout = 0;
let serviceChangeVersion = 0;
let galleryUpdateFrame = 0;

function updateGalleryControls() {
  const trackLeft = galleryTrack.getBoundingClientRect().left;
  const currentIndex = gallerySlides.reduce((closestIndex, slide, index) => {
    const closestDistance = Math.abs(gallerySlides[closestIndex].getBoundingClientRect().left - trackLeft);
    const distance = Math.abs(slide.getBoundingClientRect().left - trackLeft);
    return distance < closestDistance ? index : closestIndex;
  }, 0);
  const maxScroll = galleryTrack.scrollWidth - galleryTrack.clientWidth;
  const hasPrevious = galleryTrack.scrollLeft > 2;
  const hasNext = galleryTrack.scrollLeft < maxScroll - 2;

  galleryCurrent.textContent = String(currentIndex + 1).padStart(2, "0");
  galleryPrevious.disabled = !hasPrevious;
  galleryNext.disabled = !hasNext;
  galleryCarousel.classList.toggle("has-previous", hasPrevious);
  galleryCarousel.classList.toggle("has-next", hasNext);
}

function scheduleGalleryUpdate() {
  if (galleryUpdateFrame) return;
  galleryUpdateFrame = requestAnimationFrame(() => {
    galleryUpdateFrame = 0;
    updateGalleryControls();
  });
}

function moveGallery(direction) {
  const slideWidth = gallerySlides[0].getBoundingClientRect().width;
  const gap = Number.parseFloat(getComputedStyle(galleryTrack).columnGap) || 0;
  galleryTrack.scrollBy({ left: direction * (slideWidth + gap), behavior: reducedMotion.matches ? "auto" : "smooth" });
}

galleryTrack.addEventListener("scroll", scheduleGalleryUpdate, { passive: true });
window.addEventListener("resize", scheduleGalleryUpdate, { passive: true });
galleryPrevious.addEventListener("click", () => moveGallery(-1));
galleryNext.addEventListener("click", () => moveGallery(1));
updateGalleryControls();

function updateServiceScrollCue() {
  const maxScroll = serviceOptions.scrollWidth - serviceOptions.clientWidth;
  const hasOverflow = maxScroll > 2;
  const hasMore = hasOverflow && serviceOptions.scrollLeft < maxScroll - 2;
  const hasPrevious = hasOverflow && serviceOptions.scrollLeft > 2;
  serviceOptionsViewport.classList.toggle("has-more-services", hasMore);
  serviceOptionsViewport.classList.toggle("has-previous-services", hasPrevious);
}

const make = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

function updateServiceDetails(service) {
  serviceFeaturePhoto.src = service.image;
  serviceFeaturePhoto.alt = service.alt;
  serviceFeatureNumber.textContent = service.number;
  serviceFeatureTitle.textContent = service.name;
  serviceFeatureDescription.textContent = service.description;
  serviceFeaturePrice.textContent = `от ${new Intl.NumberFormat("ru-RU").format(service.priceFrom)} ₽`;
}

function getServiceCategory(service) {
  return service.category || "Другое";
}

function renderServiceCategories(services) {
  const categories = [...new Set(services.map(getServiceCategory))];
  serviceCategories.replaceChildren(...categories.map((category) => {
    const button = make("button", "service-category");
    button.type = "button";
    button.dataset.serviceCategory = category;
    button.setAttribute("aria-pressed", "false");
    const label = make("span", "service-category-name", category);
    const count = services.filter((service) => getServiceCategory(service) === category).length;
    const total = make("span", "service-category-count", String(count).padStart(2, "0"));
    button.append(label, total);
    button.addEventListener("click", () => {
      const firstService = allServices.find((service) => getServiceCategory(service) === category);
      selectService(firstService);
    });
    return button;
  }));
}

function selectService(service) {
  if (!service) return;
  const category = getServiceCategory(service);
  if (activeServiceCategory !== category) {
    activeServiceCategory = category;
    serviceOptions.replaceChildren(...allServices
      .filter((item) => getServiceCategory(item) === category)
      .map(renderServiceOption));
    serviceOptions.scrollLeft = 0;
    requestAnimationFrame(updateServiceScrollCue);
    serviceCategories.querySelectorAll("[data-service-category]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.serviceCategory === category));
    });
  }
  const changed = selectedServiceId && selectedServiceId !== service.id;
  selectedServiceId = service.id;
  serviceSelect.value = service.id;
  serviceOptions.querySelectorAll("[data-service-id]").forEach((button) => {
    const isSelected = button.dataset.serviceId === service.id;
    button.setAttribute("aria-pressed", String(isSelected));
  });

  window.clearTimeout(serviceChangeTimeout);
  const version = ++serviceChangeVersion;
  if (!changed) {
    serviceFeature.classList.remove("is-changing");
    updateServiceDetails(service);
    return;
  }

  serviceFeature.classList.add("is-changing");
  const nextPhoto = new Image();
  nextPhoto.src = service.image;
  serviceChangeTimeout = window.setTimeout(() => {
    if (version !== serviceChangeVersion) return;
    let updated = false;
    const revealDetails = () => {
      if (updated || version !== serviceChangeVersion) return;
      updated = true;
      updateServiceDetails(service);
      requestAnimationFrame(() => {
        if (version === serviceChangeVersion) serviceFeature.classList.remove("is-changing");
      });
    };
    nextPhoto.addEventListener("load", revealDetails, { once: true });
    nextPhoto.addEventListener("error", revealDetails, { once: true });
    if (nextPhoto.complete) revealDetails();
  }, reducedMotion.matches ? 0 : 150);
}

function replacePublicServices(services) {
  const selectedId = selectedServiceId;
  allServices = services;
  renderServiceCategories(allServices);
  serviceSelect.replaceChildren(make("option", "", "Выберите услугу"));
  serviceSelect.options[0].value = "";
  for (const service of allServices) {
    const option = make("option", "", service.name);
    option.value = service.id;
    serviceSelect.append(option);
  }
  activeServiceCategory = "";
  const selected = allServices.find((service) => service.id === selectedId) || allServices[0];
  if (selected) selectService(selected);
}

serviceOptions.addEventListener("scroll", updateServiceScrollCue, { passive: true });
window.addEventListener("resize", updateServiceScrollCue, { passive: true });

function renderServiceOption(service) {
  const button = make("button", "service-option");
  button.type = "button";
  button.dataset.serviceId = service.id;
  button.setAttribute("aria-pressed", "false");
  const number = make("span", "service-option-number", service.number);
  const label = make("span", "service-option-label");
  const name = make("span", "service-option-name", service.name);
  const price = make("span", "service-option-price", `от ${new Intl.NumberFormat("ru-RU").format(service.priceFrom)} ₽`);
  label.append(name, price);
  const arrow = make("span", "service-option-arrow", "↗");
  arrow.setAttribute("aria-hidden", "true");
  button.append(number, label, arrow);
  button.addEventListener("click", () => selectService(service));
  return button;
}

function renderFaq(item, index) {
  const details = make("details", "faq-item reveal");
  const summary = make("summary", "faq-question");
  const number = make("span", "faq-number", String(index + 1).padStart(2, "0"));
  const question = make("span", "", item.question);
  const icon = make("span", "faq-icon", "+");
  icon.setAttribute("aria-hidden", "true");
  summary.append(number, question, icon);
  const answer = make("p", "faq-answer", item.answer);
  details.append(summary, answer);
  return details;
}

function addContactItem(label, value, href) {
  if (!value) return;
  const item = make(href ? "a" : "span", "footer-contact-item", `${label}: ${value}`);
  if (href) {
    item.href = href;
    if (href.startsWith("http")) {
      item.target = "_blank";
      item.rel = "noopener noreferrer";
    }
  }
  footerContact.append(item);
}

function observeReveals(root = document) {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    root.querySelectorAll(".reveal").forEach((node) => node.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, instance) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        instance.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
  root.querySelectorAll(".reveal:not(.is-visible)").forEach((node) => observer.observe(node));
}

const booking = createBooking({
  dialog: bookingDialog,
  form,
  getServices: () => allServices,
  selectService,
  setServices: replacePublicServices,
  api,
  visitorToken,
});
function openBooking(serviceId = "") { booking.open(serviceId); }
document.querySelectorAll("[data-open-booking]").forEach((trigger) => {
  trigger.addEventListener("click", () => openBooking());
});

async function boot() {
  document.querySelector("#year").textContent = String(new Date().getFullYear());
  try {
    const response = await fetch("./assets/content.json", { cache: "no-cache", credentials: "omit" });
    if (!response.ok) throw new Error("Content unavailable");
    const original = await response.json();
    const studio = await loadStudio();
    applyCompany(document, studio.company);
    refreshPrivacy();
    const content = { ...original, services: studio.services.filter((s) => s.visible !== false), contact: studio.contact, faq: studio.faq };
    if (!content.services.length) throw new Error("No public services are available.");
    for (const img of document.querySelectorAll("img[src]")) {
      const key = img.getAttribute("src");
      if (studio.images[key]) img.src = studio.images[key];
      if (studio.imageAlts?.[key]) img.alt = studio.imageAlts[key];
    }
    if (studio.site.heroTitle !== "Уход, который видно.") document.querySelector("#hero-title").textContent = studio.site.heroTitle;
    document.querySelector(".hero-lede").textContent = studio.site.heroDescription;

    allServices = content.services;
    renderServiceCategories(allServices);
    for (const service of content.services) {
      const option = make("option", "", service.name);
      option.value = service.id;
      serviceSelect.append(option);
    }
    selectService(content.services[0]);
    serviceSelect.addEventListener("change", () => {
      selectService(allServices.find((service) => service.id === serviceSelect.value));
    });
    serviceFeatureBooking.addEventListener("click", () => openBooking(selectedServiceId));
    faqList.replaceChildren(...content.faq.map(renderFaq));

    if (content.contact.phone) {
      const phoneDigits = content.contact.phone.replace(/[^+\d]/g, "");
      addContactItem("Позвонить", content.contact.phone, `tel:${phoneDigits}`);
    }
    addContactItem("Адрес", content.contact.location);
    addContactItem("График", content.contact.hours);
    addContactItem("Почта", content.contact.email, content.contact.email ? `mailto:${content.contact.email}` : undefined);

    if (staticServices) staticServices.hidden = true;
    observeReveals();
  } catch {
    if (staticServices) staticServices.hidden = false;
    else serviceExplorer.append(make("p", "content-error", "Не удалось загрузить услуги. Обновите страницу."));
    formStatus.textContent = "Форма временно недоступна.";
    observeReveals();
  }
}

const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector("#primary-nav");
menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  primaryNav.classList.toggle("is-open", open);
});
primaryNav.addEventListener("click", (event) => {
  if (event.target.closest("a, button[data-open-booking]")) {
    primaryNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Открыть меню");
  }
});

const header = document.querySelector("[data-header]");
const scrollProgress = document.querySelector("[data-scroll-progress]");
const syncScrollState = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight)) : 0;
  scrollProgress?.style.setProperty("--scroll-progress", String(progress));
};
window.addEventListener("scroll", syncScrollState, { passive: true });
window.addEventListener("resize", syncScrollState, { passive: true });
syncScrollState();

if ("serviceWorker" in navigator && window.isSecureContext) {
  const registerWorker = () => navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (document.readyState === "complete") registerWorker();
  else window.addEventListener("load", registerWorker, { once: true });
}

boot();
