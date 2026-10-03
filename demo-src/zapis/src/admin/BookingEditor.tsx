import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { api, dayKey, money, post, statuses, timeLabel } from "../api";
import type { Appointment } from "../types";
import { Details, Dialog, ErrorBox, Loading } from "../components";
import {
  refreshAdmin,
  shiftDay,
  useAdminBarbers,
  useAdminServices,
} from "./shared";

export function AppointmentEditor({
  appointment: a,
  timezone,
  onClose,
}: {
  appointment: Appointment;
  timezone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient(),
    [cancel, setCancel] = useState(false),
    [move, setMove] = useState(false),
    [keys] = useState(() => ({
      cancel: crypto.randomUUID(),
      completed: crypto.randomUUID(),
      no_show: crypto.randomUUID(),
    }));
  const action = useMutation({
    mutationFn: (kind: "cancel" | "completed" | "no_show") =>
      api(
        "/admin/appointments/" +
          a.id +
          "/" +
          (kind === "cancel" ? "cancel" : "status"),
        post(kind === "cancel" ? {} : { status: kind }),
        keys[kind],
      ),
    onSuccess: async () => {
      await refreshAdmin(qc);
      onClose();
    },
  });
  if (move)
    return (
      <BookingEditor
        appointment={a}
        timezone={timezone}
        onClose={() => {
          setMove(false);
          onClose();
        }}
      />
    );
  return (
    <Dialog
      title={cancel ? "Отменить запись?" : "Детали записи"}
      onClose={() => !action.isPending && onClose()}
    >
      <span className={"badge " + a.status}>{statuses[a.status]}</span>
      <Details a={a} timezone={timezone} />
      {action.error && <ErrorBox error={action.error} />}{" "}
      {a.status === "confirmed" &&
        (cancel ? (
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setCancel(false)}>
              Оставить
            </button>
            <button
              className="danger-button"
              disabled={action.isPending}
              onClick={() => action.mutate("cancel")}
            >
              Да, отменить
            </button>
          </div>
        ) : (
          <div className="admin-detail-actions">
            <button
              className="secondary"
              onClick={() => setMove(true)}
              disabled={action.isPending}
            >
              Перенести
            </button>
            <button
              className="danger-button"
              onClick={() => setCancel(true)}
              disabled={action.isPending}
            >
              Отменить
            </button>
            {new Date(a.ends_at) < new Date() && (
              <>
                <button
                  className="primary"
                  disabled={action.isPending}
                  onClick={() => action.mutate("completed")}
                >
                  <Check size={17} />
                  Завершена
                </button>
                <button
                  className="secondary"
                  disabled={action.isPending}
                  onClick={() => action.mutate("no_show")}
                >
                  Неявка
                </button>
              </>
            )}
          </div>
        ))}
    </Dialog>
  );
}

export function BookingEditor({
  appointment,
  timezone,
  onClose,
}: {
  appointment?: Appointment;
  timezone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient(),
    services = useAdminServices(),
    barbers = useAdminBarbers();
  const [service, setService] = useState(appointment?.service_id || 1),
    [barber, setBarber] = useState(appointment?.barber_id || 1),
    [name, setName] = useState(appointment?.client_name || ""),
    [phone, setPhone] = useState(""),
    [day, setDay] = useState(dayKey(new Date(), timezone)),
    [start, setStart] = useState(""),
    [op, setOp] = useState({ fp: "", key: "" });
  const times = useQuery({
    queryKey: ["admin-slots", barber, service, day, appointment?.id],
    queryFn: () =>
      api<{ slots: string[] }>(
        `/admin/availability?barber_id=${barber}&service_id=${service}&day=${day}${appointment ? "&appointment_id=" + appointment.id : ""}`,
      ),
    enabled: !!barber && !!service,
  });
  const action = useMutation({
    mutationFn: () => {
      const payload = appointment
        ? { starts_at: start }
        : {
            barber_id: barber,
            service_id: service,
            starts_at: start,
            client_name: name,
            phone: phone || null,
          };
      const fp = JSON.stringify(payload),
        key = op.fp === fp ? op.key : crypto.randomUUID();
      setOp({ fp, key });
      return api(
        "/admin/appointments" +
          (appointment ? "/" + appointment.id + "/move" : ""),
        post(payload),
        key,
      );
    },
    onSuccess: async () => {
      await refreshAdmin(qc);
      onClose();
    },
    onError: () => times.refetch(),
  });
  return (
    <Dialog
      title={appointment ? "Перенести запись" : "Создать запись"}
      onClose={() => !action.isPending && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate();
        }}
      >
        {appointment ? (
          <p>
            {appointment.service_name} · {appointment.barber_name} ·{" "}
            {appointment.duration} мин. Исходная запись сохраняется до успешного
            переноса.
          </p>
        ) : (
          <>
            <label>
              Услуга
              <select
                value={service}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setService(id);
                  setBarber(
                    barbers.data?.find(
                      (b) => b.active && b.service_ids.includes(id),
                    )?.id || 0,
                  );
                  setStart("");
                }}
              >
                {services.data
                  ?.filter((s) => s.active)
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name} · {money(s.price)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Мастер
              <select
                value={barber}
                onChange={(e) => {
                  setBarber(Number(e.target.value));
                  setStart("");
                }}
              >
                {barbers.data
                  ?.filter((b) => b.active && b.service_ids.includes(service))
                  .map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Имя клиента
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Телефон (необязательно)
              <input
                type="tel"
                maxLength={32}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Дата
          <input
            type="date"
            min={dayKey(new Date(), timezone)}
            max={shiftDay(dayKey(new Date(), timezone), 29)}
            required
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setStart("");
            }}
          />
        </label>
        {times.isLoading ? (
          <Loading />
        ) : times.error ? (
          <ErrorBox error={times.error} />
        ) : (
          <label>
            Свободное время
            <select
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            >
              <option value="">Выберите время</option>
              {times.data?.slots.map((s) => (
                <option key={s} value={s}>
                  {timeLabel(s, timezone)}
                </option>
              ))}
            </select>
            {times.data?.slots.length === 0 && (
              <small>Нет свободного времени. Выберите другую дату.</small>
            )}
          </label>
        )}
        {action.error && <ErrorBox error={action.error} />}
        <button className="primary" disabled={action.isPending || !start}>
          {action.isPending
            ? "Сохраняем…"
            : appointment
              ? "Подтвердить перенос"
              : "Создать запись"}
          <Check size={18} />
        </button>
      </form>
    </Dialog>
  );
}


