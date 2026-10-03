import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Scissors } from "lucide-react";
import { api } from "../api";
import type { Appointment } from "../types";
import { useApp } from "../context";
import { AppointmentCard, ErrorBox, Loading } from "../components";

export function MyAppointments() {
  const { config } = useApp(),
    [tab, setTab] = useState("future");
  const data = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<Appointment[]>("/appointments"),
  });
  const rows = data.data
    ?.filter((a) =>
      tab === "future"
        ? a.status === "confirmed" && new Date(a.starts_at) > new Date()
        : a.status !== "confirmed" || new Date(a.starts_at) <= new Date(),
    )
    .sort((a, b) =>
      tab === "future"
        ? a.starts_at.localeCompare(b.starts_at)
        : b.starts_at.localeCompare(a.starts_at),
    );
  return (
    <section className="appointments-page">
      <div className="section-heading">
        <div>
          <h1>Мои записи</h1>
          <p>Ваше время и история посещений.</p>
        </div>
        <Link className="secondary" to="/book">
          Новая запись
          <Scissors size={18} />
        </Link>
      </div>
      <div className="tabs">
        <button
          aria-pressed={tab === "future"}
          onClick={() => setTab("future")}
        >
          Предстоящие
        </button>
        <button
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          История
        </button>
      </div>
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox error={data.error} retry={() => data.refetch()} />
      ) : (
        <div className="appointment-list">
          {rows?.map((a) => (
            <AppointmentCard key={a.id} a={a} timezone={config.timezone} />
          ))}
          {rows?.length === 0 && (
            <div className="empty">
              <CalendarDays size={34} />
              <h2>
                {tab === "future"
                  ? "Время для новой стрижки"
                  : "Здесь появится ваша история"}
              </h2>
              <p>
                {tab === "future"
                  ? "У вас пока нет предстоящих записей."
                  : "Прошедшие и отменённые записи сохраняются здесь."}
              </p>
              <Link className="primary" to="/book">
                Выбрать время
                <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}


