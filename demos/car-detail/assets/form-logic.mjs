const PHONE_CHARACTERS = /^[+\d\s().-]+$/;

export function validateRequest(fields = {}, allowedServiceIds) {
  const errors = {};
  const serviceId = typeof fields.serviceId === "string" ? fields.serviceId.trim() : "";
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const phone = typeof fields.phone === "string" ? fields.phone.trim() : "";
  const digits = phone.replace(/\D/g, "");
  const normalizedPhone = digits.replace(/^8(?=\d{10}$)/, "7");

  if (!serviceId || (Array.isArray(allowedServiceIds) && !allowedServiceIds.includes(serviceId))) {
    errors.serviceId = serviceId ? "Выберите услугу из списка." : "Выберите услугу.";
  }
  if (!name) errors.name = "Укажите имя.";
  if (!phone || !PHONE_CHARACTERS.test(phone) || !/^7\d{10}$/.test(normalizedPhone)) {
    errors.phone = "Укажите российский номер телефона в формате +7 (999) 123-45-67.";
  }
  if (fields.consent !== true) errors.consent = "Нужно согласие на обработку данных.";

  return { valid: Object.keys(errors).length === 0, errors };
}

function isSafeEndpoint(endpoint) {
  if (endpoint.startsWith("/") && !endpoint.startsWith("//")) return true;

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export async function submitRequest(endpoint, fields, fetchImpl = fetch) {
  const target = typeof endpoint === "string" ? endpoint.trim() : "";
  if (!target) return { ok: false, code: "not-configured", message: "Форма пока не подключена." };
  if (!isSafeEndpoint(target)) return { ok: false, code: "unsafe-endpoint", message: "Не удалось отправить заявку." };

  try {
    const response = await fetchImpl(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });

    return response.ok
      ? { ok: true, code: "sent", message: "Заявка отправлена." }
      : { ok: false, code: "delivery-failed", message: "Сервис не принял заявку. Попробуйте ещё раз." };
  } catch {
    return { ok: false, code: "network-error", message: "Нет связи. Проверьте интернет и повторите отправку." };
  }
}
