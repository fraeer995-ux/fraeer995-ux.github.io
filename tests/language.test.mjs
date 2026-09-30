import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../assets/scripts/language.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function controller(options){assert.equal(typeof api.createLanguageController,'function','Language controller not implemented');return api.createLanguageController(options);}
test('latest language wins while an outgoing transition is pending',async()=>{
  const committed=[],saved=[];
  const instance=controller({initialLanguage:'ru',commit:l=>committed.push(l),persist:l=>saved.push(l),reducedMotion:()=>false,animatePhase:(_,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))});
  const first=instance.request('en');
  const last=instance.request('ru');
  assert.equal(await first,false);
  assert.equal(await last,true);
  assert.equal(instance.getLanguage(),'ru');
  assert.deepEqual(committed,['ru']);
  assert.deepEqual(saved,['ru']);
});
test('reduced motion commits once without running an animation',async()=>{
  const visible=[],saved=[];
  const instance=controller({initialLanguage:'ru',commit:l=>visible.push(l),persist:l=>saved.push(l),reducedMotion:()=>true,animatePhase:()=>{throw new Error('Animation must be disabled');}});
  assert.equal(await instance.request('en'),true);
  assert.deepEqual(visible,['en']);
  assert.deepEqual(saved,['en']);
  assert.equal(instance.getLanguage(),'en');
});
test('new selection cancels an incoming transition and replaces the committed language',async()=>{
  const visible=[],saved=[];
  let markIncoming;
  const incoming=new Promise(resolve=>markIncoming=resolve);
  let reduced=false;
  const instance=controller({initialLanguage:'ru',commit:l=>visible.push(l),persist:l=>saved.push(l),reducedMotion:()=>reduced,animatePhase:(phase,signal)=>phase==='out'?Promise.resolve():new Promise((resolve,reject)=>{markIncoming();signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});})});
  const first=instance.request('en');
  await incoming;
  reduced=true;
  const last=instance.request('ru');
  assert.equal(await first,false);assert.equal(await last,true);
  assert.deepEqual(visible,['en','ru']);assert.deepEqual(saved,['ru']);
});
test('invalid language requests leave current content intact',async()=>{
  const instance=controller({initialLanguage:'ru',commit:()=>{throw new Error('No update expected');},persist:()=>{},reducedMotion:()=>true,animatePhase:()=>{}});
  assert.equal(await instance.request('fr'),false);
  assert.equal(instance.getLanguage(),'ru');
});
