import type { QueryClient } from '@tanstack/react-query'
import { demoApi } from './demo'
export let csrf = ''
export function setCsrf(value:string){csrf=value}
export async function api<T=any>(url:string, init:RequestInit={}) : Promise<T> {
  return demoApi<T>(url, init)
}
export function params(data:Record<string,unknown>){const p=new URLSearchParams();Object.entries(data).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=='')p.set(k,String(v))});return '?'+p.toString()}
export const money=(n:number|null|undefined)=>n==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+' ₽'
export const num=(n:number|null|undefined)=>n==null?'—':new Intl.NumberFormat('ru-RU').format(n)
export const date=(v:string|null|undefined)=>v?new Date(v).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—'
export const key=()=>crypto.randomUUID()
// A write may finish while the initial list request is still in flight.
// Cancel that cache result before refetching so older data cannot overwrite the mutation.
export async function refresh(client:QueryClient){await client.cancelQueries();return client.invalidateQueries()}
export const statuses:Record<string,string>={queued:'В очереди',running:'Выполняется',completed:'Завершено',partial:'Частично завершено',error:'Ошибка',cancelled:'Отменено',blocked:'Доступ ограничен',not_found:'Карточка не найдена',unverified:'Не подтверждено',ok:'Доступен',connected:'Подключено',pending:'Ожидание',success:'Успешно',rate_limited:'Лимит запросов',format_changed:'Изменился формат',auth_required:'Требуется ключ'}
export interface Product {id:number;product_id:number;external_id:string;variant_id:string;marketplace:string;title:string;brand:string|null;seller:string|null;category:string|null;image:string|null;price:number|null;original_price:number|null;rating:number|null;reviews:number|null;available:boolean|null;stock:number|null;updated_at:string;price_change:number|null;source:string;context:string;dataset:string;is_own:boolean;characteristics:Record<string,unknown>;missing:Record<string,string>;url:string|null;price_condition:string}

