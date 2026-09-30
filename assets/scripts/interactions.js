export function watchPageLifecycle(window,dispose) {
  const onHide=event=>{if(!event.persisted) dispose();};
  window.addEventListener('pagehide',onHide);
  return ()=>window.removeEventListener('pagehide',onHide);
}

export function attachPointerEffects(root,motionQuery) {
  const cleanup=[];
  const precise=matchMedia('(pointer: fine)');
  for(const node of root.querySelectorAll('[data-magnetic],[data-tilt]')) {
    const magnetic=node.hasAttribute('data-magnetic');
    const target=magnetic?node.parentElement:node;
    const reset=()=>{node.style.transform='';};
    const move=event=>{
      if(motionQuery.matches||!precise.matches||event.pointerType==='touch') return reset();
      const rect=target.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width-.5,y=(event.clientY-rect.top)/rect.height-.5;
      node.style.transform=magnetic?`translate(${Math.max(-6,Math.min(6,x*12))}px,${Math.max(-6,Math.min(6,y*12))}px)`:`perspective(900px) rotateX(${-y*10}deg) rotateY(${x*10}deg)`;
    };
    target.addEventListener('pointermove',move);target.addEventListener('pointerleave',reset);
    motionQuery.addEventListener('change',reset);precise.addEventListener('change',reset);
    cleanup.push(()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerleave',reset);motionQuery.removeEventListener('change',reset);precise.removeEventListener('change',reset);reset();});
  }
  return ()=>cleanup.forEach(fn=>fn());
}
