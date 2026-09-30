import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../assets/scripts/projects.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const run = (name, ...args) => {
  assert.equal(typeof api[name], 'function', `${name} is not implemented`);
  return api[name](...args);
};
const profile = { displayName: 'fraeer995-ux', github: 'https://github.com/fraeer995-ux', telegram: null };
const project = { id: 'catalog', category: 'telegram', title: 'Каталог', description: { ru: 'Описание' }, technologies: ['Python'], links: { source: 'https://github.com/example/catalog' } };

test('empty portfolio is a valid starting state', () => {
  const result = run('normalizePortfolio', {profile, projects:[]});
  assert.deepEqual(result.projects, []);
  assert.equal(result.profile.github, 'https://github.com/fraeer995-ux');
  assert.deepEqual(result.issues, []);
});
test('invalid category does not hide valid projects', () => {
  const result = run('normalizePortfolio', {profile, projects:[{...project,id:'bad',category:'other'},project]});
  assert.deepEqual(result.projects.map(p => p.id), ['catalog']);
  assert.equal(result.issues.length, 1);
});
test('duplicate IDs keep the first valid project', () => {
  const result = run('normalizePortfolio', {profile, projects:[project,{...project,title:'Second'}]});
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].title, 'Каталог');
});
test('unsafe link schemes are rejected', () => {
  for (const value of ['javascript:alert(1)','data:text/html,hello','//example.com','file:///tmp/a',42]) assert.equal(run('safeExternalUrl',value),null);
  assert.equal(run('safeExternalUrl','https://example.com/work'),'https://example.com/work');
  assert.equal(run('safeExternalUrl','http://example.com/work'),'http://example.com/work');
});
test('local images stay in assets and external images require HTTPS', () => {
  assert.equal(run('safeImageUrl','assets/images/project.webp'),'assets/images/project.webp');
  assert.equal(run('safeImageUrl','https://example.com/image.png'),'https://example.com/image.png');
  for(const value of ['../secret.png','assets/../secret.png','assets/%2e%2e/secret.png','http://example.com/image.png','data:image/png;base64,a']) assert.equal(run('safeImageUrl',value),null);
});
test('missing English description preserves Russian content', () => {
  const result = run('normalizePortfolio',{profile,projects:[project]});
  assert.equal(result.projects[0].description.ru,'Описание');
  assert.ok(!result.projects[0].description.en);
});
test('malformed root produces a recoverable content error', () => {
  assert.equal(typeof api.normalizePortfolio,'function','normalization not implemented');
  for(const value of [null,[],{profile,projects:'bad'},{projects:[]}]) assert.throws(() => api.normalizePortfolio(value), /portfolio/i);
});
test('unsafe optional project links are removed without removing the project', () => {
  const result=run('normalizePortfolio',{profile,projects:[{...project,title:'<img src=x onerror=alert(1)>',links:{source:'javascript:alert(1)',demo:'https://example.com'}}]});
  assert.equal(result.projects.length,1);
  assert.equal(result.projects[0].title,'<img src=x onerror=alert(1)>');
  assert.equal(result.projects[0].links.source,null);
  assert.equal(result.projects[0].links.demo,'https://example.com/');
});
