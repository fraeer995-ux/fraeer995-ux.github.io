import { useEffect, useRef, useId, useState } from "react";
import { AlertCircle, ArrowRight, Check, Scissors, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { Appointment } from "./types";
import { money, dateLabel, timeLabel, statuses } from "./api";

export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={20} />
      <div>
        {error instanceof Error ? error.message : String(error)}
        {retry && (
          <button className="text-button" onClick={retry}>
            Повторить
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span />
      Загружаем…
    </div>
  );
}
export function Photo({
  src,
  name,
  className = "",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={"photo " + className}>
      <span className="photo-fallback">
        <Scissors />
        <span>{name}</span>
      </span>
      <img
        src={src}
        alt={name}
        style={failed ? { display: "none" } : undefined}
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
        loading="lazy"
      />
    </div>
  );
}
export function AppointmentCard({
  a,
  timezone,
}: {
  a: Appointment;
  timezone: string;
}) {
  return (
    <Link className="appointment-card" to={"/appointments/" + a.id}>
      <div className="appointment-date">
        <strong>
          {new Date(a.starts_at).toLocaleDateString("ru-RU", {
            day: "2-digit",
            timeZone: timezone,
          })}
        </strong>
        <span>
          {new Date(a.starts_at).toLocaleDateString("ru-RU", {
            month: "short",
            timeZone: timezone,
          })}
        </span>
      </div>
      <div>
        <span className={"badge " + a.status}>{statuses[a.status]}</span>
        <h3>{a.service_name}</h3>
        <p>
          {timeLabel(a.starts_at, timezone)} · {a.barber_name} ·{" "}
          {money(a.price)}
        </p>
      </div>
      <ArrowRight size={20} />
    </Link>
  );
}
export function Details({ a, timezone }: { a: Appointment; timezone: string }) {
  return (
    <dl className="details">
      <div>
        <dt>Услуга</dt>
        <dd>{a.service_name}</dd>
      </div>
      <div>
        <dt>Мастер</dt>
        <dd>{a.barber_name}</dd>
      </div>
      <div>
        <dt>Дата</dt>
        <dd>{dateLabel(a.starts_at, timezone)}</dd>
      </div>
      <div>
        <dt>Время</dt>
        <dd>{timeLabel(a.starts_at, timezone)}</dd>
      </div>
      <div>
        <dt>Продолжительность</dt>
        <dd>{a.duration} минут</dd>
      </div>
      <div>
        <dt>Стоимость</dt>
        <dd>{money(a.price)}</dd>
      </div>
      <div>
        <dt>Ваше имя</dt>
        <dd>{a.client_name}</dd>
      </div>
      {a.phone && (
        <div>
          <dt>Телефон</dt>
          <dd>{a.phone}</dd>
        </div>
      )}
    </dl>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      requestAnimationFrame(() => {
        if (
          opener.current?.isConnected &&
          !document.querySelector("dialog[open]")
        ) {
          opener.current.focus();
        }
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const elements = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Закрыть диалог"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function SuccessMark() {
  return (
    <div className="success-mark">
      <Check size={34} />
    </div>
  );
}


