import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Send } from "lucide-react";
import { api, dateLabel, post, timeLabel } from "../api";
import type { Appointment } from "../types";
import { useApp } from "../context";
import { Details, Dialog, ErrorBox, Loading, SuccessMark } from "../components";

export function AppointmentPage({ success = false }: { success?: boolean }) {
  const { id } = useParams(),
    { config, user } = useApp(),
    qc = useQueryClient();
  const data = useQuery({
    queryKey: ["appointment", id],
    queryFn: () => api<Appointment>("/appointments/" + id),
    refetchInterval: success ? 5000 : false,
  });
  const [dialog, setDialog] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  const cancel = useMutation({
    mutationFn: () =>
      api<Appointment>("/appointments/" + id + "/cancel", post(), key),
    onSuccess: async () => {
      setDialog(false);
      await qc.invalidateQueries({ queryKey: ["appointment", id] });
      await qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
  if (data.isLoading) return <Loading />;
  if (data.error)
    return <ErrorBox error={data.error} retry={() => data.refetch()} />;
  const a = data.data!;
  return (
    <section className="appointment-detail">
      <Link className="back-link" to="/appointments">
        <ArrowLeft size={18} />
        Мои записи
      </Link>
      {success && a.status === "confirmed" ? (
        <>
          <SuccessMark />
          <h1>Вы записаны</h1>
          <p className="muted">Время за вами. Все детали — ниже.</p>
        </>
      ) : (
        <>
          <h1>{a.service_name}</h1>
          <span className={"badge " + a.status}>
            {
              (
                {
                  confirmed: "Подтверждена",
                  cancelled: "Отменена",
                  completed: "Завершена",
                  no_show: "Неявка",
                } as Record<string, string>
              )[a.status]
            }
          </span>
        </>
      )}
      <Details a={a} timezone={config.timezone} />
      <div className="notification-note">
        <Send size={19} />
        <p>
          {user?.demo
            ? "Локальный демо-режим: Telegram-сообщения не отправляются."
            : a.notification === "sent"
              ? "Подтверждение отправлено в Telegram."
              : a.notification === "pending"
                ? "Запись сохранена. Подтверждение ожидает отправки в Telegram."
                : "Запись сохранена. Telegram-уведомление не доставлено. Все детали доступны здесь."}
        </p>
      </div>
      <p className="demo-disclaimer">
        Это демонстрационная запись. Реальное посещение не бронируется.
      </p>
      {a.status === "confirmed" &&
        (a.can_change ? (
          <div className="detail-actions">
            <Link className="secondary" to={"/book?move=" + a.id}>
              Перенести
              <CalendarDays size={18} />
            </Link>
            <button className="danger-button" onClick={() => setDialog(true)}>
              Отменить запись
            </button>
          </div>
        ) : (
          <p className="muted">{a.change_reason}</p>
        ))}
      {success && a.status === "confirmed" && (
        <div className="detail-actions">
          <Link className="primary" to="/appointments">
            Мои записи
            <ArrowRight size={18} />
          </Link>
          <Link className="secondary" to="/">
            На главную
          </Link>
        </div>
      )}
      {dialog && (
        <Dialog
          title="Отменить запись?"
          onClose={() => {
            if (!cancel.isPending) setDialog(false);
          }}
        >
          <p>
            {dateLabel(a.starts_at, config.timezone)} в{" "}
            {timeLabel(a.starts_at, config.timezone)}. Время освободится для
            другого клиента.
          </p>
          {cancel.error && <ErrorBox error={cancel.error} />}
          <div className="dialog-actions">
            <button
              className="secondary"
              onClick={() => setDialog(false)}
              disabled={cancel.isPending}
            >
              Оставить запись
            </button>
            <button
              className="danger-button"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? "Отменяем…" : "Да, отменить"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}


