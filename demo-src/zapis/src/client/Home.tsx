import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { api, money } from "../api";
import type { Appointment, Barber, Service } from "../types";
import { useApp } from "../context";
import { AppointmentCard, ErrorBox, Loading, Photo } from "../components";

export function Home() {
  const { user, config } = useApp();
  const services = useQuery({
    queryKey: ["services"],
    queryFn: () => api<Service[]>("/services"),
  });
  const barbers = useQuery({
    queryKey: ["barbers"],
    queryFn: () => api<Barber[]>("/barbers"),
  });
  const appointments = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<Appointment[]>("/appointments"),
    enabled: !!user,
  });
  const next = appointments.data
    ?.filter(
      (a) => a.status === "confirmed" && new Date(a.starts_at) > new Date(),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="open-hours">
            <span className="open-dot" />
            Для тех, кто ценит своё время
          </div>
          <h1>
            Время
            <br />
            для себя.
          </h1>
          <p>
            Хорошая стрижка. Свой мастер.
            <br />
            Удобное время — без звонков.
          </p>
          <Link className="primary hero-cta" to="/book">
            Выбрать время
            <ArrowRight size={20} />
          </Link>
          <span className="hero-footnote">
            <Clock3 size={15} />
            10:00–20:00 · по времени барбершопа
          </span>
        </div>
        <div className="hero-image">
          <Photo src="/demos/zapis/images/hero.webp" name="Барбер за работой" />
          <div className="image-caption">
            <span>Точность в деталях.</span>
            <Scissors size={24} />
          </div>
        </div>
      </section>
      {next && (
        <section className="next-section">
          <div className="section-heading">
            <h2>Ваша ближайшая запись</h2>
            <Link to="/appointments">
              Все записи
              <ChevronRight size={17} />
            </Link>
          </div>
          <AppointmentCard a={next} timezone={config.timezone} />
        </section>
      )}
      <section className="services-section">
        <div className="section-heading">
          <div>
            <h2>Просто выберите своё.</h2>
            <p>Четыре услуги. Ничего лишнего.</p>
          </div>
          <Scissors className="muted" size={27} />
        </div>
        {services.isLoading ? (
          <Loading />
        ) : services.error ? (
          <ErrorBox error={services.error} retry={() => services.refetch()} />
        ) : (
          <div className="service-list">
            {services.data?.map((s) => (
              <Link
                to={"/book?service=" + s.id}
                className="service-row"
                key={s.id}
              >
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                </div>
                <span className="duration">{s.duration} мин</span>
                <strong>{money(s.price)}</strong>
                <ArrowRight size={20} />
              </Link>
            ))}
            {services.data?.length === 0 && <p>Услуги пока не добавлены.</p>}
          </div>
        )}
      </section>
      <section className="barbers-section">
        <div className="section-heading">
          <div>
            <h2>В хороших руках.</h2>
            <p>Три мастера. Три взгляда на ваш стиль.</p>
          </div>
        </div>
        {barbers.isLoading ? (
          <Loading />
        ) : barbers.error ? (
          <ErrorBox error={barbers.error} retry={() => barbers.refetch()} />
        ) : (
          <div className="barber-grid">
            {barbers.data?.map((b) => (
              <Link
                to={"/book?barber=" + b.id}
                className="barber-preview"
                key={b.id}
              >
                <Photo src={b.photo} name={b.name} />
                <div className="barber-preview-title">
                  <h3>{b.name}</h3>
                  <ArrowRight size={20} />
                </div>
                <p>{b.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="demo-note">
        <ShieldCheck size={20} />
        <p>
          Это демонстрационный проект.
          <br />
          <span>
            Бренд и мастера вымышлены, изображения созданы ИИ. Реальные
            посещения не бронируются.
          </span>
          <br /><Link to="/demo">Как попробовать демо <ArrowRight size={14} /></Link>
        </p>
      </div>
    </>
  );
}


