import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Home as HomeIcon,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { api, post, setCsrf } from "./api";
import type { Config, User } from "./types";
import { ErrorBox, Loading } from "./components";
import { AppContext } from "./context";
import { Gate } from "./client/Gate";
import { Home } from "./client/Home";
import { Book } from "./client/Book";
import { DemoInfo } from "./client/DemoInfo";
import { MyAppointments } from "./client/MyAppointments";
import { AppointmentPage } from "./client/AppointmentPage";
import { Admin } from "./Admin";

export function App() {
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<Config>("/config"),
  });
  const user = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const u = await api<User>("/auth/me");
      setCsrf(u.csrf);
      return u;
    },
    retry: false,
  });
  const location = useLocation(),
    navigate = useNavigate(),
    qc = useQueryClient();
  const [tgError, setTgError] = useState<unknown>();
  const [tgLoading, setTgLoading] = useState(false);
  const [tgReady, setTgReady] = useState(false);
  const telegramAuth = async () => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;
    setTgLoading(true);
    setTgError(undefined);
    try {
      await api<{ csrf: string }>(
        "/auth/telegram",
        post({ init_data: tg.initData }),
      );
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setTgError(e);
    } finally {
      setTgLoading(false);
    }
  };
  useEffect(() => {
    // Async SDK load never blocks the local interface when Telegram is offline.
    // Poll only for SDK availability; initData itself is always verified server-side.
    const check = () => {
      if (window.Telegram?.WebApp) setTgReady(true);
    };
    check();
    const timer = window.setInterval(check, 200);
    const timeout = window.setTimeout(() => window.clearInterval(timer), 30000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(timeout);
    };
  }, []);
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tgReady || !tg?.initData) return;
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#17191B");
    tg.setBackgroundColor("#17191B");
    if (tg.isVersionAtLeast("7.10")) tg.setBottomBarColor?.("#17191B");
    const update = () => {
      document.documentElement.style.setProperty(
        "--tg-safe-top",
        Math.max(
          tg.safeAreaInset?.top || 0,
          tg.contentSafeAreaInset?.top || 0,
        ) + "px",
      );
      document.documentElement.style.setProperty(
        "--tg-safe-bottom",
        Math.max(
          tg.safeAreaInset?.bottom || 0,
          tg.contentSafeAreaInset?.bottom || 0,
        ) + "px",
      );
    };
    update();
    tg.onEvent("safeAreaChanged", update);
    tg.onEvent("contentSafeAreaChanged", update);
    telegramAuth();
    return () => {
      tg.offEvent("safeAreaChanged", update);
      tg.offEvent("contentSafeAreaChanged", update);
    };
  }, [tgReady]);
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;
    const back = () => navigate(-1);
    if (location.pathname !== "/") {
      tg.BackButton.show();
      tg.BackButton.onClick(back);
    } else tg.BackButton.hide();
    return () => tg.BackButton.offClick(back);
  }, [location.pathname, navigate, tgReady]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (location.pathname.startsWith("/admin"))
    return <Admin timezone={config.data?.timezone || "Europe/Moscow"} />;
  return (
    <AppContext.Provider
      value={{
        config: config.data || {
          demo_mode: false,
          portfolio_mode: false,
          portfolio_booking_limit: 3,
          bot_url: null,
          timezone: "Europe/Moscow",
          change_cutoff_hours: 2,
        },
        user: user.data,
      }}
    >
      <div className="client-shell">
        <a className="skip-link" href="#content">
          К содержимому
        </a>
        <header className="site-header">
          <Link className="brand" to="/">
            <Scissors size={25} />
            <span>
              Запись<span className="brand-caption">барбершоп</span>
            </span>
          </Link>
          <nav className="desktop-nav">
            <NavLink to="/" end>
              Главная
            </NavLink>
            <NavLink to="/appointments">Мои записи</NavLink>
          </nav>
          <span className="demo-label">
            <span />
            Демо-проект
          </span>
        </header>
        <main id="content">
          {config.error && (
            <ErrorBox error={config.error} retry={() => config.refetch()} />
          )}{" "}
          {!!tgError && <ErrorBox error={tgError} retry={telegramAuth} />}{" "}
          {tgLoading ? (
            <Loading />
          ) : (
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/demo" element={<DemoInfo />} />
              <Route
                path="/book"
                element={
                  <Gate>
                    <Book />
                  </Gate>
                }
              />
              <Route
                path="/appointments"
                element={
                  <Gate>
                    <MyAppointments />
                  </Gate>
                }
              />
              <Route
                path="/appointments/:id"
                element={
                  <Gate>
                    <AppointmentPage />
                  </Gate>
                }
              />
              <Route
                path="/success/:id"
                element={
                  <Gate>
                    <AppointmentPage success />
                  </Gate>
                }
              />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Страница не найдена</h1>
                    <Link className="primary" to="/">
                      На главную
                    </Link>
                  </div>
                }
              />
            </Routes>
          )}
        </main>
        <footer className="site-footer">
          <span>Вымышленный барбершоп. Создано для портфолио.</span>
          <Link to="/demo">Как попробовать демо</Link>
          <Link to="/admin">
            <ShieldCheck size={15} /> Администратору
          </Link>
        </footer>
        <nav className="mobile-nav" aria-label="Основная навигация">
          <NavLink to="/" end>
            <HomeIcon size={21} />
            Главная
          </NavLink>
          <NavLink to="/book">
            <Scissors size={21} />
            Записаться
          </NavLink>
          <NavLink to="/appointments">
            <CalendarDays size={21} />
            Мои записи
          </NavLink>
        </nav>
      </div>
    </AppContext.Provider>
  );
}


