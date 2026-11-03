// In-browser transport for the original CRM interface. All records are fictional.
const storageKey = "portfolio-potok-v1";
const stages = ["new", "working", "proposal", "won", "lost"];
const iso = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString();
const day = (value = iso()) => value.slice(0, 10);
const nextId = (items) => Math.max(0, ...items.map((item) => item.id)) + 1;
const person = ({ id, name }) => ({ id, name });
const matches = (query, values) => !query || values.join(" ").toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"));
const overdue = (task) => !task.done && task.due_at < iso();

function seed() {
  const users = ["Администратор", "Анна", "Михаил"].map((name, index) => ({
    id: index + 1, name, email: ["admin", "anna", "mikhail"][index] + "@example.com",
    role: index === 0 ? "admin" : "manager", active: true, timezone: "Europe/Moscow"
  }));
  const clients = ["Студия «Линия»", "Ателье «Форма»", "Мастерская «Сосна»", "Кафе «Утро»", "Бюро «Среда»", "Студия «Точка»"]
    .map((name, index) => ({ id: index + 1, name, email: "demo" + (index + 1) + "@example.com", phone: "", telegram: "", note: "" }));
  const titles = ["Разработка сайта студии", "Ремонт офиса", "Фирменный стиль", "Сайт для кофейни", "Дизайн интерьера", "Обновление каталога"];
  const leads = titles.map((title, index) => ({
    id: index + 1, title, client: clients[index], status: stages[index % stages.length],
    amount: String(35000 + index * 19000), source: ["Сайт", "Рекомендация", "Демо-форма"][index % 3],
    assignee: person(users[1 + index % 2]), description: "Пример сделки для портфолио.",
    created_at: iso(-index), updated_at: iso(-index), closed_at: index === 3 || index === 4 ? iso(-index) : null,
    archived: false, refusal_reason: index === 4 ? "Проект отложен" : "", comments: [], history: []
  }));
  const tasks = ["Уточнить сроки", "Подготовить смету", "Согласовать встречу"].map((title, index) => ({
    id: index + 1, title, description: "", lead_id: leads[index].id, lead_title: leads[index].title,
    assignee: leads[index].assignee, due_at: iso(index - 1), done: false, completed_at: null
  }));
  return { users, clients, leads, tasks, activity: [], userId: null };
}

let state = seed();
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey));
  if (saved?.users && saved.clients && saved.leads && saved.tasks && saved.activity) state = saved;
} catch {
  // The demo also works when browser storage is unavailable.
}

function save() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Changes remain available in the open page.
  }
}

function page(items, query) {
  const number = Math.max(1, Number(query.get("page")) || 1);
  const size = Math.min(100, Math.max(1, Number(query.get("size")) || 15));
  return { items: items.slice((number - 1) * size, number * size), total: items.length };
}

function taskView(task) {
  return { ...task, overdue: overdue(task), lead_title: state.leads.find((lead) => lead.id === task.lead_id)?.title || task.lead_title };
}

function leadView(lead) {
  return {
    ...lead, client: state.clients.find((client) => client.id === lead.client.id) || lead.client,
    overdue: state.tasks.some((task) => task.lead_id === lead.id && overdue(task)),
    tasks: state.tasks.filter((task) => task.lead_id === lead.id).map(taskView)
  };
}

function event(lead, user, message, kind = "update") {
  const item = { id: nextId(state.activity), lead_id: lead.id, lead_title: lead.title, message,
    author: user?.name || "Демо-форма", created_at: iso(), kind };
  lead.history.unshift(item);
  state.activity.unshift(item);
}

function createLead(data, user) {
  let client = state.clients.find((item) => item.id === Number(data.client_id));
  if (!client && data.client?.name) {
    client = { id: nextId(state.clients), name: data.client.name, phone: data.client.phone || "",
      email: data.client.email || "", telegram: data.client.telegram || "", note: "" };
    state.clients.push(client);
  }
  if (!client || !data.title?.trim()) return null;
  const assigned = state.users.find((item) => item.id === Number(data.assignee_id)) ||
    (user?.role === "manager" ? user : null);
  const lead = { id: nextId(state.leads), title: data.title.trim(), client, status: "new",
    amount: String(Number(data.amount) || 0), source: data.source || "Вручную", assignee: assigned ? person(assigned) : null,
    description: data.description || "", created_at: iso(), updated_at: iso(), closed_at: null,
    archived: false, refusal_reason: "", comments: [], history: [] };
  state.leads.unshift(lead);
  event(lead, user, "Заявка создана", "created");
  return lead;
}

function listLeads(query, leads) {
  const selected = leads.map(leadView).filter((lead) =>
    lead.archived === (query.get("archived") === "true") &&
    (!query.get("status") || lead.status === query.get("status")) &&
    (!query.get("source") || lead.source === query.get("source")) &&
    (!query.get("assignee_id") || lead.assignee?.id === Number(query.get("assignee_id"))) &&
    (!query.get("start") || day(lead.created_at) >= query.get("start")) &&
    (!query.get("end") || day(lead.created_at) <= query.get("end")) &&
    matches(query.get("q"), [lead.title, lead.client.name, lead.client.email, lead.client.phone, lead.client.telegram]));
  const sort = {
    oldest: (a, b) => a.created_at.localeCompare(b.created_at),
    amount: (a, b) => Number(b.amount) - Number(a.amount),
    title: (a, b) => a.title.localeCompare(b.title, "ru"),
    newest: (a, b) => b.created_at.localeCompare(a.created_at)
  };
  selected.sort(sort[query.get("sort")] || sort.newest);
  const groups = Object.fromEntries(stages.map((status) => {
    const group = selected.filter((lead) => lead.status === status);
    return [status, { count: group.length, amount: String(group.reduce((sum, lead) => sum + Number(lead.amount), 0)) }];
  }));
  return { ...page(selected, query), groups };
}

function overview(query, leads, tasks) {
  const end = query.get("end") || day();
  const start = query.get("start") || day(iso(1 - (Number(query.get("days")) || 30)));
  const activeLeads = leads.filter((lead) => !lead.archived);
  const incoming = activeLeads.filter((lead) => day(lead.created_at) >= start && day(lead.created_at) <= end);
  const won = activeLeads.filter((lead) => lead.status === "won" && lead.closed_at && day(lead.closed_at) >= start && day(lead.closed_at) <= end);
  const counts = new Map();
  for (const lead of incoming) counts.set(lead.source, (counts.get(lead.source) || 0) + 1);
  const daily = [];
  const last = Date.parse(end);
  for (let date = Date.parse(start); date <= last && daily.length < 366; date += 86400000) {
    const label = day(new Date(date).toISOString());
    daily.push({ date: label, count: incoming.filter((lead) => day(lead.created_at) === label).length });
  }
  return { start, end, new: incoming.length, active: activeLeads.filter((lead) => stages.slice(0, 3).includes(lead.status)).length,
    won: won.length, revenue: won.reduce((sum, lead) => sum + Number(lead.amount), 0),
    overdue: tasks.filter(overdue).length, sources: [...counts].map(([name, count]) => ({ name, count })), daily,
    tasks: tasks.filter((task) => !task.done).slice(0, 5).map(taskView),
    activity: state.activity.filter((entry) => leads.some((lead) => lead.id === entry.lead_id)).slice(0, 10) };
}

const result = (value, status = 200) => Response.json(value, { status });
const error = (message, status = 422) => result({ error: { message } }, status);

export async function demoFetch(path, options = {}) {
  const url = new URL(path, "https://demo.invalid");
  const query = url.searchParams;
  const [area, key, action] = url.pathname.split("/").filter(Boolean);
  const method = options.method || "GET";
  const data = options.body ? JSON.parse(options.body) : {};
  const user = state.users.find((item) => item.id === state.userId && item.active);
  if (path === "/auth/login" && method === "POST") {
    const selected = state.users.find((item) => item.active && item.email === data.email);
    if (!selected || data.password !== "PotokDemo2026!") return error("Выберите демонстрационный аккаунт.", 401);
    state.userId = selected.id;
    save();
    return result({ user: selected, csrf: "local-demo" });
  }
  if (path === "/public/leads" && method === "POST") {
    const lead = createLead({ title: data.service, description: data.comment, source: "Демо-форма",
      client: { name: data.name, phone: data.phone, email: data.email } });
    if (!lead) return error("Укажите имя и задачу.");
    save();
    return result({ id: lead.id }, 201);
  }
  if (!user) return error("Войдите в демо.", 401);
  const admin = user.role === "admin";
  const leads = admin ? state.leads : state.leads.filter((lead) => lead.assignee?.id === user.id);
  const tasks = admin ? state.tasks : state.tasks.filter((task) => task.assignee?.id === user.id);
  let response;
  if (area === "auth") {
    if (key === "me" && method === "GET") return result({ user, csrf: "local-demo" });
    if (key === "logout" && method === "POST") { state.userId = null; response = { ok: true }; }
    if (key === "profile" && method === "PATCH") {
      user.name = data.name?.trim() || user.name;
      user.timezone = data.timezone || user.timezone;
      response = user;
    }
    if (key === "password") return error("В портфолио используются общие тестовые аккаунты с фиксированным паролем.");
  } else if (area === "overview") {
    return result(overview(query, leads, tasks));
  } else if (area === "assignees") {
    return result(state.users.filter((item) => item.active).map(person));
  } else if (area === "lead-sources") {
    return result([...new Set(leads.map((lead) => lead.source))].sort());
  } else if (area === "leads") {
    if (!key && method === "GET") return result(listLeads(query, leads));
    if (!key && method === "POST") {
      response = createLead(data, user);
      if (!response) return error("Укажите название заявки и клиента.");
    } else {
      const lead = leads.find((item) => item.id === Number(key));
      if (!lead) return error("Заявка не найдена.", 404);
      if (method === "GET") return result(leadView(lead));
      if (method === "PATCH") {
        for (const field of ["title", "amount", "source", "description"]) {
          if (data[field] !== undefined) lead[field] = data[field];
        }
        if (admin && "assignee_id" in data) {
          const assignee = state.users.find((item) => item.id === data.assignee_id);
          lead.assignee = assignee ? person(assignee) : null;
        }
        event(lead, user, "Заявка обновлена");
      } else if (method === "POST" && action === "status" && stages.includes(data.status)) {
        lead.status = data.status;
        lead.closed_at = ["won", "lost"].includes(data.status) ? iso() : null;
        lead.refusal_reason = data.status === "lost" ? data.reason || "" : "";
        event(lead, user, "Этап заявки обновлён", "status");
      } else if (method === "POST" && action === "archive" && admin) {
        lead.archived = query.get("archived") === "true";
        event(lead, user, lead.archived ? "Заявка в архиве" : "Заявка восстановлена");
      } else if (method === "POST" && action === "comments" && data.body?.trim()) {
        lead.comments.unshift({ id: nextId(lead.comments), body: data.body.trim(), author: user.name, created_at: iso() });
        event(lead, user, "Добавлен комментарий", "comment");
      } else return error("Действие недоступно.");
      lead.updated_at = iso();
      response = leadView(lead);
    }
  } else if (area === "tasks") {
    if (!key && method === "GET") {
      const view = query.get("view");
      const filters = { done: (task) => task.done, overdue, today: (task) => !task.done && day(task.due_at) === day(),
        upcoming: (task) => !task.done && task.due_at >= iso() };
      const filtered = tasks.filter(filters[view] || filters.upcoming).sort((a, b) => a.due_at.localeCompare(b.due_at));
      return result({ ...page(filtered.map(taskView), query), overdue: tasks.filter(overdue).length });
    }
    if (!key && method === "POST") {
      const lead = leads.find((item) => item.id === data.lead_id);
      if (!lead || !data.title?.trim() || !data.due_at) return error("Выберите заявку, название и срок.");
      const assignee = state.users.find((item) => item.id === data.assignee_id) || lead.assignee || user;
      const task = { id: nextId(state.tasks), title: data.title.trim(), description: data.description || "",
        lead_id: lead.id, lead_title: lead.title, due_at: data.due_at, assignee: person(assignee), done: false, completed_at: null };
      state.tasks.push(task);
      event(lead, user, "Добавлена задача", "task");
      response = taskView(task);
    } else if (key && method === "PATCH") {
      const task = tasks.find((item) => item.id === Number(key));
      if (!task) return error("Задача не найдена.", 404);
      task.done = Boolean(data.done);
      task.completed_at = task.done ? iso() : null;
      response = taskView(task);
    }
  } else if (area === "clients") {
    const clients = admin ? state.clients : state.clients.filter((client) => leads.some((lead) => lead.client.id === client.id));
    if (!key && method === "GET") {
      return result(page(clients.filter((item) => matches(query.get("q"), [item.name, item.email, item.phone, item.telegram])), query));
    }
    const client = clients.find((item) => item.id === Number(key));
    if (!client) return error("Клиент не найден.", 404);
    if (method === "GET") return result({ ...client, leads: leads.filter((lead) => lead.client.id === client.id).map(leadView) });
    if (method === "PATCH") {
      for (const field of ["name", "email", "phone", "telegram", "note"]) {
        if (typeof data[field] === "string") client[field] = data[field];
      }
      response = client;
    }
  } else if (area === "users" && admin) {
    if (!key && method === "GET") return result(state.users);
    if (!key && method === "POST") {
      if (!data.name?.trim() || !data.email?.trim() || state.users.some((item) => item.email === data.email)) return error("Проверьте имя и уникальность email.");
      response = { id: nextId(state.users), name: data.name, email: data.email,
        role: data.role === "admin" ? "admin" : "manager", active: true, timezone: "Europe/Moscow" };
      state.users.push(response);
    } else if (key && method === "PATCH") {
      const member = state.users.find((item) => item.id === Number(key) && item.id !== user.id);
      if (!member) return error("Действие недоступно.");
      member.active = Boolean(data.active);
      response = member;
    }
  }
  if (response === undefined) return error("Действие недоступно в демо.", 404);
  save();
  return result(response);
}
