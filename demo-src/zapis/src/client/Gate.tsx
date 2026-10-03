import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Scissors } from "lucide-react";
import { api, post } from "../api";
import { useApp } from "../context";
import { ErrorBox } from "../components";

export function Gate({ children }: { children: React.ReactNode }) {
  const { user, config } = useApp(),
    qc = useQueryClient();
  const demo = useMutation({
    mutationFn: async () => {
      await api("/auth/demo", post());
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  if (user) return <>{children}</>;
  return (
    <section className="auth-gate">
      <Scissors size={40} />
      <h1>
        Всё начинается
        <br />с хорошей стрижки.
      </h1>
      <p>
        Откройте «Запись» через Telegram-бота, чтобы выбрать время и управлять
        своими записями.
      </p>
      {config.bot_url && (
        <a className="primary" href={config.bot_url} target="_blank" rel="noreferrer">
          Открыть бота <ArrowRight size={18} />
        </a>
      )}
      {config.portfolio_mode && <p className="small muted">Демо доступно всем. Ваши записи видны только вам и администратору проекта.</p>}
      {config.demo_mode && (
        <>
          <button
            className="primary"
            onClick={() => demo.mutate()}
            disabled={demo.isPending}
          >
            {demo.isPending ? "Открываем…" : "Открыть демо"}
            <ArrowRight size={18} />
          </button>
          <small>Тестовый клиент. Реальное посещение не бронируется.</small>
        </>
      )}
      {demo.error && <ErrorBox error={demo.error} />}
    </section>
  );
}


