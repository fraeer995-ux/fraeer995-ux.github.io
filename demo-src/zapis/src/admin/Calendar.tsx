import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api, dateLabel, dayKey, statuses, timeLabel } from "../api";
import type { Appointment, Barber } from "../types";
import { ErrorBox, Loading, Photo } from "../components";
import { shiftDay, useAdminBarbers, type Page } from "./shared";
import { AppointmentEditor, BookingEditor } from "./BookingEditor";

export function Calendar({ timezone }: { timezone: string }) {
  const [day, setDay] = useState(dayKey(new Date(), timezone)),
    [view, setView] = useState("day"),
    [selected, setSelected] = useState<Appointment>(),
    [create, setCreate] = useState(false);
  const barbers = useAdminBarbers();
  const days = Array.from({ length: view === "day" ? 1 : 7 }, (_, i) =>
    shiftDay(day, i),
  );
  const rows = useQuery({
    queryKey: ["admin-calendar", day, view],
    queryFn: () =>
      api<Page>(
        `/admin/appointments?day_from=${day}&day_to=${days.at(-1)}&page_size=200`,
      ),
  });
  const visible =
    rows.data?.items.filter((a) => a.status !== "cancelled") || [];
  const startHour = Math.min(
    10,
    ...visible.map((a) => Number(timeLabel(a.starts_at, timezone).slice(0, 2))),
  );
  const endHour = Math.max(
    20,
    ...visible.map((a) => {
      const parts = timeLabel(a.ends_at, timezone).split(":").map(Number);
      return parts[0] + (parts[1] ? 1 : 0);
    }),
  );
  const hourCount = endHour - startHour + 1;
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Расписание</h1>
          <p>Записи, мастера и свободное время.</p>
        </div>
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={18} />
          Создать запись
        </button>
      </div>
      <div className="calendar-toolbar">
        <div className="date-controls">
          <button
            className="icon-button"
            aria-label="Предыдущий период"
            onClick={() => setDay(shiftDay(day, view === "day" ? -1 : -7))}
          >
            <ChevronLeft />
          </button>
          <input
            type="date"
            aria-label="Дата расписания"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Следующий период"
            onClick={() => setDay(shiftDay(day, view === "day" ? 1 : 7))}
          >
            <ChevronRight />
          </button>
          <button
            className="secondary"
            onClick={() => setDay(dayKey(new Date(), timezone))}
          >
            Сегодня
          </button>
        </div>
        <div className="tabs">
          <button aria-pressed={view === "day"} onClick={() => setView("day")}>
            День
          </button>
          <button
            aria-pressed={view === "week"}
            onClick={() => setView("week")}
          >
            Неделя
          </button>
        </div>
      </div>
      {rows.isLoading || barbers.isLoading ? (
        <Loading />
      ) : rows.error || barbers.error ? (
        <ErrorBox
          error={rows.error || barbers.error}
          retry={() => rows.refetch()}
        />
      ) : (
        <div className={"admin-calendar " + (view === "week" ? "week" : "")}>
          <div className="calendar-scale">
            <span>Время</span>
            {Array.from({ length: hourCount }, (_, i) => (
              <span key={i}>{i + startHour}:00</span>
            ))}
          </div>
          {(view === "day" ? barbers.data || [] : days).map((column) => {
            const label =
              typeof column === "string"
                ? dateLabel(column, timezone, true)
                : column.name;
            const apps = rows.data?.items.filter((a) =>
              view === "day"
                ? a.barber_id === (column as Barber).id
                : dayKey(new Date(a.starts_at), timezone) === column,
            );
            return (
              <div className="calendar-column" key={label}>
                <header>
                  {typeof column !== "string" && (
                    <Photo src={column.photo} name={column.name} />
                  )}
                  <strong>{label}</strong>
                </header>
                <div
                  className="calendar-day-body"
                  style={{ height: hourCount * 72 }}
                >
                  {Array.from({ length: hourCount }, (_, i) => (
                    <div className="hour-line" key={i} />
                  ))}
                  {apps
                    ?.filter((a) => a.status !== "cancelled")
                    .map((a) => {
                      const t = timeLabel(a.starts_at, timezone)
                        .split(":")
                        .map(Number);
                      return (
                        <button
                          key={a.id}
                          className={"calendar-appointment " + a.status}
                          style={{
                            top: Math.max(
                              0,
                              (t[0] - startHour) * 72 + (t[1] / 60) * 72,
                            ),
                            minHeight: Math.max(42, (a.duration / 60) * 72 - 4),
                          }}
                          onClick={() => setSelected(a)}
                        >
                          <span>
                            {timeLabel(a.starts_at, timezone)} · {a.client_name}
                          </span>
                          <strong>{a.service_name}</strong>
                          <small>
                            {view === "week"
                              ? a.barber_name
                              : statuses[a.status]}
                          </small>
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {rows.data && rows.data.total > 200 && (
        <p className="muted">
          Показаны первые 200 записей. Используйте таблицу с фильтрами для
          полного списка.
        </p>
      )}
      {selected && (
        <AppointmentEditor
          appointment={selected}
          timezone={timezone}
          onClose={() => setSelected(undefined)}
        />
      )}{" "}
      {create && (
        <BookingEditor timezone={timezone} onClose={() => setCreate(false)} />
      )}
    </>
  );
}


