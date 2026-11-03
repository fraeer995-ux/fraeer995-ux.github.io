export const STORE_KEY = 'cardetail-studio-v1';
export const STATUS = {
  pending: 'Ожидает звонка',
  callback: 'Перезвонить',
  confirmed: 'Подтверждена',
  arrived: 'Автомобиль принят',
  completed: 'Завершена',
  cancelled: 'Отменена',
  noshow: 'Не приехал',
};
export const ROLES = { owner: 'Владелец', admin: 'Администратор', manager: 'Менеджер' };
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const normalizePhone = (p) =>
  String(p)
    .replace(/\D/g, '')
    .replace(/^8(?=\d{10}$)/, '7');
export const uid = () =>
  globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function callbackDeadline(s, createdAt) {
  const date = new Date(createdAt);
  let remaining = s.settings.callbackHours * 3600000;
  for (let attempts = 0; attempts < 370; attempts++) {
    const day = date.getDay();
    const open = new Date(date);
    const close = new Date(date);
    const [oh, om] = (s.settings.businessOpen || '09:00').split(':').map(Number);
    const [ch, cm] = (
      day === 6 ? s.settings.saturdayClose || '15:00' : s.settings.businessClose || '19:00'
    )
      .split(':')
      .map(Number);
    open.setHours(oh, om, 0, 0);
    close.setHours(ch, cm, 0, 0);
    if (!s.settings.closedDays.includes(day) && close > open) {
      if (date < open) date.setTime(open.getTime());
      const available = Math.max(0, close - date);
      if (available >= remaining) return new Date(date.getTime() + remaining);
      remaining -= available;
    }
    date.setDate(date.getDate() + 1);
    date.setHours(0, 0, 0, 0);
  }
  return date;
}
export const activeRequest = (b) => !['cancelled', 'noshow', 'completed'].includes(b.status);
export function calendarTimes(s, dates) {
  return [
    ...new Set([
      ...s.settings.times,
      ...s.bookings.filter((b) => activeRequest(b) && dates.includes(b.date)).map((b) => b.time),
    ]),
  ].sort();
}
export const customerHistory = (s, p) =>
  s.bookings
    .filter((b) => normalizePhone(b.phone) === normalizePhone(p))
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
export const isOccupied = (s, date, time, except = '') =>
  s.blocks.some((b) => b.date === date && b.time === time) ||
  s.bookings.some((b) => b.id !== except && activeRequest(b) && b.date === date && b.time === time);
export function addActivity(
  s,
  actor,
  action,
  target,
  before = null,
  after = null,
  now = new Date(),
) {
  s.activity.unshift({
    id: uid(),
    actor,
    action,
    target,
    at: now.toISOString(),
    before: before ? structuredClone(before) : null,
    after: after ? structuredClone(after) : null,
  });
}
export function renameCategory(s, old, next) {
  next = next.trim();
  if (!next) throw new Error('Укажите название категории.');
  if (next !== old && s.categories.includes(next))
    throw new Error('Категория с таким названием уже существует.');
  s.categories = s.categories.map((c) => (c === old ? next : c));
  s.services.forEach((v) => {
    if (v.category === old) v.category = next;
  });
}
function validateArrival(s, b, except = '') {
  const d = new Date(`${b.date}T12:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
    Number.isNaN(d.valueOf()) ||
    localDate(d) !== b.date ||
    !/^\d{2}:\d{2}$/.test(b.time)
  )
    throw new Error('Выберите дату и время приёма.');
  const schedule = s.settings;
  const weekday = d.getDay();
  const businessOpen = schedule.businessOpen || '09:00';
  const businessClose = schedule.businessClose || '19:00';
  const saturdayClose = schedule.saturdayClose || '15:00';
  if (
    schedule.closedDays.includes(weekday) ||
    !schedule.times.includes(b.time) ||
    b.time < businessOpen ||
    (weekday === 6 ? b.time > (schedule.saturdayLast < saturdayClose ? schedule.saturdayLast : saturdayClose) : b.time >= businessClose)
  )
    throw new Error('В это время студия закрыта.');
  if (isOccupied(s, b.date, b.time, except))
    throw new Error('Это время уже занято. Выберите другое окно.');
}
export function createRequest(s, data, actor = 'client', now = new Date()) {
  const svc = s.services.find((v) => v.id === data.serviceId && v.visible !== false);
  if (!svc) throw new Error('Выберите доступную услугу.');
  if (!String(data.name || '').trim() || normalizePhone(data.phone).length !== 11)
    throw new Error('Укажите имя и корректный телефон.');
  validateArrival(s, data);
  const b = {
    id: uid(),
    number: Math.max(1000, ...s.bookings.map((b) => b.number)) + 1,
    name: data.name.trim(),
    phone: data.phone,
    vehicle: data.vehicle || '',
    serviceId: svc.id,
    serviceName: svc.name,
    date: data.date,
    time: data.time,
    status: 'pending',
    quote: null,
    agreed: false,
    staffId: data.staffId || '',
    note: data.note || '',
    cancelReason: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    calls: [],
    callbackAt: '',
    source: actor === 'client' ? 'Сайт' : 'Администратор',
  };
  s.bookings.unshift(b);
  addActivity(s, actor, 'Создана заявка', `№ ${b.number} · ${b.name}`, null, b, now);
  return b;
}
export function updateRequest(s, id, patch, actor = 'owner', now = new Date()) {
  const b = s.bookings.find((b) => b.id === id);
  if (!b) throw new Error('Заявка не найдена.');
  const next = { ...b, ...patch };
  if (typeof next.status !== 'string' || !Object.hasOwn(STATUS, next.status)) throw new Error('Неизвестный статус.');
  if (
    next.quote !== null &&
    (typeof next.quote !== 'number' || !Number.isFinite(next.quote) || next.quote < 0 || next.quote > 10000000)
  )
    throw new Error('Укажите корректную предварительную стоимость.');
  if (typeof next.agreed !== 'boolean') throw new Error('Проверьте согласование стоимости.');
  if (next.status === 'confirmed' && !(Number(next.quote) > 0 && next.agreed))
    throw new Error('Укажите предварительную стоимость и подтвердите согласование с клиентом.');
  if (next.status === 'cancelled' && !next.cancelReason.trim())
    throw new Error('Укажите причину отмены.');
  if (activeRequest(next)) {
    // Existing appointments survive later schedule changes. New or moved
    // appointments must follow the schedule that is currently published.
    const moved = next.date !== b.date || next.time !== b.time || !activeRequest(b);
    if (moved) validateArrival(s, next, id);
    else if (isOccupied(s, next.date, next.time, id))
      throw new Error('Это время уже занято. Выберите другое окно.');
  }
  const before = structuredClone(b);
  Object.assign(b, patch, { updatedAt: now.toISOString() });
  addActivity(
    s,
    actor,
    patch.status && patch.status !== before.status
      ? `Статус: ${STATUS[b.status]}`
      : 'Обновлена заявка',
    `№ ${b.number} · ${b.name}`,
    before,
    b,
    now,
  );
  return b;
}
export function createInitialState(content, now = new Date(), populated = false) {
  const services = structuredClone(content.services).map((v) => ({ ...v, visible: true }));
  const s = {
    version: 1,
    services,
    categories: [...new Set(services.map((v) => v.category))],
    contact: structuredClone(content.contact || {}),
    faq: structuredClone(content.faq || []),
    settings: {
      times: ['09:00', '11:00', '13:00', '15:00', '17:00'],
      closedDays: [0],
      saturdayLast: '13:00',
      callbackHours: 2,
    },
    site: {
      heroTitle: 'Уход, который видно.',
      heroDescription:
        'Детейлинг салона, полировка кузова и защитные покрытия. Сначала оценим состояние автомобиля, затем согласуем объём работ.',
    },
    images: {},
    imageAlts: {},
    media: [],
    bookings: [],
    blocks: [],
    employees: [
      { id: 'owner', name: 'Владелец студии', email: '', role: 'owner', active: true },
      
      
    ],
    activity: [],
    customerNotes: {},
  };
  if (populated && services.length) {
    const day = (offset) => {
      const d = new Date(now);
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
      const direction = offset < 0 ? -1 : 1;
      for (let n = 0; n < Math.abs(offset); n++) {
        do {
          d.setDate(d.getDate() + direction);
        } while (d.getDay() === 0);
      }
      return localDate(d);
    };
    const rows = [
      ['Александр Морозов', 'BMW 5 серии', 0, '09:00', 'pending', null],
      ['Мария Лебедева', 'Mercedes-Benz GLC', 0, '11:00', 'pending', null],
      ['Дмитрий Ковалёв', 'Porsche Cayenne', 0, '13:00', 'confirmed', 24000],
      ['Екатерина Белова', 'Audi Q7', 1, '09:00', 'callback', null],
      ['Артём Смирнов', 'BMW X5', 1, '11:00', 'confirmed', 19000],
      ['Илья Новиков', 'Audi A6', 2, '09:00', 'confirmed', 17000],
      ['Александр Морозов', 'BMW 5 серии', -8, '09:00', 'completed', 17000],
      ['Мария Лебедева', 'Mercedes-Benz GLC', -12, '11:00', 'completed', 19000],
      ['Павел Орлов', 'Volkswagen Tiguan', -2, '15:00', 'cancelled', null],
    ];
    rows.forEach(([name, vehicle, offset, time, status, quote], i) => {
      const svc = services[i % services.length];
      const created = new Date(now.getTime() - (i < 3 ? 35 + i * 18 : 220 + i * 20) * 60000);
      s.bookings.push({
        id: `request-${i + 1}`,
        number: 1048 - i,
        name,
        phone: `+7 (900) 000-${String(i === 6 ? 0 : i === 7 ? 1 : i).padStart(2, '0')}-00`,
        vehicle,
        serviceId: svc.id,
        serviceName: svc.name,
        date: day(offset),
        time: time,
        status,
        quote,
        agreed: !!quote,
        staffId: i % 2 ? 'anna' : 'maxim',
        note:
          i === 0
            ? 'Хочет освежить салон и убрать следы на водительском сиденье.'
            : i === 1
              ? 'Удобнее звонить после 12:00.'
              : '',
        cancelReason: status === 'cancelled' ? 'Изменились планы клиента' : '',
        createdAt: created.toISOString(),
        updatedAt: created.toISOString(),
        calls: [],
        callbackAt: '',
        source: 'Сайт',
      });
    });
    s.activity = [
      {
        id: uid(),
        actor: 'anna',
        action: 'Подтверждена запись',
        target: '№ 1046 · Дмитрий Ковалёв',
        at: new Date(now.getTime() - 18 * 60000).toISOString(),
      },
      {
        id: uid(),
        actor: 'maxim',
        action: 'Назначен повторный звонок',
        target: '№ 1045 · Екатерина Белова',
        at: new Date(now.getTime() - 42 * 60000).toISOString(),
      },
      {
        id: uid(),
        actor: 'owner',
        action: 'Обновлена стоимость услуги',
        target: 'Защитное покрытие',
        at: new Date(now.getTime() - 90 * 60000).toISOString(),
      },
    ];
  }
  return s;
}
