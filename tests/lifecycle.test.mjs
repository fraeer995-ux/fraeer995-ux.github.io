import test from 'node:test';
import assert from 'node:assert/strict';
import * as interactions from '../assets/scripts/interactions.js';
test('back-forward cached pages keep their interactive resources',()=>{
  assert.equal(typeof interactions.watchPageLifecycle,'function','Page lifecycle protection is not implemented');
  const window=new EventTarget();let disposed=0;
  interactions.watchPageLifecycle(window,()=>disposed++);
  const cached=new Event('pagehide');cached.persisted=true;
  window.dispatchEvent(cached);
  assert.equal(disposed,0);
  const unloaded=new Event('pagehide');unloaded.persisted=false;
  window.dispatchEvent(unloaded);
  assert.equal(disposed,1);
});
