import { demoApi } from './demo'
import type { QueryClient } from '@tanstack/react-query'
import type { Appointment } from './types'
let clientCsrf = "",
  adminCsrf = "";
export function setCsrf(value: string, admin = false) {
  if (admin) adminCsrf = value;
  else clientCsrf = value;
}
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  key?: string,
): Promise<T> {
  return demoApi<T>(path, options, key);
  /* Original server transport retained for reference.
  const admin = path.startsWith("/admin");
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": admin ? adminCsrf : clientCsrf,
        ...(key ? { "Idempotency-Key": key } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "network",
      "Не удалось подключиться. Проверьте соединение и повторите — выбранные данные сохранены.",
      0,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "server",
      "Сервер недоступен. Попробуйте ещё раз.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.error?.code || "unknown",
      data.error?.message || "Не удалось выполнить действие.",
      response.status,
    );
  return data; */
}
export const post = (body: unknown = {}) => ({
  method: "POST",
  body: JSON.stringify(body),
});
export const put = (body: unknown) => ({
  method: "PUT",
  body: JSON.stringify(body),
});
export const money = (price: string) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(price));
export const dayKey = (d: Date, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export const dateLabel = (s: string, timezone: string, short = false) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(s) ? "UTC" : timezone,
    day: "numeric",
    month: short ? "short" : "long",
    ...(!short ? { weekday: "long" as const } : {}),
  }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00Z" : s));
export const timeLabel = (s: string, timezone: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s));
export const statuses: Record<string, string> = {
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  completed: "Завершена",
  no_show: "Неявка",
};


