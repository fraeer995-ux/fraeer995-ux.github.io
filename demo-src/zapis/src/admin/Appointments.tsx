import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { api, dateLabel, money, statuses, timeLabel } from "../api";
import type { Appointment } from "../types";
import { ErrorBox, Loading } from "../components";
import { useAdminBarbers, type Page } from "./shared";
import { AppointmentEditor, BookingEditor } from "./BookingEditor";

export function Appointments({ timezone }: { timezone: string }) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [barber, setBarber] = useState(""),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Appointment>(),
    [create, setCreate] = useState(false);
  const barbers = useAdminBarbers();
  const params = new URLSearchParams({
    page: String(page),
    ...(from ? { day_from: from } : {}),
    ...(to ? { day_to: to } : {}),
    ...(barber ? { barber_id: barber } : {}),
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  });
  const data = useQuery({
    queryKey: ["admin-appointments", params.toString()],
    queryFn: () => api<Page>("/admin/appointments?" + params),
  });
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Записи</h1>
          <p>История и предстоящие посещения.</p>
        </div>
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={18} />
          Создать запись
        </button>
      </div>
      <div className="table-filters">
        <label>
          С даты
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          По дату
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Мастер
          <select
            value={barber}
            onChange={(e) => {
              setBarber(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все мастера</option>
            {barbers.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Статус
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все статусы</option>
            {Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Поиск клиента
          <input
            placeholder="Имя клиента"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox error={data.error} retry={() => data.refetch()} />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Дата и время</th>
                  <th>Клиент</th>
                  <th>Услуга</th>
                  <th>Мастер</th>
                  <th>Стоимость</th>
                  <th>Статус</th>
                  <th>
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data?.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {dateLabel(a.starts_at, timezone, true)}
                      <small>{timeLabel(a.starts_at, timezone)}</small>
                    </td>
                    <td>{a.client_name}</td>
                    <td>
                      {a.service_name}
                      <small>{a.duration} мин</small>
                    </td>
                    <td>{a.barber_name}</td>
                    <td>{money(a.price)}</td>
                    <td>
                      <span className={"badge " + a.status}>
                        {statuses[a.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Открыть запись " + a.client_name}
                        onClick={() => setSelected(a)}
                      >
                        <ChevronRight size={19} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.data?.items.length === 0 && (
              <div className="empty">По выбранным фильтрам записей нет.</div>
            )}
          </div>
          <div className="pagination">
            <span>
              {data.data?.total} записей · страница {page}
            </span>
            <button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Назад
            </button>
            <button
              className="secondary"
              disabled={page * 20 >= (data.data?.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              Далее
            </button>
          </div>
        </>
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


