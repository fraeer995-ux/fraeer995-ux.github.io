const DISMISS_KEY = "cardetail-install-dismissed-until";
const SESSION_KEY = "cardetail-install-hint-seen";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function initInstall() {
  const footerButton = document.querySelector(".install-button");
  const hint = document.querySelector("#install-hint");
  const hintButton = hint.querySelector("[data-install]");
  const dialog = document.querySelector("#install-dialog");
  const steps = document.querySelector("#install-steps");
  const intro = document.querySelector("#install-intro");
  const displayMode = window.matchMedia("(display-mode: standalone)");
  const agent = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(agent);
  const isMobile = isIOS || /android.*mobile/i.test(agent) || navigator.userAgentData?.mobile === true;
  const isSafari = isIOS && /Version\/.+Safari/i.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(agent);

  function readStorage(key, session = false) {
    try { return window[session ? "sessionStorage" : "localStorage"].getItem(key); }
    catch { return null; }
  }

  function writeStorage(key, value, session = false) {
    try { window[session ? "sessionStorage" : "localStorage"].setItem(key, value); }
    catch { /* The current page still remembers dismissal when storage is blocked. */ }
  }

  let installed = displayMode.matches || navigator.standalone === true;
  let deferredPrompt = null;
  let ready = false;
  let busy = false;
  let dismissed = Number(readStorage(DISMISS_KEY)) > Date.now();
  const seenBefore = readStorage(SESSION_KEY, true) === "1";

  function refresh() {
    const standalone = installed || displayMode.matches || navigator.standalone === true;
    footerButton.hidden = standalone || !(deferredPrompt || isIOS || isAndroid);
    footerButton.disabled = busy;
    hintButton.disabled = busy;
    hintButton.textContent = deferredPrompt ? "Установить" : "Как добавить";
    const blocked = document.hidden || document.querySelector('dialog[open], .menu-toggle[aria-expanded="true"], body[data-privacy-pending="true"]');
    hint.hidden = standalone || !isMobile || !ready || dismissed || seenBefore || busy || blocked || !(deferredPrompt || isSafari);
    if (!hint.hidden) writeStorage(SESSION_KEY, "1", true);
    if (standalone && dialog.open) dialog.close();
  }

  function dismiss() {
    dismissed = true;
    writeStorage(DISMISS_KEY, String(Date.now() + THIRTY_DAYS));
    writeStorage(SESSION_KEY, "1", true);
    refresh();
  }

  function showInstructions() {
    intro.textContent = isIOS
      ? (isSafari ? "Сайт будет открываться с главного экрана, как приложение." : "Откройте этот сайт в Safari и добавьте его на главный экран.")
      : `Добавьте ${document.documentElement.dataset.companyName || 'сайт'} через меню браузера. Названия пунктов могут немного отличаться.`;
    const instructions = isIOS
      ? ["Нажмите «Поделиться» в меню Safari — значок квадрата со стрелкой вверх.", "Выберите «На экран Домой». Если пункта нет, прокрутите список действий.", "Оставьте «Открывать как веб-приложение» включённым, если такой переключатель есть, и нажмите «Добавить»."]
      : ["Откройте меню браузера — обычно это три точки рядом с адресной строкой.", "Выберите «Установить приложение» или «Добавить на главный экран».", "Подтвердите добавление. Если такого пункта нет, откройте сайт в Chrome."];
    steps.replaceChildren(...instructions.map(text => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    if (!dialog.open) dialog.showModal();
  }

  async function install() {
    if (busy || installed || displayMode.matches || navigator.standalone === true) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    dismiss();
    if (!prompt) {
      showInstructions();
      return;
    }
    busy = true;
    refresh();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") installed = true;
    } catch {
      showInstructions();
    } finally {
      busy = false;
      refresh();
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    if (installed || displayMode.matches || navigator.standalone === true) return;
    deferredPrompt = event;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    dismiss();
  });
  displayMode.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", refresh);
  // Pause the promotion while visitors use navigation or the booking form.
  new MutationObserver(refresh).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open", "aria-expanded", "data-privacy-pending"] });
  footerButton.addEventListener("click", install);
  hintButton.addEventListener("click", install);
  hint.querySelector("[data-dismiss-install]").addEventListener("click", dismiss);
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  window.setTimeout(() => { ready = true; refresh(); }, 8000);
  refresh();
}
