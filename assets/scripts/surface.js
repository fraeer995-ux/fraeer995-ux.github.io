// The visual relief shares one disclosure state across mouse, touch and keyboard.
export function createReliefState(categories) {
  const valid=new Set(categories);
  let selected=null;
  return {
    getSelected:()=>selected,
    toggle(category){if(valid.has(category))selected=selected===category?null:category;return selected;},
    reset(){selected=null;}
  };
}

export function createSurface({container,controls={},motionQuery}) {
  const doc=container.ownerDocument, view=doc.defaultView;
  const precise=view.matchMedia('(pointer: fine)');
  const rows=Array.from(container.querySelectorAll('[data-relief]'));
  const model=createReliefState(rows.map(row=>row.dataset.relief));
  const cursor=doc.querySelector('#relief-cursor');
  const cleanups=[];
  let frame=0,pending=null,mode='default',destroyed=false;
  const listen=(target,type,callback)=>{
    if(!target)return;
    target.addEventListener(type,callback);
    cleanups.push(()=>target.removeEventListener(type,callback));
  };
  function render() {
    for(const row of rows) {
      const open=model.getSelected()===row.dataset.relief;
      row.classList.toggle('is-open',open);
      row.querySelector('.relief-toggle').setAttribute('aria-expanded',String(open));
      const detail=row.querySelector('.relief-detail');
      detail.setAttribute('aria-hidden',String(!open));
      detail.inert=!open;
    }
    if(pending)cursor?.classList.toggle('is-open',model.getSelected()===pending.row.dataset.relief);
  }
  function refresh() {
    for(const row of rows) {
      const face=row.querySelector('.relief-face');
      const word=face.querySelector('.i18n-text')?.textContent || face.textContent;
      const layers=row.querySelector('.relief-layers');
      layers.replaceChildren(...Array.from({length:6},(_,index)=>{
        const layer=doc.createElement('span');
        layer.className=index<3?'relief-shadow':'relief-slice';
        layer.textContent=word;
        return layer;
      }));
    }
  }
  function clearPointer() {
    view.cancelAnimationFrame(frame);frame=0;pending=null;
    container.classList.remove('is-active');
    cursor?.classList.remove('is-visible');
    for(const row of rows) {
      row.classList.remove('is-hovered');
      for(const key of ['rx','ry','mx','my','lx','ly'])row.style.removeProperty('--'+key);
    }
  }
  function updatePointer() {
    frame=0;
    if(!pending || destroyed)return;
    const {row,x,y,rect}=pending;
    const rx=Math.max(-1,Math.min(1,(x-rect.left)/rect.width*2-1));
    const ry=Math.max(-1,Math.min(1,(y-rect.top)/rect.height*2-1));
    row.style.setProperty('--rx',rx);row.style.setProperty('--ry',ry);
    row.style.setProperty('--mx',rx);row.style.setProperty('--my',ry);
    row.style.setProperty('--lx',((rx+1)*50)+'%');row.style.setProperty('--ly',((ry+1)*50)+'%');
    row.classList.add('is-hovered');container.classList.add('is-active');
    if(cursor){cursor.style.transform='translate('+(x-23)+'px,'+(y-23)+'px)';cursor.classList.add('is-visible');cursor.classList.toggle('is-open',model.getSelected()===row.dataset.relief);}
  }
  for(const row of rows) {
    const button=row.querySelector('.relief-toggle');
    listen(button,'click',()=>{model.toggle(row.dataset.relief);render();});
    listen(button,'pointermove',event=>{
      if(motionQuery.matches || !precise.matches || event.pointerType==='touch')return;
      pending={row,x:event.clientX,y:event.clientY,rect:button.getBoundingClientRect()};
      if(!frame)frame=view.requestAnimationFrame(updatePointer);
    });
    listen(button,'pointerleave',clearPointer);
  }
  function setMode(next) {
    mode=next==='orbit'?'orbit':'default';
    container.classList.toggle('is-wireframe',mode==='orbit');
    controls.mode?.setAttribute('aria-pressed',String(mode==='orbit'));
  }
  listen(controls.mode,'click',()=>setMode(mode==='default'?'orbit':'default'));
  listen(controls.reset,'click',()=>{model.reset();setMode('default');render();clearPointer();});
  listen(motionQuery,'change',clearPointer);
  listen(precise,'change',clearPointer);
  listen(doc,'visibilitychange',()=>{if(doc.hidden)clearPointer();});
  listen(view,'resize',clearPointer);
  listen(view,'scroll',clearPointer);
  refresh();render();doc.documentElement.classList.remove('no-js');
  return {
    refresh,setMode,
    pulse(){if(rows.length){model.toggle(rows[0].dataset.relief);render();}},
    reset(){model.reset();setMode('default');render();clearPointer();},
    setTheme(){clearPointer();},
    destroy(){destroyed=true;clearPointer();cleanups.forEach(fn=>fn());}
  };
}
