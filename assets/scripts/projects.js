import { setLocalizedText } from './text-transition.js';
const categories = new Set(['telegram', 'web', 'parsers']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export function safeExternalUrl(value) {
  if (!nonempty(value)) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function safeImageUrl(value) {
  if (!nonempty(value)) return null;
  const remote = safeExternalUrl(value);
  if (remote) return remote.startsWith('https:') ? remote : null;
  try {
    const decoded = decodeURIComponent(value).replaceAll('\\', '/');
    if (!decoded.startsWith('assets/') || decoded.split('/').some(part => part === '..' || part === '.') || decoded.includes(':') || /[?#]/.test(decoded)) return null;
    return value;
  } catch { return null; }
}

export function normalizePortfolio(input) {
  if (!input || Array.isArray(input) || !input.profile || !nonempty(input.profile.displayName) || !safeExternalUrl(input.profile.github) || !Array.isArray(input.projects)) throw new Error('Invalid portfolio data');
  const issues = [], seen = new Set(), projects = [];
  for (const item of input.projects) {
    if (!item || !nonempty(item.id) || seen.has(item.id) || !categories.has(item.category) || !nonempty(item.title) || !nonempty(item.description?.ru) || !Array.isArray(item.technologies) || item.technologies.some(tech => !nonempty(tech))) {
      issues.push('Skipped invalid or duplicate project');
      continue;
    }
    seen.add(item.id);
    const localized = value => value && nonempty(value.ru) ? {ru:value.ru,en:nonempty(value.en) ? value.en : null} : null;
    projects.push({id:item.id,category:item.category,title:item.title,description:{ru:item.description.ru,en:nonempty(item.description.en) ? item.description.en : null},technologies:item.technologies,image:safeImageUrl(item.image),demoNote:localized(item.demoNote),tryIt:localized(item.tryIt),links:{demo:safeExternalUrl(item.links?.demo),source:safeExternalUrl(item.links?.source)}});
  }
  return {profile:{displayName:input.profile.displayName,github:safeExternalUrl(input.profile.github),telegram:safeExternalUrl(input.profile.telegram)},projects,issues};
}

export function createProjectSection({root, status, filters, onCardsRendered = () => {}, translate}) {
  const doc = root.ownerDocument;
  let projects = [], language = 'ru', filter = 'all', loadError = null;
  const text = key => translate(language, key);
  function element(tag, value, className) {
    const node = doc.createElement(tag);
    if (value != null) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function label(tag, key, className) {
    const node = element(tag, text(key), className);
    node.dataset.i18n = key;
    setLocalizedText(node,{ru:translate('ru',key),en:translate('en',key)},language);
    return node;
  }
  function render() {
    const visible = projects.filter(project => filter === 'all' || project.category === filter);
    root.replaceChildren();
    status.replaceChildren();
    status.hidden = !loadError && visible.length > 0;
    if (!status.hidden) {
      status.append(label('h3', loadError ? 'loadErrorTitle' : projects.length ? 'noResultsTitle' : 'emptyTitle'), label('p', loadError ? 'loadErrorDescription' : projects.length ? 'noResultsDescription' : 'emptyDescription'));
    }
    if (!loadError) for (const project of visible) {
      const card = element('article', null, 'project-card');
      card.dataset.tilt = '';
      card.dataset.projectId = project.id;
      if (project.image) {
        const image = element('img', null, 'project-image');
        image.src = project.image;
        image.alt = project.title;
        image.loading = 'lazy';
        image.addEventListener('error', () => image.remove(), {once:true});
        card.append(image);
      }
      const description = element('p', project.description[language] || project.description.ru);
      description.dataset.scrambleKey='project:'+project.id;
      setLocalizedText(description,project.description,language);
      description.lang = project.description[language] ? language : 'ru';
      card.append(element('h3',project.title), description);
      const tags = element('div',null,'project-tags');
      for (const tech of project.technologies) tags.append(element('span',tech));
      card.append(tags);
      for (const [key, className] of [['tryIt','project-try'],['demoNote','project-demo-note']]) if (project[key]) {
        const note = element('p',project[key][language] || project[key].ru,className);
        note.dataset.scrambleKey = 'project:'+project.id+':'+key;
        setLocalizedText(note,project[key],language);
        card.append(note);
      }
      const links = element('div',null,'project-links');
      for (const key of ['demo', 'source']) if (project.links[key]) {
        const link = label('a',key === 'demo' ? 'openProject' : 'sourceCode');
        link.href = project.links[key];
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.append(link);
      }
      card.append(links);
      root.append(card);
    }
    for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    onCardsRendered(root);
  }
  for (const button of filters) button.addEventListener('click', () => {filter = button.dataset.filter;render();});
  return {
    setProjects(value) { projects = value; loadError = null; render(); },
    setLanguage(value) { language = value; render(); },
    setLoadError(message) { loadError = message; render(); },
    getFilter() { return filter; }
  };
}
