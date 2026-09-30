import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../assets/scripts/copy.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('both languages cover every interface message',()=>{
  assert.ok(api.copy?.ru && api.copy?.en,'Translations are not implemented');
  assert.deepEqual(Object.keys(api.copy.ru).sort(),Object.keys(api.copy.en).sort());
  for(const language of ['ru','en']) for(const text of Object.values(api.copy[language])) assert.ok(typeof text==='string' && text.trim());
});
test('unknown language still provides Russian text',()=>{
  assert.equal(typeof api.translate,'function','Translation is not implemented');
  assert.equal(api.translate('unknown','navProjects'),'Проекты');
  assert.equal(api.translate('en','navProjects'),'Projects');
});
