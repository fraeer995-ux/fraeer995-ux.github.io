import { createContext, useContext, useEffect, useRef } from 'react'
import { LoaderCircle, X, Inbox, AlertCircle, ArrowDownRight, ArrowUpRight, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Product, money } from './api'

export const Workspace = createContext<{dataset:string;context:string;tell:(s:string)=>void;openAdd:()=>void}>({dataset:'demo',context:'Москва · обычная цена',tell:()=>{},openAdd:()=>{}})
export const useWorkspace=()=>useContext(Workspace)
export function Loading(){return <div className="state"><LoaderCircle className="spin" size={26}/><p>Загружаем данные…</p></div>}
export function Empty({title='В выборке пока нет данных',description='Добавьте товары, запустите сбор или импортируйте файл.',action}:{title?:string;description?:string;action?:React.ReactNode}){return <div className="state"><span className="empty-icon"><Inbox size={27}/></span><h3>{title}</h3><p>{description}</p>{action}</div>}
export function ErrorState({error,retry}:{error:Error;retry:()=>void}){return <div className="state error-state"><AlertCircle size={28}/><h3>Не удалось загрузить данные</h3><p>{error.message}</p><button onClick={retry} className="btn">Повторить</button></div>}
export function Modal({title,children,close,wide=false}:{title:string;children:React.ReactNode;close:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDivElement>(null)
 const closeRef=useRef(close)
 closeRef.current=close
 useEffect(()=>{const previous=document.activeElement as HTMLElement;document.body.style.overflow='hidden';ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current();if(e.key==='Tab'){const all=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]');if(!all?.length)return;const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};document.addEventListener('keydown',handler);return()=>{document.body.style.overflow='';document.removeEventListener('keydown',handler);previous?.focus()}},[])
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={'modal '+(wide?'wide':'')}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Закрыть" onClick={close}><X size={20}/></button></div>{children}</div></div>
}
export function Source({marketplace}:{marketplace:string}){return <span className={'source '+marketplace}><i/>{marketplace==='wb'?'WB':'Ozon'}</span>}
export function Change({value}:{value:number|null|undefined}){return value==null?<span className="muted">—</span>:<span className={'change '+(value<0?'down':value>0?'up':'neutral')}>{value<0?<ArrowDownRight size={13}/>:value>0?<ArrowUpRight size={13}/>:null}{value>0?'+':''}{value.toLocaleString('ru-RU',{maximumFractionDigits:1})}%</span>}
export function Available({value}:{value:boolean|null}){return <span className={'availability '+(value===true?'yes':value===false?'no':'unknown')}><i/>{value===true?'В наличии':value===false?'Нет в наличии':'Неизвестно'}</span>}
export function ProductName({product}:{product:Product}){return <Link className="product-cell" to={'/products/'+product.id}><span className="product-image">{product.image?<img src={product.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<Package size={21}/>}</span><span><b>{product.title}</b><small>{product.brand||'Бренд неизвестен'} <span>·</span> {product.external_id}</small></span></Link>}
export function PageHead({eyebrow,title,subtitle,actions}:{eyebrow?:string;title:string;subtitle:string;actions?:React.ReactNode}){return <div className="page-head"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{subtitle}</p></div><div className="head-actions">{actions}</div></div>}
export function Metric({label,value,note,icon}:{label:string;value:React.ReactNode;note:React.ReactNode;icon:React.ReactNode}){return <div className="metric"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><div className="metric-note">{note}</div></div>}
export function FormError({error}:{error:string}){return error?<div role="alert" className="form-error"><AlertCircle size={16}/>{error}</div>:null}
export const chartColor=['#4565e8','#5cb4a4','#b0a0dc','#eab36d','#8ba0bd']
export function PriceTooltip({active,payload,label}:any){return active&&payload?.length?<div className="chart-tooltip"><b>{label}</b>{payload.map((x:any)=><p key={x.dataKey} style={{color:x.color}}>{x.name}: {money(x.value)}</p>)}</div>:null}
