const KEY = "cardetail-privacy-v1";
const VERSION = "2026-10-21";
const TTL = 180 * 24 * 60 * 60 * 1000;

export function initPrivacy() {
  const notice = document.querySelector("#privacy-notice");
  const placeholder = document.querySelector("#map-placeholder");
  const embed = document.querySelector("#map-embed");
  const settings = document.querySelector("[data-privacy-settings]");
  const settingsDialog = document.querySelector("#privacy-dialog");
  const settingsPanel = settingsDialog.querySelector(".privacy-panel");
  const noticeHome = notice.parentElement;
  let opener;
  let memoryPreference = null;

  function readPreference() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      const age = Date.now() - value?.savedAt;
      if (value?.version === VERSION && typeof value.map === "boolean" && Number.isFinite(age) && age >= 0 && age < TTL) return value;
      localStorage.removeItem(KEY);
    } catch { return memoryPreference; }
    return null;
  }

  function renderMap(allowed) {
    const load = allowed && embed.dataset.mapConfigured === 'true' && Boolean(embed.dataset.mapSrc);
    placeholder.hidden = load;
    if (load && !embed.querySelector("iframe")) {
      const frame = document.createElement("iframe");
      frame.title = embed.dataset.mapTitle || 'Яндекс.Карта с расположением студии';
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer";
      frame.allowFullscreen = true;
      frame.src = embed.dataset.mapSrc;
      embed.append(frame);
    } else if (!load) {
      embed.replaceChildren();
    }
  }

  function showNotice(show, focus = false) {
    notice.hidden = !show;
    document.body.dataset.privacyPending = String(show);
    if (show && focus) document.querySelector("#privacy-title").focus({ preventScroll: true });
  }

  function sync() {
    const preference = readPreference();
    renderMap(preference?.map === true);
    showNotice(settingsDialog.open || !preference);
  }

  function openSettings(trigger = settings) {
    opener = trigger;
    settingsPanel.append(notice);
    showNotice(true);
    if (!settingsDialog.open) settingsDialog.showModal();
    document.body.classList.add("privacy-is-open");
    settingsPanel.scrollTop = 0;
    document.querySelector("#privacy-title").focus({ preventScroll: true });
  }

  document.querySelectorAll("[data-privacy-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const map = button.dataset.privacyChoice === "map";
      memoryPreference = { version: VERSION, map, savedAt: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(memoryPreference)); }
      catch { /* Keep the current choice in this page without persisting it. */ }
      renderMap(map);
      showNotice(false);
      if (settingsDialog.open) settingsDialog.close();
      if (location.hash === "#privacy-settings") history.replaceState(null, "", location.pathname + location.search);
      if (notice.contains(document.activeElement)) (opener || settings)?.focus({ preventScroll: true });
      if (placeholder.contains(document.activeElement) && map) {
        const link = document.querySelector(".location-open-map");
        link.focus({ preventScroll: true });
      }
      const status = document.querySelector("#map-privacy-status");
      status.textContent = map ? "" : "Карта отключена. Вы можете разрешить её загрузку в любой момент.";
    });
  });
  settings.addEventListener("click", () => openSettings());
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.hash !== "#privacy-settings") return;
    event.preventDefault();
    // Keep an underlying booking and its fields intact while opening settings.
    openSettings(document.querySelector("#booking-dialog").open ? document.querySelector(".consent-field a") : settings);
  });
  settingsDialog.querySelector(".privacy-close").addEventListener("click", () => settingsDialog.close());
  settingsDialog.addEventListener("click", event => { if (event.target === settingsDialog) settingsDialog.close(); });
  settingsDialog.addEventListener("close", () => {
    noticeHome.append(notice);
    document.body.classList.remove("privacy-is-open");
    showNotice(!readPreference());
    if (location.hash === "#privacy-settings") history.replaceState(null, "", location.pathname + location.search);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  window.addEventListener("hashchange", () => { if (location.hash === "#privacy-settings") openSettings(); });
  window.addEventListener("storage", event => { if (event.key === KEY || event.key === null) sync(); });
  // Recheck a long-lived page when the visitor returns, including expiry/revocation.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
  sync();
  if (location.hash === "#privacy-settings") openSettings();
  return sync;
}
