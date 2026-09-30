import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../assets/scripts/preferences.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const run=(key,...args)=>{assert.equal(typeof api[key],'function',key+' not implemented');return api[key](...args);};
test('unavailable storage keeps a usable default state',()=>{
  const storage={getItem(){throw new Error('Denied');},setItem(){throw new Error('Denied');}};
  assert.deepEqual(run('readPreferences',storage),{language:'ru',theme:'dark'});
  assert.doesNotThrow(()=>run('savePreference',storage,'language','en'));
});
test('unknown stored values are ignored',()=>{
  assert.deepEqual(run('readPreferences',{getItem:()=> 'unexpected'}),{language:'ru',theme:'dark'});
});
test('language and theme are read independently',()=>{
  const values=new Map([['portfolio.language','en'],['portfolio.theme','light']]);
  assert.deepEqual(run('readPreferences',{getItem:key=>values.get(key)}),{language:'en',theme:'light'});
});
test('only valid preferences can be persisted',()=>{
  const values=new Map(), storage={setItem:(key,value)=>values.set(key,value)};
  run('savePreference',storage,'language','en');
  run('savePreference',storage,'theme','light');
  run('savePreference',storage,'language','xx');
  run('savePreference',storage,'unknown','private');
  assert.deepEqual([...values],[['portfolio.language','en'],['portfolio.theme','light']]);
});
