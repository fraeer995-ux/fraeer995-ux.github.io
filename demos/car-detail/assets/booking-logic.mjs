export const TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00"];

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return dateKey(date) === key ? date : null;
}

export function studioDateKey(date = new Date(), timeZone = "Europe/Moscow") {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysToKey(key, amount) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function bookingRange(now = new Date(), timeZone = "Europe/Moscow") {
  const today = studioDateKey(now, timeZone);
  const first = dateFromKey(addDaysToKey(today, 1));
  const last = dateFromKey(addDaysToKey(today, 60));
  return { first, last };
}

export function slotsForDate(key, reservations = [], now = new Date(), settings = null) {
  const date = dateFromKey(key);
  const { first, last } = bookingRange(now);
  if (!date || date < first || date > last || (settings?.closedDays || [0]).includes(date.getDay())) return [];
  return (settings?.times || TIMES).map((time) => ({
    time,
    available: time >= (settings?.businessOpen || "09:00")
      && (date.getDay() === 6
        ? time <= (settings?.saturdayLast || "13:00") && time <= (settings?.saturdayClose || "15:00")
        : time < (settings?.businessClose || "19:00"))
      && !reservations.some((item) => item.date === key && item.time === time),
  }));
}

export function canBook(date, time, reservations = [], now = new Date(), settings = null) {
  return slotsForDate(date, reservations, now, settings).some((slot) => slot.time === time && slot.available);
}

export function readReservations(raw, now = new Date()) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const { first, last } = bookingRange(now);
    const seen = new Set();
    return parsed.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const date = dateFromKey(item.date);
      const key = `${item.date}/${item.time}`;
      if (!date || date < first || date > last || !TIMES.includes(item.time)
        || typeof item.serviceId !== "string" || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(({ date, time, serviceId }) => ({ date, time, serviceId }));
  } catch {
    return [];
  }
}
