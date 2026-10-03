import { useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  List,
  LogOut,
  Scissors,
  Users,
} from "lucide-react";
import { api, post, setCsrf } from "./api";
import { ErrorBox, Loading } from "./components";
import { Calendar } from "./admin/Calendar";
import { Appointments } from "./admin/Appointments";
import { Services } from "./admin/Services";
import { Barbers } from "./admin/Barbers";

export function Admin({ timezone }: { timezone: string }) {
  const qc = useQueryClient(),
    me = useQuery({
      queryKey: ["admin-me"],
      queryFn: async () => {
        const u = await api<{ username: string; csrf: string }>("/admin/me");
        setCsrf(u.csrf, true);
        return u;
      },
      retry: false,
    });
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () =>
      api<{ csrf: string }>("/admin/login", post({ username, password })),
    onSuccess: async (d) => {
      setCsrf(d.csrf, true);
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["admin-me"] });
    },
  });
  const logout = useMutation({
    mutationFn: () => api("/admin/logout", post()),
    onSuccess: () => {
      qc.removeQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("admin"),
      });
      qc.invalidateQueries({ queryKey: ["admin-me"] });
    },
  });
  if (me.isLoading) return <Loading />;
  if (!me.data)
    return (
      <div className="admin-shell admin-login">
        <Link className="back-link" to="/">
          <ArrowLeft size={18} />В мини-приложение
        </Link>
        <form
          className="login-card"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <Scissors size={32} />
          <h1>
            Запись<span>для администратора</span>
          </h1>
          <p>Управление одним барбершопом.</p>
          <label>
            Имя пользователя
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {login.error && <ErrorBox error={login.error} />}
          <button className="primary" disabled={login.isPending}>
            {login.isPending ? "Входим…" : "Войти"}
            <ArrowRight size={18} />
          </button>
          <small>
            Аккаунт создаётся командой на сервере. Публичной регистрации нет.
          </small>
        </form>
      </div>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" to="/admin">
          <Scissors size={25} />
          <span>
            Запись<span className="brand-caption">управление</span>
          </span>
        </Link>
        <nav>
          <NavLink to="/admin" end>
            <CalendarDays size={20} />
            Расписание
          </NavLink>
          <NavLink to="/admin/appointments">
            <List size={20} />
            Записи
          </NavLink>
          <NavLink to="/admin/barbers">
            <Users size={20} />
            Мастера
          </NavLink>
          <NavLink to="/admin/services">
            <Scissors size={20} />
            Услуги
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <span>Демонстрационный проект</span>
          <Link to="/">
            Открыть мини-приложение
            <ArrowRight size={16} />
          </Link>
          <button onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <span>Барбершоп / Управление</span>
          <span>{me.data.username}</span>
        </div>
        <Routes>
          <Route path="/admin" element={<Calendar timezone={timezone} />} />
          <Route
            path="/admin/appointments"
            element={<Appointments timezone={timezone} />}
          />
          <Route path="/admin/services" element={<Services />} />
          <Route path="/admin/barbers" element={<Barbers />} />
          <Route path="*" element={<Link to="/admin">К расписанию</Link>} />
        </Routes>
      </main>
    </div>
  );
}


