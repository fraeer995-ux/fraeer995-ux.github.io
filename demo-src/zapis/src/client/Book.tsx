import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Scissors,
} from "lucide-react";
import { api, ApiError, dateLabel, money, post, timeLabel } from "../api";
import type { Appointment, Barber, Service } from "../types";
import { useApp } from "../context";
import { Details, ErrorBox, Loading, Photo } from "../components";

type Draft = {
  service_id: number;
  barber_id: number;
  starts_at: string;
  client_name: string;
  phone: string;
};
export function Book() {
  const { user, config } = useApp(),
    navigate = useNavigate(),
    qc = useQueryClient(),
    [search] = useSearchParams();
  const moveId = search.get("move");
  const original = useQuery({
    queryKey: ["appointment", moveId],
    queryFn: () => api<Appointment>("/appointments/" + moveId),
    enabled: !!moveId,
  });
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem("zapis-draft") || "null") || {
          service_id: Number(search.get("service")) || 0,
          barber_id: 0,
          starts_at: "",
          client_name: user?.name || "",
          phone: "",
        }
      );
    } catch {
      return {
        service_id: 0,
        barber_id: 0,
        starts_at: "",
        client_name: user?.name || "",
        phone: "",
      };
    }
  });
  const [step, setStep] = useState(0),
    [day, setDay] = useState("");
  const [permissionPending, setPermissionPending] = useState(false);
  const [op, setOp] = useState<{ fingerprint: string; key: string }>(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem("zapis-operation") || "null") || {
          fingerprint: "",
          key: "",
        }
      );
    } catch {
      return { fingerprint: "", key: "" };
    }
  });
  const services = useQuery({
    queryKey: ["services"],
    queryFn: () => api<Service[]>("/services"),
  });
  const barbers = useQuery({
    queryKey: ["barbers", draft.service_id],
    queryFn: () => api<Barber[]>("/barbers?service_id=" + draft.service_id),
    enabled: !!draft.service_id,
  });
  const service = services.data?.find((s) => s.id === draft.service_id),
    barber = barbers.data?.find((b) => b.id === draft.barber_id);
  const params = `barber_id=${draft.barber_id}&service_id=${draft.service_id}${moveId ? "&appointment_id=" + moveId : ""}`;
  const days = useQuery({
    queryKey: ["days", draft.barber_id, draft.service_id, moveId],
    queryFn: () =>
      api<{ day: string; available: boolean }[]>(
        "/availability/days?" + params,
      ),
    enabled: !!draft.barber_id && !!draft.service_id && step >= 2,
  });
  const times = useQuery({
    queryKey: ["slots", draft.barber_id, draft.service_id, day, moveId],
    queryFn: () =>
      api<{ slots: string[] }>("/availability?" + params + "&day=" + day),
    enabled: !!day && !!draft.barber_id && step >= 2,
  });
  useEffect(() => {
    if (original.data) {
      const a = original.data;
      setDraft({
        service_id: a.service_id,
        barber_id: a.barber_id,
        starts_at: "",
        client_name: a.client_name,
        phone: a.phone || "",
      });
      setStep(2);
    }
  }, [original.data]);
  useEffect(() => {
    if (!moveId) sessionStorage.setItem("zapis-draft", JSON.stringify(draft));
  }, [draft, moveId]);
  useEffect(() => {
    if (!day && days.data) {
      setDay(
        days.data.find((d) => d.available)?.day || days.data[0]?.day || "",
      );
    }
  }, [days.data, day]);
  const update = (value: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...value }));
  };
  const confirm = useMutation({
    mutationFn: async () => {
      const payload = moveId ? { starts_at: draft.starts_at } : {
        ...draft, phone: config.portfolio_mode ? "" : draft.phone,
      };
      const fingerprint = JSON.stringify({ id: moveId, ...payload });
      const key = op.fingerprint === fingerprint ? op.key : crypto.randomUUID();
      const value = { fingerprint, key };
      setOp(value);
      sessionStorage.setItem("zapis-operation", JSON.stringify(value));
      return api<Appointment>(
        moveId ? "/appointments/" + moveId + "/move" : "/appointments",
        post(payload),
        key,
      );
    },
    onSuccess: async (a) => {
      sessionStorage.removeItem("zapis-draft");
      sessionStorage.removeItem("zapis-operation");
      await qc.invalidateQueries({ queryKey: ["appointments"] });
      await qc.invalidateQueries({ queryKey: ["appointment"] });
      window.Telegram?.WebApp.HapticFeedback?.notificationOccurred("success");
      navigate("/success/" + a.id);
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        ["slot_conflict", "past_slot", "unavailable_service"].includes(
          error.code,
        )
      ) {
        update({ starts_at: "" });
        setStep(2);
        await qc.invalidateQueries({ queryKey: ["slots"] });
        await qc.invalidateQueries({ queryKey: ["days"] });
      }
    },
  });
  if (moveId && original.isLoading) return <Loading />;
  if (original.error) return <ErrorBox error={original.error} />;
  if (moveId && original.data && !original.data.can_change)
    return <ErrorBox error={original.data.change_reason} />;
  const submit = async () => {
    const tg = window.Telegram?.WebApp;
    if (
      tg?.initData &&
      !user?.can_message &&
      tg.isVersionAtLeast("6.9") &&
      tg.requestWriteAccess
    ) {
      setPermissionPending(true);
      await new Promise<void>((resolve) =>
        tg.requestWriteAccess!(() => resolve()),
      );
      setPermissionPending(false);
      await qc.invalidateQueries({ queryKey: ["me"] });
    }
    confirm.mutate();
  };
  return (
    <section className="booking-page">
      <Link
        className="back-link"
        to="/"
        onClick={(e) => {
          if (step > (moveId ? 2 : 0)) {
            e.preventDefault();
            setStep(step - 1);
            confirm.reset();
          }
        }}
      >
        <ArrowLeft size={18} />
        Назад
      </Link>
      <div className="booking-heading">
        <h1>{moveId ? "Перенести запись" : "Ваша следующая стрижка."}</h1>
        <p>
          {moveId
            ? "Выберите новое время. Текущая запись сохранится до подтверждения."
            : "Несколько шагов — и время за вами."}
        </p>
      </div>
      <ol className="steps">
        {["Услуга", "Мастер", "Время", "Подтверждение"].map((label, i) => (
          <li
            key={label}
            className={i === step ? "current" : i < step ? "done" : ""}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {step >= 2 && service && (
        <div className="booking-context">
          <Scissors size={22} />
          <div>
            <strong>{original.data?.service_name || service.name}</strong>
            <span>
              {barber?.name} · {original.data?.duration || service.duration} мин
              · {money(original.data?.price || service.price)}
            </span>
          </div>
          {!moveId && (
            <button className="text-button" onClick={() => setStep(0)}>
              Изменить
            </button>
          )}
        </div>
      )}
      {(services.error || barbers.error) && (
        <ErrorBox
          error={services.error || barbers.error}
          retry={() => {
            services.refetch();
            barbers.refetch();
          }}
        />
      )}
      {confirm.error && <ErrorBox error={confirm.error} />}
      {confirm.error instanceof ApiError && confirm.error.code === "portfolio_limit" && (
        <Link className="back-link" to="/appointments">Открыть мои записи <ArrowRight size={18} /></Link>
      )}
      {step === 0 && (
        <>
          <h2>С чего начнём?</h2>
          {services.isLoading ? (
            <Loading />
          ) : (
            <div className="select-services">
              {services.data?.map((s) => (
                <button
                  className={
                    "select-service " +
                    (draft.service_id === s.id ? "selected" : "")
                  }
                  key={s.id}
                  onClick={() => {
                    update({ service_id: s.id, barber_id: 0, starts_at: "" });
                    setDay("");
                    setStep(1);
                  }}
                >
                  <div className="choice-circle">
                    {draft.service_id === s.id && <Check size={15} />}
                  </div>
                  <div>
                    <h3>{s.name}</h3>
                    <p>{s.description}</p>
                    <span>{s.duration} минут</span>
                  </div>
                  <strong>{money(s.price)}</strong>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <h2>Выберите своего мастера</h2>
          <p className="muted">Все мастера ниже оказывают выбранную услугу.</p>
          {barbers.isLoading ? (
            <Loading />
          ) : (
            <div className="barber-choice-grid">
              {barbers.data?.map((b) => (
                <button
                  className={
                    "barber-choice " +
                    (draft.barber_id === b.id ? "selected" : "")
                  }
                  key={b.id}
                  onClick={() => {
                    update({ barber_id: b.id, starts_at: "" });
                    setDay("");
                    setStep(2);
                  }}
                >
                  <Photo src={b.photo} name={b.name} />
                  <div>
                    <h3>
                      {b.name}
                      <ArrowRight size={20} />
                    </h3>
                    <p>{b.description}</p>
                    <small>
                      {services.data
                        ?.filter((s) => b.service_ids.includes(s.id))
                        .map((s) => s.name)
                        .join(" · ")}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          )}
          {barbers.data?.length === 0 && (
            <div className="empty">
              Для этой услуги пока нет доступных мастеров.
              <button className="secondary" onClick={() => setStep(0)}>
                Выбрать другую услугу
              </button>
            </div>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <h2>Когда вам удобно?</h2>
          <p className="muted">Ближайшие 30 дней · {config.timezone}</p>
          {days.isLoading ? (
            <Loading />
          ) : days.error ? (
            <ErrorBox error={days.error} retry={() => days.refetch()} />
          ) : (
            <div className="calendar">
              <div className="calendar-heading">
                <CalendarDays size={19} />
                {day && dateLabel(day, config.timezone)}
              </div>
              <div className="date-grid">
                {days.data?.map((d) => (
                  <button
                    key={d.day}
                    disabled={!d.available}
                    aria-pressed={day === d.day}
                    aria-label={dateLabel(d.day, config.timezone)}
                    className={day === d.day ? "selected" : ""}
                    onClick={() => {
                      setDay(d.day);
                      update({ starts_at: "" });
                      confirm.reset();
                    }}
                  >
                    <span>
                      {new Date(d.day + "T12:00:00Z").toLocaleDateString(
                        "ru-RU",
                        { weekday: "short", timeZone: "UTC" },
                      )}
                    </span>
                    <strong>{d.day.slice(8)}</strong>
                    <span className="availability-dot" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {times.isLoading ? (
            <Loading />
          ) : times.error ? (
            <ErrorBox error={times.error} retry={() => times.refetch()} />
          ) : (
            <div className="time-groups">
              {["Утро", "День", "Вечер"].map((title, index) => {
                const group = times.data?.slots.filter((s) => {
                  const hour = Number(
                    timeLabel(s, config.timezone).slice(0, 2),
                  );
                  return index === 0
                    ? hour < 12
                    : index === 1
                      ? hour >= 12 && hour < 17
                      : hour >= 17;
                });
                return group?.length ? (
                  <div key={title}>
                    <h3>{title}</h3>
                    <div className="time-grid">
                      {group.map((s) => (
                        <button
                          key={s}
                          aria-pressed={draft.starts_at === s}
                          className={draft.starts_at === s ? "selected" : ""}
                          onClick={() => {
                            update({ starts_at: s });
                            confirm.reset();
                          }}
                        >
                          {timeLabel(s, config.timezone)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })}
              {times.data?.slots.length === 0 && (
                <div className="empty">
                  <Clock3 size={30} />
                  <h3>На этот день всё занято</h3>
                  <p>Выберите выделенный день в календаре.</p>
                  {days.data?.find((d) => d.available) && (
                    <button
                      className="secondary"
                      onClick={() =>
                        setDay(days.data!.find((d) => d.available)!.day)
                      }
                    >
                      Ближайшее свободное время
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="action-bar">
            <span>
              {draft.starts_at
                ? dateLabel(draft.starts_at, config.timezone, true) +
                  " в " +
                  timeLabel(draft.starts_at, config.timezone)
                : "Выберите свободное время"}
            </span>
            <button
              className="primary"
              disabled={!draft.starts_at}
              onClick={() => setStep(3)}
            >
              Продолжить
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
      {step === 3 && service && barber && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>Всё верно?</h2>
          <Details
            a={{
              ...draft,
              id: "",
              barber_name: barber.name,
              barber_photo: barber.photo,
              service_name: original.data?.service_name || service.name,
              price: original.data?.price || service.price,
              duration: original.data?.duration || service.duration,
              ends_at: "",
              status: "confirmed",
              version: 1,
              notification: "pending",
              can_change: true,
              change_reason: "",
            }}
            timezone={config.timezone}
          />
          {!moveId && (
            <div className="client-fields">
              <label>
                Ваше имя
                <input
                  value={draft.client_name}
                  onChange={(e) => update({ client_name: e.target.value })}
                  maxLength={100}
                  required
                  autoComplete="given-name"
                />
              </label>
              {!config.portfolio_mode && <label>
                Телефон <span className="muted">необязательно</span>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  maxLength={32}
                  autoComplete="tel"
                  placeholder="Можно оставить пустым"
                />
              </label>}
            </div>
          )}
          <p className="muted small">
            Это демонстрационная запись. Реальное посещение не бронируется.
            {config.portfolio_mode && <> Можно указать вымышленное имя. Телефон не требуется. Одновременно доступно до {config.portfolio_booking_limit} предстоящих записей.</>}
          </p>
          <div className="action-bar">
            <span>{money(original.data?.price || service.price)}</span>
            <button
              className="primary"
              disabled={
                permissionPending ||
                confirm.isPending ||
                !draft.client_name.trim()
              }
              type="submit"
            >
              {confirm.isPending
                ? "Сохраняем…"
                : moveId
                  ? "Подтвердить перенос"
                  : "Подтвердить запись"}
              <Check size={18} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}


