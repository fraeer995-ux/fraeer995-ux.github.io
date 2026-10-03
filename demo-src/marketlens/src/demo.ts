import seed from './snapshot.json'
// Browser-only portfolio adapter. No credentials, remote scraping or shared data.
const storageKey = 'portfolio-marketlens-v1'
let state: any
try { state = JSON.parse(localStorage.getItem(storageKey) || 'null') } catch {}
if (!state) state = structuredClone(seed)
const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch {} }
const id = () => Date.now()
const median = (a: number[]) => { a.sort((x,y)=>x-y); return a.length ? (a[Math.floor((a.length-1)/2)] + a[Math.floor(a.length/2)])/2 : null }
function all(p: URLSearchParams) {
  let items = state.products.items.filter((x:any)=>x.dataset === (p.get('dataset') || 'demo'))
  const collection = state.collections.find((c:any)=>c.id===Number(p.get('collection_id')))
  if (collection) items = items.filter((x:any)=>(collection.ids || collectionItems(collection.id)).includes(x.id))
  if (p.get('ids')) items = items.filter((x:any)=>p.get('ids')!.split(',').map(Number).includes(x.id))
  for (const field of ['marketplace','brand','seller']) if (p.get(field)) items = items.filter((x:any)=>x[field]===p.get(field))
  if (p.get('q')) items = items.filter((x:any)=>(x.title+' '+x.external_id).toLowerCase().includes(p.get('q')!.toLowerCase()))
  for (const [key,field,min] of [['min_price','price',true],['max_price','price',false],['min_rating','rating',true],['min_reviews','reviews',true]] as const) if(p.get(key)) items=items.filter((x:any)=>x[field]!=null && (min ? x[field]>=Number(p.get(key)) : x[field]<=Number(p.get(key))))
  if(p.get('available')) items=items.filter((x:any)=>String(x.available)===p.get('available'))
  const field=p.get('sort')||'updated_at', direction=p.get('direction')==='asc'?1:-1
  return [...items].sort((a:any,b:any)=>direction*(typeof a[field]==='number'?a[field]-b[field]:String(a[field]).localeCompare(String(b[field]),'ru')))
}
function collectionItems(cid:number) {
  return state.products.items.filter((x:any)=>cid===1?x.id<=20:cid===2?x.is_own:cid===3?x.id>20&&x.id<=32:x.price!=null&&x.price<2000).map((x:any)=>x.id)
}
export async function demoApi<T=any>(url:string, init:RequestInit={}):Promise<T> {
  const u=new URL(url,'https://demo.local'), path=u.pathname, p=u.searchParams, method=init.method||'GET'
  const body=typeof init.body==='string'?JSON.parse(init.body):{}
  let out:any
  const items=all(p)
  if(path==='/auth/me'||path==='/auth/login') out={username:'Демо · посетитель',csrf:'browser-demo'}
  else if(path==='/auth/logout') out={ok:true}
  else if(path==='/health') out={status:'ok',worker:false}
  else if(path==='/contexts') out=['Москва · обычная цена']
  else if(path==='/products') {const page=Number(p.get('page')||1),size=Number(p.get('page_size')||20);out={...state.products,items:items.slice((page-1)*size,page*size),total:items.length,page,page_size:size}}
  else if(/^\/products\/\d+$/.test(path)) {
    const pid=Number(path.split('/')[2]),product=state.products.items.find((x:any)=>x.id===pid)
    if(!product) throw new Error('Товар не найден')
    if(method==='PATCH') {product.is_own=p.get('is_own')==='true';out={ok:true}}
    else out={...state['product:'+pid],...product,image:product.image?.replace('/demo/','/demos/marketlens/demo/')}
  }
  else if(path==='/collections'&&method==='GET') out=state.collections.filter((c:any)=>c.dataset===(p.get('dataset')||'demo')).map((c:any)=>{const members=state.products.items.filter((x:any)=>(c.ids||collectionItems(c.id)).includes(x.id));return {...c,count:members.length,fresh:members.length,median_price:median(members.filter((x:any)=>x.price!=null).map((x:any)=>x.price))}})
  else if(path==='/collections'&&method==='POST') {out={...body,id:id(),ids:[],created_at:new Date().toISOString()};state.collections.push(out)}
  else if(/^\/collections\/\d+/.test(path)) {const c=state.collections.find((x:any)=>x.id===Number(path.split('/')[2]));if(!c)throw new Error('Подборка не найдена');if(method==='PUT')Object.assign(c,body);if(path.endsWith('/items'))c.ids=[...new Set([...(c.ids||collectionItems(c.id)),...body])];if(method==='DELETE')c.ids=(c.ids||collectionItems(c.id)).filter((x:number)=>x!==Number(path.split('/').pop()));out=c}
  else if(path==='/analytics') {
    const prices=items.filter((x:any)=>x.price!=null).map((x:any)=>x.price),known=items.filter((x:any)=>x.available!=null)
    out={...state.analytics,sample_size:items.length,unique_products:items.length,sellers:new Set(items.map((x:any)=>x.seller)).size,brands:new Set(items.map((x:any)=>x.brand)).size,median_price:median(prices),min_price:prices.length?Math.min(...prices):null,max_price:prices.length?Math.max(...prices):null,known_prices:prices.length,known_availability:known.length,availability_share:known.length?Math.round(1000*known.filter((x:any)=>x.available).length/known.length)/10:null,history:state.analytics.history.slice(-Number(p.get('days')||30))}
    if(!items.length)out={...out,history:[],price_distribution:[],rating_distribution:[],top_sellers:[],top_changes:[],average_rating:null,known_ratings:0,sources:[]}
    else {
      out.price_distribution=[0,1000,2000,3000,5000].map((v,i,a)=>({name:i===4?'5 000+ ₽':`${v}–${a[i+1]} ₽`,count:prices.filter((n:number)=>n>=v&&(i===4||n<a[i+1])).length}))
      out.rating_distribution=[{name:'До 4',min:0,max:4},{name:'4–4,5',min:4,max:4.5},{name:'4,5–4,8',min:4.5,max:4.8},{name:'4,8–5',min:4.8,max:5.1}].map(b=>({name:b.name,count:items.filter((x:any)=>x.rating!=null&&x.rating>=b.min&&x.rating<b.max).length}))
      const ratings=items.filter((x:any)=>x.rating!=null).map((x:any)=>x.rating)
      out.known_ratings=ratings.length;out.average_rating=ratings.length?Math.round(ratings.reduce((a:number,b:number)=>a+b,0)/ratings.length*100)/100:null
      out.history=out.history.map((h:any)=>{const values=items.map((x:any)=>state['product:'+x.id]?.history.find((v:any)=>v.date===h.date)?.price).filter((v:any)=>v!=null);return {...h,median:median(values),known:values.length}})
      for(const field of ['top_reviews','review_growth','price_changes'])out[field]=state.analytics[field].filter((x:any)=>items.some((v:any)=>v.id===x.id))
    }
  }
  else if(path==='/alerts'&&method==='GET') out={...state.alerts,events:state.alerts.events.filter((x:any)=>x.dataset===(p.get('dataset')||'demo')),rules:state.alerts.rules.filter((x:any)=>x.dataset===(p.get('dataset')||'demo')),telegram_configured:false}
  else if(path==='/alerts/read'){state.alerts.events.forEach((x:any)=>x.read=true);out={ok:true}}
  else if(path==='/alerts/rules'&&method==='POST'){out={...body,id:id(),enabled:true};state.alerts.rules.push(out)}
  else if(/^\/alerts\/rules\/\d+$/.test(path)){out=state.alerts.rules.find((x:any)=>x.id===Number(path.split('/').pop()));out.enabled=p.get('enabled')==='true'}
  else if(path==='/jobs/preview') {if(body.source!=='demo')throw new Error('В браузерном демо доступен только вымышленный источник');out={objects:body.inputs.length,params:body}}
  else if(path==='/jobs'&&method==='POST') {
    if(body.source!=='demo')throw new Error('Реальный сбор требует отдельного сервера. Здесь доступен демо-адаптер.')
    const inputs=body.inputs||[]
    inputs.forEach((x:string,i:number)=>{let product=state.products.items.find((a:any)=>a.external_id===x);if(!product){const template=state.products.items.find((a:any)=>a.id===(i%20)+1);product={...structuredClone(template),id:id()+i,product_id:id()+i,external_id:x,title:`Тестовый товар ${x}`,dataset:'demo',updated_at:new Date().toISOString(),price:1290+i*150};state.products.items.unshift(product);state['product:'+product.id]={...structuredClone(state['product:'+template.id]),product}}if(body.collection_id){const c=state.collections.find((a:any)=>a.id===body.collection_id);if(c)c.ids=[...new Set([...(c.ids||collectionItems(c.id)),product.id])]}})
    if(body.query_id){const q=state.searches.find((x:any)=>x.id===body.query_id);if(q){const run={id:id(),query_id:q.id,checked_at:new Date().toISOString(),depth:q.depth,context:q.context};q.runs.unshift(run);state['search:'+q.id]={...state['search:'+q.id],run}}}
    out={id:id(),dataset:'demo',status:'completed',source:'demo',kind:'collect',params:body,created_at:new Date().toISOString(),total:inputs.length,completed:inputs.length,success:inputs.length,failed:0,items:inputs.map((x:string)=>({id:id(),status:'success',input:{external_id:x},error:null})),counts:{completed:inputs.length}}
    state.jobs.unshift(out)
  }
  else if(path==='/jobs')out=state.jobs.filter((x:any)=>x.dataset===(p.get('dataset')||'demo'))
  else if(/^\/jobs\/\d+\//.test(path))throw new Error('Задания в браузерной версии завершаются сразу; фоновый worker доступен в серверной версии.')
  else if(path==='/schedules'&&method==='POST')throw new Error('Фоновое расписание требует сервера. В демо товары можно обновить вручную.')
  else if(path==='/schedules')out=[]
  else if(path==='/competitors'&&method==='GET')out=state.competitors.filter((x:any)=>x.dataset===(p.get('dataset')||'demo'))
  else if(path==='/competitors'&&method==='POST'){const product=state.products.items.find((x:any)=>x.id===body.own_variant_id);if(!product)throw new Error('Выберите свой товар');product.is_own=true;out={...body,id:id(),products:[{...product,relation:'own',difference_rub:0,difference_pct:0}],history:state['product:'+product.id].history.map((x:any)=>({date:x.date,[product.id]:x.price})),context:product.context};state.competitors.push(out)}
  else if(/^\/competitors\/\d+\/links/.test(path)){const group=state.competitors.find((x:any)=>x.id===Number(path.split('/')[2]));if(!group)throw new Error('Сравнение не найдено');if(method==='DELETE')group.products=group.products.filter((x:any)=>x.id!==Number(path.split('/').pop()));else{const product=state.products.items.find((x:any)=>x.id===body.variant_id);if(!product)throw new Error('Выберите товар');if(group.products.some((x:any)=>x.id===product.id))throw new Error('Товар уже добавлен');const own=group.products[0],delta=own.price!=null&&product.price!=null?own.price-product.price:null;group.products.push({...product,relation:body.relation,difference_rub:delta,difference_pct:delta!=null&&product.price?Math.round(delta/product.price*10000)/100:null});const history=state['product:'+product.id].history;group.history.forEach((x:any)=>x[product.id]=history.find((h:any)=>h.date===x.date)?.price??null)}out={ok:true}}
  else if(path==='/searches'&&method==='GET')out=state.searches.filter((x:any)=>x.dataset===(p.get('dataset')||'demo'))
  else if(path==='/searches'&&method==='POST'){if(body.source!=='demo')throw new Error('Реальная выдача требует серверного источника. В демо доступны вымышленные результаты.');out={...body,id:id(),runs:[]};state.searches.push(out);state['search:'+out.id]={items:[],missing:[],brands:[],sellers:[],run:null}}
  else if(/^\/searches\/\d+\/results$/.test(path)) {out=structuredClone(state['search:'+path.split('/')[2]]);if(p.get('run_id')){const q=state.searches.find((x:any)=>x.id===Number(path.split('/')[2]));out.run=q.runs.find((x:any)=>x.id===Number(p.get('run_id')))||out.run}}
  else if(path==='/sources')out=state.sources
  else if(path==='/integrations'&&method==='GET')out={items:[],encryption_configured:false,ozon_supported:false}
  else throw new Error('Это действие доступно в полной серверной версии. В браузерном демо попробуйте каталог, подборки, графики, добавление тестовых товаров и экспорт.')
  if(method!=='GET')save()
  const result=structuredClone(out)
  const images=(v:any)=>{if(!v||typeof v!=='object')return;if(typeof v.image==='string')v.image=v.image.replace('/demo/','/demos/marketlens/demo/');Object.values(v).forEach(images)}
  images(result)
  return result as T
}

function download(data:any, format:string) {
  const safe=(v:any)=>{let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
  const columns=[...new Set<string>(data.flatMap((x:any)=>Object.keys(x)))]
  const csv='\uFEFF'+[columns.join(';'),...data.map((x:any)=>columns.map(k=>safe(x[k])).join(';'))].join('\r\n')
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([format==='json'?JSON.stringify(data,null,2):csv],{type:format==='json'?'application/json':'text/csv;charset=utf-8'}));a.download='marketlens-demo.'+(format==='json'?'json':'csv');a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
export function setupDemo() {
  localStorage.setItem('marketlens-dataset','demo')
  document.addEventListener('click',e=>{const link=(e.target as HTMLElement).closest('a[href^="/api/export"]') as HTMLAnchorElement|null;if(!link)return;e.preventDefault();const p=new URL(link.href).searchParams;const scope=p.get('scope');let rows=all(p);if(scope==='history')rows=rows.flatMap((x:any)=>state['product:'+x.id]?.history||[]);if(scope==='competitors')rows=state.competitors.flatMap((x:any)=>x.products);if(scope==='positions')rows=state.searches.flatMap((x:any)=>state['search:'+x.id]?.items||[]);if(scope==='events')rows=state.alerts.events;download(rows,p.get('format')||'csv')})
}
