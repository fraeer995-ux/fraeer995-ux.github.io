import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Settings2, X } from "lucide-react";
import { api, put } from "../api";
import type { Barber, Schedule } from "../types";
import { Dialog, ErrorBox, Loading, Photo } from "../components";
import { refreshAdmin, useAdminBarbers, useAdminServices } from "./shared";

export function Barbers() {
  const data = useAdminBarbers(),
    [edit, setEdit] = useState<Barber>(),
    [schedule, setSchedule] = useState<Barber>();
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Мастера</h1>
          <p>Команда, специализация и рабочие часы.</p>
        </div>
      </div>
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox error={data.error} />
      ) : (
        <div className="admin-barber-grid">
          {data.data?.map((b) => (
            <article key={b.id}>
              <Photo src={b.photo} name={b.name} />
              <div>
                <span className="badge">{b.active ? "Активен" : "Скрыт"}</span>
                <h2>{b.name}</h2>
                <p>{b.description}</p>
                <button className="secondary" onClick={() => setEdit(b)}>
                  <Settings2 size={17} />
                  Профиль и услуги
                </button>
                <button className="secondary" onClick={() => setSchedule(b)}>
                  <CalendarDays size={17} />
                  Рабочие часы
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && (
        <BarberEditor barber={edit} onClose={() => setEdit(undefined)} />
      )}{" "}
      {schedule && (
        <ScheduleEditor
          barber={schedule}
          onClose={() => setSchedule(undefined)}
        />
      )}
    </>
  );
}

function BarberEditor({
  barber: b,
  onClose,
}: {
  barber: Barber;
  onClose: () => void;
}) {
  const qc = useQueryClient(),
    services = useAdminServices(),
    [draft, setDraft] = useState(b);
  const save = useMutation({
    mutationFn: () => api("/admin/barbers/" + b.id, put(draft)),
    onSuccess: async () => {
      await refreshAdmin(qc);
      await qc.invalidateQueries({ queryKey: ["barbers"] });
      onClose();
    },
  });
  return (
    <Dialog
      title={"Профиль · " + b.name}
      onClose={() => !save.isPending && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Имя
          <input
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Описание
          <textarea
            maxLength={500}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </label>
        <label>
          Фотография (путь /images/ или HTTPS)
          <input
            value={draft.photo}
            onChange={(e) => setDraft({ ...draft, photo: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>Доступные услуги</legend>
          {services.data?.map((s) => (
            <label className="checkbox-label" key={s.id}>
              <input
                type="checkbox"
                checked={draft.service_ids.includes(s.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    service_ids: e.target.checked
                      ? [...draft.service_ids, s.id]
                      : draft.service_ids.filter((id) => id !== s.id),
                  })
                }
              />
              {s.name}
            </label>
          ))}
        </fieldset>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Активен
        </label>
        {save.error && <ErrorBox error={save.error} />}
        <button className="primary" disabled={save.isPending}>
          Сохранить
        </button>
      </form>
    </Dialog>
  );
}

function ScheduleEditor({
  barber,
  onClose,
}: {
  barber: Barber;
  onClose: () => void;
}) {
  const data = useQuery({
    queryKey: ["admin-schedule", barber.id],
    queryFn: () => api<Schedule>("/admin/barbers/" + barber.id + "/schedule"),
  });
  return (
    <Dialog title={"Рабочие часы · " + barber.name} onClose={onClose}>
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox error={data.error} />
      ) : (
        <ScheduleForm initial={data.data!} barber={barber} onClose={onClose} />
      )}
    </Dialog>
  );
}

function ScheduleForm({
  initial,
  barber,
  onClose,
}: {
  initial: Schedule;
  barber: Barber;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial),
    qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api("/admin/barbers/" + barber.id + "/schedule", put(draft)),
    onSuccess: async () => {
      await refreshAdmin(qc);
      onClose();
    },
  });
  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  return (
    <form
      className="schedule-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p>
        Время в часовом поясе барбершопа. День без рабочего интервала считается
        выходным.
      </p>
      <h3>Рабочая неделя и перерывы</h3>
      {draft.hours.map((h, i) => (
        <div className="hours-row" key={i}>
          <label>
            День
            <select
              value={h.weekday}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  hours: draft.hours.map((v, j) =>
                    j === i ? { ...v, weekday: Number(e.target.value) } : v,
                  ),
                })
              }
            >
              {weekdays.map((w, j) => (
                <option key={w} value={j}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            Тип
            <select
              value={h.kind}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  hours: draft.hours.map((v, j) =>
                    j === i ? { ...v, kind: e.target.value } : v,
                  ),
                })
              }
            >
              <option value="work">Работа</option>
              <option value="break">Перерыв</option>
            </select>
          </label>
          <label>
            С
            <input
              type="time"
              required
              value={h.start.slice(0, 5)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  hours: draft.hours.map((v, j) =>
                    j === i ? { ...v, start: e.target.value } : v,
                  ),
                })
              }
            />
          </label>
          <label>
            До
            <input
              type="time"
              required
              value={h.end.slice(0, 5)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  hours: draft.hours.map((v, j) =>
                    j === i ? { ...v, end: e.target.value } : v,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={"Удалить интервал " + (i + 1)}
            onClick={() =>
              setDraft({
                ...draft,
                hours: draft.hours.filter((_, j) => j !== i),
              })
            }
          >
            <X size={17} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setDraft({
            ...draft,
            hours: [
              ...draft.hours,
              { weekday: 0, start: "10:00", end: "20:00", kind: "work" },
            ],
          })
        }
      >
        <Plus size={17} />
        Добавить интервал
      </button>
      <h3>Исключения по датам</h3>
      <p className="muted small">
        Выходной блокирует весь день. Рабочий интервал заменяет недельные часы;
        перерыв добавляет блокировку.
      </p>
      {draft.exceptions.map((ex, i) => (
        <div className="exception-row" key={i}>
          <label>
            Дата
            <input
              type="date"
              required
              value={ex.day}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  exceptions: draft.exceptions.map((v, j) =>
                    j === i ? { ...v, day: e.target.value } : v,
                  ),
                })
              }
            />
          </label>
          <label>
            Тип
            <select
              value={ex.kind}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  exceptions: draft.exceptions.map((v, j) =>
                    j === i
                      ? {
                          ...v,
                          kind: e.target.value,
                          start: e.target.value === "off" ? null : "10:00",
                          end: e.target.value === "off" ? null : "20:00",
                        }
                      : v,
                  ),
                })
              }
            >
              <option value="off">Выходной</option>
              <option value="work">Работа</option>
              <option value="break">Перерыв</option>
            </select>
          </label>
          {ex.kind !== "off" && (
            <>
              <label>
                С
                <input
                  type="time"
                  required
                  value={ex.start?.slice(0, 5) || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      exceptions: draft.exceptions.map((v, j) =>
                        j === i ? { ...v, start: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                До
                <input
                  type="time"
                  required
                  value={ex.end?.slice(0, 5) || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      exceptions: draft.exceptions.map((v, j) =>
                        j === i ? { ...v, end: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
            </>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={"Удалить исключение " + (i + 1)}
            onClick={() =>
              setDraft({
                ...draft,
                exceptions: draft.exceptions.filter((_, j) => j !== i),
              })
            }
          >
            <X size={17} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setDraft({
            ...draft,
            exceptions: [
              ...draft.exceptions,
              {
                day: new Date().toISOString().slice(0, 10),
                kind: "off",
                start: null,
                end: null,
              },
            ],
          })
        }
      >
        <Plus size={17} />
        Добавить исключение
      </button>
      {save.error && <ErrorBox error={save.error} />}
      <p className="muted small">
        При конфликте с подтверждёнными записями изменения не сохранятся.
        Сначала разрешите конфликт в расписании.
      </p>
      <button className="primary" disabled={save.isPending}>
        {save.isPending ? "Сохраняем…" : "Сохранить расписание"}
      </button>
    </form>
  );
}


