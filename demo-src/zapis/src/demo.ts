// Isolated browser simulation for the public portfolio, never a real booking API.
const storageKey='portfolio-zapis-v1'
let state:any
try { state=JSON.parse(localStorage.getItem(storageKey)||'null') } catch {}
const services=[['Мужская стрижка','Форма, текстура и укладка под ваш ритм жизни.',45,'1800'],['Стрижка и борода','Цельный образ: от силуэта стрижки до линии бороды.',75,'2800'],['Оформление бороды','Чёткие линии, правильная длина и уход.',30,'1200'],['Стрижка машинкой','Чистая форма и аккуратные переходы.',30,'1000']].map(([name,description,duration,price],i)=>({id:i+1,name,description,duration:Number(duration),price,active:true}))
const barbers=[['Марк','Классические стрижки и точные формы.',[1,2,3,4]],['Даниил','Современные фейды, текстура и укладка.',[1,2,4]],['Артём','Геометрия бороды и внимание к деталям.',[1,2,3]]].map(([name,description,service_ids],i)=>({id:i+1,name,description,service_ids,active:true,photo:'/demos/zapis/images/barber-'+(i+1)+'.webp'}))
if(!state) state={services,barbers,appointments:[],schedules:{},operations:{}}
const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{}}
const day=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)
function slots(params:URLSearchParams){
  const date=params.get('day')||day(new Date()),bid=Number(params.get('barber_id')),sid=Number(params.get('service_id')),ignore=params.get('appointment_id')
  const service=state.services.find((x:any)=>x.id===sid&&x.active),barber=state.barbers.find((x:any)=>x.id===bid&&x.active)
  if(!service||!barber||!barber.service_ids.includes(sid))return []
  const result:string[]=[]
  for(let minute=600;minute+service.duration<=1200;minute+=15){if(minute<885&&minute+service.duration>840)continue;const starts=new Date(`${date}T${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}:00+03:00`),ends=+starts+service.duration*60000;if(+starts<Date.now()+7200000)continue;if(state.appointments.some((a:any)=>a.id!==ignore&&a.barber_id===bid&&a.status==='confirmed'&&+new Date(a.starts_at)<ends&&+new Date(a.ends_at)>+starts))continue;result.push(starts.toISOString())}return result
}
export async function demoApi<T>(url:string,init:RequestInit={},operationKey?:string):Promise<T>{
  const u=new URL(url,'https://demo.local'),p=u.searchParams,path=u.pathname,method=init.method||'GET',body=typeof init.body==='string'?JSON.parse(init.body):{}
  const admin=path.startsWith('/admin'),normalized=admin?path.slice(6):path
  let out:any
  if(operationKey&&state.operations[operationKey])return structuredClone(state.operations[operationKey])
  if(path==='/config')out={demo_mode:true,portfolio_mode:true,portfolio_booking_limit:3,bot_url:null,timezone:'Europe/Moscow',change_cutoff_hours:2}
  else if(path==='/auth/me'||path==='/auth/demo')out={name:'Посетитель · демо',csrf:'browser-demo',can_message:false,demo:true}
  else if(path==='/admin/me'||path==='/admin/login')out={username:'Демо-администратор',csrf:'browser-demo'}
  else if(path.endsWith('/logout'))out={ok:true}
  else if(normalized==='/services'&&method==='GET')out=state.services.filter((s:any)=>admin||s.active)
  else if(normalized==='/barbers'&&method==='GET')out=state.barbers.filter((b:any)=>(admin||b.active)&&(!p.get('service_id')||b.service_ids.includes(Number(p.get('service_id')))))
  else if(/^\/services(?:\/\d+)?$/.test(normalized)&&admin){if(Number(body.price)<=0||Number(body.duration)<=0||!body.name?.trim())throw new Error('Проверьте название, цену и длительность');if(method==='POST'){out={...body,id:Date.now()};state.services.push(out);state.barbers.forEach((b:any)=>b.service_ids.push(out.id))}else{out=state.services.find((s:any)=>s.id===Number(normalized.split('/')[2]));Object.assign(out,body)}}
  else if(/^\/barbers\/\d+$/.test(normalized)&&admin){out=state.barbers.find((b:any)=>b.id===Number(normalized.split('/')[2]));Object.assign(out,body)}
  else if(/^\/barbers\/\d+\/schedule$/.test(normalized)&&admin){const bid=normalized.split('/')[2];if(method==='PUT')throw new Error('Изменение рабочего расписания доступно в серверной версии. Здесь можно бронировать, переносить и отменять тестовые записи.');out=state.schedules[bid]||{hours:Array.from({length:7},(_,weekday)=>[{weekday,start:'10:00',end:'20:00',kind:'work'},{weekday,start:'14:00',end:'14:45',kind:'break'}]).flat(),exceptions:[]}}
  else if(normalized==='/availability/days'){out=Array.from({length:30},(_,i)=>{const d=new Date(Date.now()+(i+1)*86400000),ds=day(d),params=new URLSearchParams(p);params.set('day',ds);return {day:ds,available:slots(params).length>0}})}
  else if(normalized==='/availability')out={slots:slots(p)}
  else if(normalized==='/appointments'&&method==='GET'){
    let items=state.appointments.filter((a:any)=>!p.get('barber_id')||a.barber_id===Number(p.get('barber_id')))
    if(p.get('status'))items=items.filter((a:any)=>a.status===p.get('status'))
    const from=p.get('day_from')||p.get('date_from')||p.get('from'),to=p.get('day_to')||p.get('date_to')||p.get('to')
    if(from)items=items.filter((a:any)=>day(new Date(a.starts_at))>=from)
    if(to)items=items.filter((a:any)=>day(new Date(a.starts_at))<=to)
    if(p.get('search'))items=items.filter((a:any)=>a.client_name.toLowerCase().includes(p.get('search')!.toLowerCase()))
    items.sort((a:any,b:any)=>a.starts_at.localeCompare(b.starts_at))
    const page=Number(p.get('page')||1),size=Number(p.get('page_size')||50)
    out=admin?{items:items.slice((page-1)*size,page*size),total:items.length,page,page_size:size}:items
  }
  else if(normalized==='/appointments'&&method==='POST'){
    const s=state.services.find((x:any)=>x.id===body.service_id),b=state.barbers.find((x:any)=>x.id===body.barber_id)
    if(!s||!b||!body.client_name?.trim())throw new Error('Выберите услугу, мастера и укажите имя')
    const params=new URLSearchParams({barber_id:String(b.id),service_id:String(s.id),day:day(new Date(body.starts_at))})
    if(!slots(params).includes(new Date(body.starts_at).toISOString()))throw new Error('Этот интервал уже занят. Выберите другое время.')
    if(!admin&&state.appointments.filter((a:any)=>a.status==='confirmed').length>=3)throw new Error('В демо можно иметь до трёх записей. Отмените одну из них.')
    out={id:crypto.randomUUID(),barber_id:b.id,barber_name:b.name,barber_photo:b.photo,service_id:s.id,service_name:s.name,starts_at:new Date(body.starts_at).toISOString(),ends_at:new Date(+new Date(body.starts_at)+s.duration*60000).toISOString(),price:s.price,duration:s.duration,client_name:body.client_name,phone:null,status:'confirmed',version:1,notification:'unavailable',can_change:true,change_reason:''};state.appointments.push(out)
  }
  else if(/^\/appointments\//.test(normalized)){
    const [, ,aid,action]=normalized.split('/');out=state.appointments.find((a:any)=>a.id===aid);if(!out)throw new Error('Запись не найдена')
    if(action==='cancel'){out.status='cancelled';out.can_change=false;out.version++}
    if(action==='status'){out.status=body.status;out.can_change=false;out.version++}
    if(action==='move'){const params=new URLSearchParams({barber_id:String(out.barber_id),service_id:String(out.service_id),day:day(new Date(body.starts_at)),appointment_id:out.id});if(!slots(params).includes(new Date(body.starts_at).toISOString()))throw new Error('Интервал занят. Исходная запись сохранена.');out.starts_at=new Date(body.starts_at).toISOString();out.ends_at=new Date(+new Date(body.starts_at)+out.duration*60000).toISOString();out.version++}
  }
  else throw new Error('Это действие доступно в серверной версии проекта.')
  if(method!=='GET'){if(operationKey)state.operations[operationKey]=structuredClone(out);save()}
  return structuredClone(out) as T
}


