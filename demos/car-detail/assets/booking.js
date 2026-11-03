import { validateRequest } from "./form-logic.mjs";
import { bookingRange, canBook as baseCanBook, dateFromKey, dateKey, studioDateKey, slotsForDate as baseSlots } from "./booking-logic.mjs";
import { STATUS } from "./studio-store.mjs";
import { createSingleFlight } from "./single-flight.mjs";

const formatDate = (key, options = { day: "numeric", month: "long" }) =>
  new Intl.DateTimeFormat("ru-RU", options).format(dateFromKey(key));
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const newIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const IDEMPOTENCY_STORAGE_KEY = "cardetail-pending-book-idempotency-v1";
const PENDING_PREFIX = `${IDEMPOTENCY_STORAGE_KEY}:`;
const PENDING_TTL = 90 * 86400000;

function readPendingIdempotencyKey() {
  try {
    const key = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY) || "";
    if (UUID.test(key)) return key;
    sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
  } catch { /* Storage is optional. */ }
  try {
    const pending = [];
    for (const name of Object.keys(localStorage)) {
      if (!name.startsWith(PENDING_PREFIX)) continue;
      const key = name.slice(PENDING_PREFIX.length);
      const created = Number(localStorage.getItem(name));
      const age = Date.now() - created;
      if (!UUID.test(key) || !Number.isFinite(age) || age < 0 || age >= PENDING_TTL) localStorage.removeItem(name);
      else pending.push({ key, created });
    }
    return pending.sort((a, b) => a.created - b.created)[0]?.key || "";
  } catch { return ""; }
}

function storePendingIdempotencyKey(key, completedKey = "") {
  try {
    if (key) sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, key);
    else if (sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY) === completedKey) sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
  } catch { /* The in-memory key still protects retries until this page closes. */ }
  try {
    // Separate keys avoid overwriting another tab's unresolved operation.
    // This journal contains UUIDs and timestamps, never contact fields.
    if (key) localStorage.setItem(PENDING_PREFIX + key, String(Date.now()));
    else if (completedKey) localStorage.removeItem(PENDING_PREFIX + completedKey);
  } catch { /* Session storage remains a fallback when available. */ }
}

export function createIdempotentSubmitter({ api, getVisitorToken, makeKey = newIdempotencyKey }) {
  let previousSignature = "";
  let previousKey = "";
  let restoredKey = readPendingIdempotencyKey();
  const submit = async (fields) => {
    const signature = JSON.stringify(fields);
    const shouldRecover = Boolean(restoredKey || (previousKey && signature !== previousSignature));
    if (!previousKey) {
      previousKey = restoredKey || readPendingIdempotencyKey() || makeKey();
      restoredKey = "";
      storePendingIdempotencyKey(previousKey);
    }
    const token = typeof getVisitorToken === "function" ? await getVisitorToken() : getVisitorToken;
    const key = previousKey;
    const recover = async () => {
      const result = await api("booking-result", { visitorToken: token, idempotencyKey: key });
      return result?.booking ? { ...result, recovered: true } : null;
    };
    if (shouldRecover) {
      const recovered = await recover();
      if (recovered) return recovered;
    }
    previousSignature = signature;
    try {
      // Keep one operation key across ambiguous failures, including changed
      // fields: a concurrent earlier attempt can then never create a duplicate.
      return await api("book", { ...fields, visitorToken: token, idempotencyKey: key });
    } catch (error) {
      if (error?.code === "idempotency_mismatch") {
        const recovered = await recover();
        if (recovered) return recovered;
      }
      throw error;
    }
  };
  submit.reset = () => {
    storePendingIdempotencyKey("", previousKey || restoredKey);
    previousSignature = "";
    previousKey = "";
    restoredKey = "";
  };
  submit.hasPending = () => Boolean(previousKey || restoredKey);
  return submit;
}

export function createBooking({ dialog, form, getServices, selectService, setServices = () => {}, api, visitorToken }) {
  const find = (selector) => dialog.querySelector(selector);
  const panel = find(".booking-panel");
  const title = find("#booking-title");
  const copy = find("#booking-copy");
  const schedule = find("#booking-schedule");
  const contacts = find("#booking-contacts");
  const success = find("#booking-success");
  const days = find("#calendar-days");
  const times = find("#time-slots");
  const continueButton = find("#booking-continue");
  const submitButton = form.querySelector("[type=submit]");
  const status = find("#form-status");
  const scheduleError = find("#schedule-error");
  const reservationList = find("#booking-reservations");
  const slotsTitle = find("#slots-title");
  const slotsForDate = (key, reservations, now = new Date()) => baseSlots(key, reservations, now, scheduleSettings);
  const canBook = (key, time, reservations, now = new Date()) => baseCanBook(key, time, reservations, now, scheduleSettings);
  let scheduleSettings = null;
  let reservations = [];
  let myBookings = [];
  let availabilityStatus = "idle";
  let selectedDate = "";
  let selectedTime = "";
  let month;
  let step = 0;
  let opener;
  let refreshVersion = 0;
  let openVersion = 0;
  let pollTimer = 0;
  let submitInProgress = false;
  let resumeOnOpen = false;
  const lockedControls = new Map();

  const submitWithIdempotency = createIdempotentSubmitter({ api, getVisitorToken: visitorToken });

  function visitor() {
    return typeof visitorToken === "function" ? visitorToken() : visitorToken;
  }

  function clearErrors(errors = {}) {
    form.querySelectorAll("[data-error]").forEach((node) => { node.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    for (const [name, message] of Object.entries(errors)) {
      const error = form.querySelector(`[data-error="${name}"]`);
      const field = form.elements.namedItem(name);
      if (error) error.textContent = message;
      field?.setAttribute("aria-invalid", "true");
    }
    status.textContent = "";
  }

  function service() {
    return getServices().find((item) => item.id === form.elements.serviceId.value);
  }

  function lockSubmission(locked) {
    if (locked) {
      for (const control of form.elements) {
        if (!lockedControls.has(control)) lockedControls.set(control, control.disabled);
        control.disabled = true;
      }
    } else {
      for (const [control, disabled] of lockedControls) if (control.isConnected) control.disabled = disabled;
      lockedControls.clear();
    }
  }

  function setStep(next, focus = true) {
    step = next;
    schedule.hidden = next !== 0;
    contacts.hidden = next !== 1;
    form.hidden = next === 2;
    success.hidden = next !== 2;
    reservationList.hidden = next === 2 || !myBookings.length;
    const headings = ["Выберите время для автомобиля", "Осталось познакомиться", "Демо пройдено"];
    const descriptions = [
      "Выберите время приёма автомобиля. Это демо: реальной записи и звонка не будет.",
      "Введите вымышленные контакты, чтобы пройти демонстрацию.",
      `Тестовая запись создана на этой странице. Реальный визит не забронирован.`,
    ];
    title.textContent = headings[next];
    copy.textContent = descriptions[next];
    find(".booking-icon").hidden = next === 2;
    find(".booking-steps").querySelectorAll("li").forEach((node, index) => {
      node.classList.toggle("is-complete", index < next);
      if (index === next) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
    });
    if (focus) {
      panel.scrollTop = 0;
      title.focus({ preventScroll: true });
    }
  }

  function renderReservations() {
    reservationList.replaceChildren();
    const mine = myBookings.filter((booking) => booking.date >= studioDateKey());
    reservationList.hidden = step === 2 || mine.length === 0;
    if (!mine.length) return;
    reservationList.append(element("p", "booking-reservations-title", "Ваши записи"));
    mine.forEach((item) => {
      const row = element("div", "booking-reservation");
      const details = element("div");
      details.append(element("strong", "", `${formatDate(item.date)} · ${item.time}`));
      details.append(element("span", "", item.serviceName || getServices().find((entry) => entry.id === item.serviceId)?.name || "Визит в студию"));
      if (item.status) details.append(element("span", "booking-reservation-status", STATUS[item.status] || item.status));
      const cancel = element("button", "booking-cancel", "Отменить");
      cancel.type = "button";
      cancel.setAttribute("aria-label", `Отменить запись ${formatDate(item.date)} в ${item.time}`);
      cancel.addEventListener("click", async () => {
        cancel.disabled = true;
        scheduleError.textContent = "";
        try {
          await api("cancel", { id: item.id, visitorToken: await visitor() });
          await refreshAvailability();
          scheduleError.textContent = "Запись отменена. Окно снова свободно.";
          title.focus({ preventScroll: true });
        } catch (error) {
          scheduleError.textContent = error?.message || "Не удалось отменить запись. Попробуйте ещё раз.";
          cancel.disabled = false;
        }
      });
      row.append(details);
      if (!item.status || !["cancelled", "noshow", "completed"].includes(item.status)) row.append(cancel);
      reservationList.append(row);
    });
  }

  function renderCalendar() {
    const { first, last } = bookingRange();
    find("#calendar-month").textContent = month
      ? new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(month)
      : "";
    find("#calendar-prev").disabled = availabilityStatus !== "ready" || !month || month <= new Date(first.getFullYear(), first.getMonth(), 1, 12);
    find("#calendar-next").disabled = availabilityStatus !== "ready" || !month || month >= new Date(last.getFullYear(), last.getMonth(), 1, 12);
    days.replaceChildren();
    if (!month) return;
    const offset = (month.getDay() + 6) % 7;
    const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let index = 0; index < 42; index++) {
      const day = index - offset + 1;
      if (day < 1 || day > length) {
        days.append(element("span", "calendar-blank"));
        continue;
      }
      const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
      const key = dateKey(date);
      const slots = slotsForDate(key, reservations);
      const available = slots.filter((slot) => slot.available).length;
      const button = element("button", "calendar-day", String(day));
      button.type = "button";
      button.disabled = availabilityStatus !== "ready" || date < first || date > last || !slots.length;
      button.classList.toggle("has-slots", available > 0);
      button.setAttribute("aria-pressed", String(key === selectedDate));
      button.setAttribute("aria-label", `${formatDate(key, { weekday: "long", day: "numeric", month: "long" })}${date.getDay() === 0 ? ", выходной" : available ? `, свободных окон: ${available}` : ", нет свободных окон"}`);
      button.dataset.date = key;
      button.addEventListener("click", async () => {
        if (submitInProgress) return;
        selectedDate = key;
        selectedTime = "";
        scheduleError.textContent = "";
        render();
        await refreshAvailability();
        days.querySelector(`[data-date="${key}"]`)?.focus({ preventScroll: true });
      });
      days.append(button);
    }
  }

  function renderTimes() {
    if (!selectedDate || !dateFromKey(selectedDate)) {
      slotsTitle.textContent = "";
      times.replaceChildren(element("p", "slots-empty", "Обновляем расписание…"));
      continueButton.disabled = true;
      return;
    }
    slotsTitle.textContent = formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long" });
    times.replaceChildren();
    if (availabilityStatus === "loading" || availabilityStatus === "idle") {
      times.append(element("p", "slots-empty", "Обновляем расписание…"));
      continueButton.disabled = true;
      return;
    }
    if (availabilityStatus === "error") {
      times.append(element("p", "slots-empty", "Не удалось загрузить расписание. Попробуйте обновить."));
      const retry = element("button", "booking-retry", "Повторить загрузку расписания");
      retry.type = "button";
      retry.addEventListener("click", () => { void refreshAvailability(); });
      times.append(retry);
      continueButton.disabled = true;
      return;
    }
    const slots = slotsForDate(selectedDate, reservations);
    for (const slot of slots) {
      const button = element("button", "time-slot");
      button.type = "button";
      button.disabled = !slot.available;
      button.dataset.time = slot.time;
      button.setAttribute("aria-pressed", String(slot.time === selectedTime));
      button.setAttribute("aria-label", `${slot.time}, ${slot.available ? "свободно" : "занято"}`);
      button.append(element("strong", "", slot.time), element("span", "", slot.available ? "Свободно" : "Занято"));
      button.addEventListener("click", () => {
        if (submitInProgress) return;
        selectedTime = slot.time;
        scheduleError.textContent = "";
        renderTimes();
        times.querySelector(`[data-time="${slot.time}"]`)?.focus({ preventScroll: true });
      });
      times.append(button);
    }
    if (!slots.some((slot) => slot.available)) times.append(element("p", "slots-empty", "На эту дату свободных окон нет. Выберите другой день."));
    continueButton.disabled = !selectedTime || !service() || !canBook(selectedDate, selectedTime, reservations);
    find("#booking-selection").textContent = selectedTime
      ? `${formatDate(selectedDate)} · ${selectedTime} — ваше окно`
      : "Выберите свободное время";
  }

  function render() {
    if (selectedTime && step === 0 && availabilityStatus === "ready" && !canBook(selectedDate, selectedTime, reservations)) selectedTime = "";
    renderCalendar();
    renderTimes();
    renderReservations();
    if (submitInProgress) lockSubmission(true);
  }

  function showRecap(target, booking = null) {
    const date = booking?.date || selectedDate;
    const time = booking?.time || selectedTime;
    target.replaceChildren();
    target.append(element("p", "booking-section-label", "ВАШ ВИЗИТ"));
    target.append(element("strong", "booking-recap-date", `${formatDate(date, { day: "numeric", month: "long", year: "numeric" })} · ${time}`));
    target.append(element("span", "booking-recap-service", booking?.serviceName || getServices().find(item => item.id === booking?.serviceId)?.name || service()?.name || ""));
    const vehicle = booking ? booking.vehicle || "" : form.elements.vehicle.value.trim();
    if (vehicle) target.append(element("span", "booking-recap-vehicle", vehicle));
  }

  const refreshAvailabilityRequest = createSingleFlight(async () => {
    const version = ++refreshVersion;
    availabilityStatus = "loading";
    render();
    try {
      const snapshot = await api("public-state", { visitorToken: await visitor() });
      if (version !== refreshVersion) return false;
      const chosenServiceId = form.elements.serviceId.value;
      const hasServices = Array.isArray(snapshot?.services);
      if (hasServices) {
        setServices(snapshot.services);
        if (chosenServiceId && !snapshot.services.some((item) => item.id === chosenServiceId)) {
          form.elements.serviceId.value = "";
          selectedTime = "";
          if (step === 1) setStep(0);
          status.textContent = "";
          scheduleError.textContent = "Выбранная услуга больше недоступна. Выберите другую услугу и время.";
        }
      }
      scheduleSettings = snapshot?.settings || null;
      reservations = [
        ...(snapshot?.bookings || []).filter((booking) => !["cancelled", "noshow", "completed"].includes(booking.status)).map(({ date, time, serviceId }) => ({ date, time, serviceId })),
        ...(snapshot?.blocks || []).map(({ date, time }) => ({ date, time, serviceId: "blocked" })),
      ];
      myBookings = Array.isArray(snapshot?.myBookings) ? snapshot.myBookings : [];
      availabilityStatus = "ready";
      if (!hasServices || snapshot.services.some((item) => item.id === chosenServiceId) || !chosenServiceId) {
        scheduleError.textContent = "";
      }
      render();
      return true;
    } catch (error) {
      if (version !== refreshVersion) return false;
      availabilityStatus = "error";
      scheduleError.textContent = error?.message || "Не удалось загрузить расписание. Попробуйте ещё раз.";
      render();
      return false;
    }
  });

  function refreshAvailability() {
    return refreshAvailabilityRequest();
  }

  function selectFirstAvailableDate() {
    const { first } = bookingRange();
    selectedDate = dateKey(first);
    for (let offset = 0; offset < 60; offset++) {
      const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + offset, 12);
      if (slotsForDate(dateKey(date), reservations).some((slot) => slot.available)) {
        selectedDate = dateKey(date);
        break;
      }
    }
    const selected = dateFromKey(selectedDate);
    month = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  }

  async function checkSelection() {
    await refreshAvailability();
    if (availabilityStatus === "ready" && service() && canBook(selectedDate, selectedTime, reservations)) return true;
    selectedTime = "";
    setStep(0);
    render();
    if (availabilityStatus !== "error") scheduleError.textContent = "Выберите свободное окно и услугу. Доступность могла измениться.";
    return false;
  }

  continueButton.addEventListener("click", async () => {
    if (submitInProgress) return;
    continueButton.disabled = true;
    if (!await checkSelection()) return;
    showRecap(find("#booking-recap"));
    clearErrors();
    setStep(1);
  });
  find("#booking-back").addEventListener("click", () => { if (!submitInProgress) { setStep(0); render(); } });
  form.elements.serviceId.addEventListener("change", () => { if (!submitInProgress) { selectedTime = ""; renderTimes(); } });
  for (const [selector, direction] of [["#calendar-prev", -1], ["#calendar-next", 1]]) {
    find(selector).addEventListener("click", async () => {
      if (submitInProgress) return;
      month = new Date(month.getFullYear(), month.getMonth() + direction, 1, 12);
      const { first, last } = bookingRange();
      for (let day = 1; day <= 31; day++) {
        const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
        if (date.getMonth() !== month.getMonth()) break;
        if (date >= first && date <= last && date.getDay() !== 0) {
          selectedDate = dateKey(date);
          break;
        }
      }
      selectedTime = "";
      scheduleError.textContent = "";
      render();
      await refreshAvailability();
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (step !== 1 || submitInProgress) return;
    submitInProgress = true;
    let submittedServiceId = "";
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    try {
      const values = new FormData(form);
      const fields = {
        serviceId: String(values.get("serviceId") || ""),
        name: String(values.get("name") || "").trim(),
        phone: String(values.get("phone") || "").trim(),
        consent: values.get("consent") === "on",
      };
      submittedServiceId = fields.serviceId;
      const validation = validateRequest(fields, getServices().map((item) => item.id));
      clearErrors(validation.errors);
      if (!validation.valid) {
        form.querySelector("[aria-invalid='true']")?.focus();
        status.textContent = "Проверьте отмеченные поля.";
        return;
      }
      const payload = {
        ...fields,
        date: selectedDate,
        time: selectedTime,
        vehicle: String(values.get("vehicle") || "").trim(),
        note: String(values.get("note") || "").trim(),
      };
      lockSubmission(true);
      const result = await submitWithIdempotency(payload);
      const booking = result?.booking;
      if (!booking) throw new Error("Сервер не подтвердил создание заявки. Повторите попытку.");
      showRecap(find("#booking-ticket"), result.recovered ? booking : { ...payload, ...booking });
      find("#booking-success-greeting").textContent = result.recovered
        ? "Тестовая запись уже создана."
        : `Готово! Вы прошли демонстрацию записи.`;
      setStep(2, dialog.open);
      resumeOnOpen = !dialog.open;
      submitWithIdempotency.reset();
      await refreshAvailability();
    } catch (error) {
      if (["invalid", "unavailable"].includes(error?.code)) {
        await refreshAvailability();
        if (!getServices().some((item) => item.id === submittedServiceId)) return;
      }
      if (["slot_taken", "conflict"].includes(error?.code)) {
        // A prior timed-out attempt may still commit on its original slot.
        // Keep the operation key even if this changed selection is rejected.
        selectedTime = "";
        setStep(0);
        await refreshAvailability();
        scheduleError.textContent = error.code === "slot_taken"
          ? "Это окно уже заняли. Расписание обновлено — выберите другое время."
          : "Данные расписания изменились. Обновите выбор и попробуйте ещё раз.";
      } else if (error?.code === "idempotency_mismatch") {
        status.textContent = "Не удалось восстановить результат предыдущей отправки. Проверьте свои записи или свяжитесь со студией.";
      } else {
        status.textContent = error?.message
          ? `${error.message} Если ответ потерялся, отправка уже подготовлена к безопасному повтору.`
          : "Не удалось получить ответ. Заявка могла сохраниться; повторите отправку для безопасной проверки.";
      }
    } finally {
      submitInProgress = false;
      lockSubmission(false);
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  });

  form.addEventListener("input", () => { status.textContent = ""; });
  form.addEventListener("change", () => { status.textContent = ""; });

  find(".booking-close").addEventListener("click", () => dialog.close());
  find("#booking-done").addEventListener("click", () => dialog.close());
  find("#booking-another").addEventListener("click", () => open());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    if (submitInProgress || submitWithIdempotency.hasPending()) resumeOnOpen = true;
    openVersion++;
    refreshVersion++;
    refreshAvailabilityRequest.reset();
    window.clearInterval(pollTimer);
    pollTimer = 0;
    document.body.classList.remove("booking-is-open");
    opener?.focus({ preventScroll: true });
  });

  window.addEventListener("focus", () => { if (dialog.open) refreshAvailability(); });
  document.addEventListener("visibilitychange", () => {
    if (dialog.open && document.visibilityState === "visible") refreshAvailability();
  });

  function open(serviceId = "") {
    if (submitInProgress || resumeOnOpen) {
      // Resume the same operation after closing its dialog; opening a new
      // selection while its outcome is unknown would discard retry context.
      resumeOnOpen = false;
      if (!dialog.open) { opener = document.activeElement; dialog.showModal(); }
      document.body.classList.add("booking-is-open");
      panel.scrollTop = 0;
      title.focus({ preventScroll: true });
      startAvailabilityPolling();
      void refreshAvailability();
      return;
    }
    if (serviceId) selectService(getServices().find((item) => item.id === serviceId));
    if (!dialog.open) opener = document.activeElement;
    const version = ++openVersion;
    selectedTime = "";
    selectedDate = dateKey(bookingRange().first);
    month = new Date(dateFromKey(selectedDate).getFullYear(), dateFromKey(selectedDate).getMonth(), 1, 12);
    for (const name of ["vehicle", "name", "phone", "note"]) form.elements[name].value = "";
    form.elements.consent.checked = false;
    clearErrors();
    scheduleError.textContent = "";
    setStep(0, false);
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("booking-is-open");
    panel.scrollTop = 0;
    title.focus({ preventScroll: true });
    startAvailabilityPolling();
    void refreshAvailability().then((ok) => {
      if (ok && dialog.open && version === openVersion) {
        selectFirstAvailableDate();
        render();
      }
    });
  }

  function startAvailabilityPolling() {
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => { if (dialog.open) refreshAvailability(); }, 20000);
  }

  return { open, refresh: refreshAvailability };
}
