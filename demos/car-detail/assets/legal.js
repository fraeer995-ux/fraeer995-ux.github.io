import { loadCompany, applyCompany } from './company.mjs';

export function initLegal() {
  const dialog = document.querySelector("#legal-dialog");
  const panel = dialog.querySelector(".legal-panel");
  const title = dialog.querySelector("#legal-title");
  const version = dialog.querySelector("#legal-version");
  const body = dialog.querySelector("#legal-body");
  const legalRoot = new URL("./legal/", location.href);
  let opener;
  let request;

  async function openDocument(url, trigger) {
    if (!dialog.open) opener = trigger;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    title.textContent = trigger.textContent.trim();
    version.textContent = "";
    body.textContent = "Загружаем документ…";
    body.setAttribute("aria-busy", "true");
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("legal-is-open");
    panel.scrollTop = 0;
    title.focus({ preventScroll: true });
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error("Document unavailable");
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      applyCompany(doc, await loadCompany());
      const content = doc.querySelector(".legal-content");
      if (!content) throw new Error("Invalid document");
      if (controller.signal.aborted || !dialog.open) return;
      title.textContent = doc.querySelector("h1").textContent;
      version.textContent = doc.querySelector(".legal-version").textContent;
      const fragment = document.importNode(content, true);
      // Resolve document-relative links before moving them into the homepage.
      fragment.querySelectorAll("a[href]").forEach(link => {
        link.href = new URL(link.getAttribute("href"), response.url || url).href;
        if (link.hash === "#privacy-settings" && link.origin === location.origin) {
          link.addEventListener("click", () => dialog.close());
        }
      });
      body.replaceChildren(fragment);
      panel.scrollTop = 0;
      const target = url.hash && body.querySelector(`[id="${CSS.escape(url.hash.slice(1))}"]`);
      if (target) target.scrollIntoView({ block: "start" });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = document.createElement("p");
      message.textContent = "Не удалось загрузить документ. Откройте его по ссылке или повторите попытку.";
      const fallback = document.createElement("a");
      fallback.href = url.href;
      fallback.target = "_blank";
      fallback.rel = "noopener noreferrer";
      fallback.dataset.legalDirect = "true";
      fallback.textContent = "Открыть документ";
      body.replaceChildren(message, fallback);
    } finally {
      if (request === controller) body.removeAttribute("aria-busy");
    }
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("data-legal-direct") || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== legalRoot.origin || !url.pathname.startsWith(legalRoot.pathname) || !/\/(privacy|consent|cookies|terms|details)\.html$/.test(url.pathname)) return;
    event.preventDefault();
    openDocument(url, link);
  });
  dialog.querySelector(".legal-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".legal-done").addEventListener("click", () => dialog.close());
  let startedOnBackdrop = false;
  dialog.addEventListener("pointerdown", event => { startedOnBackdrop = event.target === dialog; });
  dialog.addEventListener("click", event => { if (event.target === dialog && startedOnBackdrop) dialog.close(); });
  dialog.addEventListener("close", () => {
    request?.abort();
    document.body.classList.remove("legal-is-open");
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
  });
}
