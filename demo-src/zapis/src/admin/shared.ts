import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Appointment, Service, Barber } from "../types";

export type Page = { items: Appointment[]; total: number; page: number };
export const useAdminServices = () =>
  useQuery({
    queryKey: ["admin-services"],
    queryFn: () => api<Service[]>("/admin/services"),
  });
export const useAdminBarbers = () =>
  useQuery({
    queryKey: ["admin-barbers"],
    queryFn: () => api<Barber[]>("/admin/barbers"),
  });
export function shiftDay(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function refreshAdmin(qc: ReturnType<typeof useQueryClient>) {
  await qc.invalidateQueries({
    predicate: (q) => String(q.queryKey[0]).startsWith("admin-"),
  });
  await qc.invalidateQueries({ queryKey: ["slots"] });
  await qc.invalidateQueries({ queryKey: ["days"] });
  await qc.invalidateQueries({ queryKey: ["appointments"] });
}


