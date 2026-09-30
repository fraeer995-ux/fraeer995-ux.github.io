const glyphs=Array.from('abcdefghijklmnopqrstuvwxyz{}<>/01');
const narrowGlyphs=Array.from('iljt/1');
const noise=(index,seed)=>{
  const value=Math.sin((index+1)*127.1+seed*311.7)*43758.5453;
  return value-Math.floor(value);
};

// A different reveal time for each letter, with a stable final result.
export function scrambleFrame(from,to,progress,seed=0) {
  const source=Array.from(from), target=Array.from(to);
  return target.map((character,index)=>{
    const delay=noise(index,seed)*.28;
    const end=.42+noise(index,seed+1)*.48;
    const settled=/\s/u.test(character) || progress>=end || progress>=1;
    if(settled)return {character,settled:true};
    if(progress<delay)return {character:source[index]&&!/\s/u.test(source[index])?source[index]:character,settled:false};
    const tick=Math.floor(progress*16);
    const pool=/[iljtI.,:!|]/u.test(character)?narrowGlyphs:glyphs;
    let glyph=pool[Math.floor(noise(index+tick*67,seed+2)*pool.length)];
    if(/\p{Lu}/u.test(character))glyph=glyph.toUpperCase();
    return {character:glyph,settled:false};
  });
}

// Both translations size the same grid cell; the visible copy occupies it too.
export function setLocalizedText(node,variants,language) {
  const doc=node.ownerDocument;
  node.classList.add('i18n');
  const visible=doc.createElement('span');
  visible.className='i18n-text i18n-copy';
  visible.textContent=variants[language] || variants.ru;
  const children=[visible];
  for(const locale of ['ru','en']) {
    const sizing=doc.createElement('span');
    sizing.className='i18n-sizing i18n-copy';
    sizing.setAttribute('aria-hidden','true');
    sizing.textContent=variants[locale] || variants.ru;
    children.push(sizing);
  }
  node.replaceChildren(...children);
}

const keyFor=node=>node.dataset.scrambleKey || node.dataset.i18n;
export function createTextTransition(doc,{reducedMotion,duration=860}) {
  const view=doc.defaultView;
  let serial=0;
  return {
    capture() {
      return new Map(Array.from(doc.querySelectorAll('.i18n'),node=>[keyFor(node),node.querySelector('.i18n-text')?.textContent || '']));
    },
    play(previous,signal) {
      if(signal.aborted || reducedMotion())return Promise.resolve();
      const entries=[], seed=++serial*13;
      for(const node of doc.querySelectorAll('.i18n')) {
        const visible=node.querySelector('.i18n-text');
        const target=visible?.textContent || '', from=previous.get(keyFor(node));
        const bounds=node.getBoundingClientRect();
        if(from==null || from===target || !bounds.width || !bounds.height || bounds.bottom<0 || bounds.top>view.innerHeight || bounds.right<0 || bounds.left>view.innerWidth)continue;
        const overlay=doc.createElement('span');
        overlay.className='i18n-scramble';
        overlay.setAttribute('aria-hidden','true');
        const slots=[], range=doc.createRange();
        let offset=0;
        for(const [index,character] of Array.from(target).entries()) {
          range.setStart(visible.firstChild,offset);
          offset+=character.length;
          range.setEnd(visible.firstChild,offset);
          if(/\s/u.test(character))continue;
          const rect=range.getBoundingClientRect();
          if(!rect.width)continue;
          const glyph=doc.createElement('span');
          glyph.className='scramble-glyph';
          glyph.style.left=(rect.left-bounds.left-node.clientLeft)+'px';
          glyph.style.top=(rect.top-bounds.top-node.clientTop)+'px';
          glyph.textContent=character;
          overlay.append(glyph);
          slots.push({index,glyph});
        }
        if(!slots.length)continue;
        node.append(overlay);
        node.classList.add('is-scrambling');
        entries.push({node,overlay,slots,from,target,seed:seed+entries.length*31});
      }
      if(!entries.length)return Promise.resolve();
      doc.documentElement.dataset.languageTransition='scramble';
      return new Promise((resolve,reject)=>{
        let raf=0, start=null, lastFrame=-1, finished=false;
        const finish=()=>{
          if(finished)return;
          finished=true;
          view.cancelAnimationFrame(raf);
          signal.removeEventListener('abort',abort);
          view.removeEventListener('resize',complete);
          doc.removeEventListener('visibilitychange',onVisibility);
          for(const {node,overlay} of entries){node.classList.remove('is-scrambling');overlay.remove();}
          delete doc.documentElement.dataset.languageTransition;
        };
        const complete=()=>{finish();resolve();};
        const abort=()=>{finish();reject(new DOMException('Aborted','AbortError'));};
        const onVisibility=()=>{if(doc.hidden)complete();};
        const render=time=>{
          if(signal.aborted){abort();return;}
          if(reducedMotion()){complete();return;}
          start??=time;
          const progress=Math.min(1,(time-start)/duration), frame=Math.floor(progress*24);
          if(frame!==lastFrame) {
            lastFrame=frame;
            for(const {slots,from,target,seed:entrySeed} of entries) {
              const characters=scrambleFrame(from,target,progress,entrySeed);
              for(const {index,glyph} of slots) {
                const slot=characters[index];
                if(glyph.textContent!==slot.character)glyph.textContent=slot.character;
                glyph.classList.toggle('is-settled',slot.settled);
              }
            }
          }
          if(progress>=1)complete();else raf=view.requestAnimationFrame(render);
        };
        signal.addEventListener('abort',abort,{once:true});
        view.addEventListener('resize',complete,{once:true});
        doc.addEventListener('visibilitychange',onVisibility);
        raf=view.requestAnimationFrame(render);
      });
    }
  };
}
