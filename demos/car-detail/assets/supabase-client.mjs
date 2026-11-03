// Portfolio demo. Keep only appointment metadata in memory for the current page.
import { createInitialState, createRequest } from './studio-domain.mjs';

let statePromise;
const bookings = [];
const receipts = new Map();

const getState = () => statePromise ??= fetch(new URL('./content.json', import.meta.url))
  .then(response => {
    if (!response.ok) throw new Error('Не удалось загрузить услуги.');
    return response.json();
  })
  .then(content => createInitialState(content));

export const visitorToken = () => 'local-demo';

export async function api(action, payload = {}) {
  const state = await getState();
  switch (action) {
    case 'public-state':
      return structuredClone({ ...state, bookings, myBookings: bookings });
    case 'book': {
      const key = payload.idempotencyKey;
      if (!receipts.has(key)) {
        const isolatedState = { ...state, bookings: [...bookings], activity: [] };
        const { id, number, date, time, serviceId, serviceName, status } = createRequest(
          isolatedState, { ...payload, name: 'Демо', phone: '+7 900 000-00-00', note: '', vehicle: '' }
        );
        const booking = { id, number, date, time, serviceId, serviceName, status };
        bookings.push(booking);
        receipts.set(key, booking);
      }
      return { booking: structuredClone(receipts.get(key)) };
    }
    case 'booking-result':
      return { booking: structuredClone(receipts.get(payload.idempotencyKey) || null) };
    case 'cancel': {
      const index = bookings.findIndex(booking => booking.id === payload.id);
      if (index !== -1) bookings.splice(index, 1);
      return { ok: true };
    }
    default:
      throw new Error('Действие недоступно в демо.');
  }
}
