import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../assets/scripts/surface.js');
function state(){assert.equal(typeof api.createReliefState,'function','Relief state not implemented');return api.createReliefState(['telegram','web','parsers']);}
test('only the latest selected expertise remains open after rapid clicks',()=>{
  const model=state();
  model.toggle('telegram');model.toggle('web');model.toggle('parsers');
  assert.equal(model.getSelected(),'parsers');
});
test('clicking an open expertise closes it; invalid selections preserve the current detail',()=>{
  const model=state();
  model.toggle('web');model.toggle('other');assert.equal(model.getSelected(),'web');
  model.toggle('web');assert.equal(model.getSelected(),null);
});
test('reset closes an expertise without removing valid future interactions',()=>{
  const model=state();model.toggle('telegram');model.reset();assert.equal(model.getSelected(),null);
  model.toggle('parsers');assert.equal(model.getSelected(),'parsers');
});
