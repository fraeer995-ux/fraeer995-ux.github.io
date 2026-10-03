import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Scissors, Settings2 } from "lucide-react";
import { api, money, post, put } from "../api";
import type { Service } from "../types";
import { Dialog, ErrorBox, Loading } from "../components";
import { useAdminServices } from "./shared";

export function Services() {
  const data = useAdminServices(),
    [edit, setEdit] = useState<Service | null>(),
    qc = useQueryClient();
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Услуги</h1>
          <p>Цена и длительность сохраняются в истории каждой записи.</p>
        </div>
        <button className="primary" onClick={() => setEdit(null)}>
          <Plus size={18} />
          Добавить услугу
        </button>
      </div>
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox error={data.error} />
      ) : (
        <div className="admin-service-list">
          {data.data?.map((s) => (
            <div key={s.id}>
              <Scissors size={22} />
              <div>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
              </div>
              <span>{s.duration} мин</span>
              <strong>{money(s.price)}</strong>
              <span className="badge">{s.active ? "Активна" : "Скрыта"}</span>
              <button
                className="icon-button"
                aria-label={"Изменить " + s.name}
                onClick={() => setEdit(s)}
              >
                <Settings2 size={19} />
              </button>
            </div>
          ))}
        </div>
      )}
      {edit !== undefined && (
        <ServiceEditor
          service={edit}
          onClose={() => setEdit(undefined)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ["admin-services"] });
            await qc.invalidateQueries({ queryKey: ["services"] });
            setEdit(undefined);
          }}
        />
      )}
    </>
  );
}

function ServiceEditor({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(service?.name || ""),
    [description, setDescription] = useState(service?.description || ""),
    [duration, setDuration] = useState(service?.duration || 45),
    [price, setPrice] = useState(service?.price || "1800"),
    [active, setActive] = useState(service?.active ?? true);
  const save = useMutation({
    mutationFn: () =>
      api(
        service ? "/admin/services/" + service.id : "/admin/services",
        service
          ? put({ name, description, duration, price, active })
          : post({ name, description, duration, price, active }),
      ),
    onSuccess: onSaved,
  });
  return (
    <Dialog
      title={service ? "Изменить услугу" : "Новая услуга"}
      onClose={() => !save.isPending && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Название
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Описание
          <textarea
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Длительность, мин
            <input
              type="number"
              min={15}
              max={240}
              step={15}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <label>
            Стоимость, ₽
            <input
              type="number"
              min={0}
              max={100000}
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Доступна для записи
        </label>
        {save.error && <ErrorBox error={save.error} />}
        <button className="primary" disabled={save.isPending}>
          {save.isPending ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>
    </Dialog>
  );
}


