import { translate } from './copy.js';
import { setLocalizedText } from './text-transition.js';

export function applyLanguage(doc, language) {
  doc.documentElement.lang = language;
  for (const node of doc.querySelectorAll('[data-i18n]')) {
    setLocalizedText(node,{ru:translate('ru',node.dataset.i18n),en:translate('en',node.dataset.i18n)},language);
  }
  for (const attribute of ['aria-label','title']) for (const node of doc.querySelectorAll(`[data-i18n-${attribute}]`)) node.setAttribute(attribute,translate(language,node.getAttribute(`data-i18n-${attribute}`)));
  const name=doc.querySelector('[data-profile-name]')?.textContent || 'fraeer995-ux';
  doc.title = name+' — '+translate(language,'pageTitle');
  doc.querySelector('meta[property="og:title"]')?.setAttribute('content',doc.title);
  for (const selector of ['meta[name="description"]','meta[property="og:description"]']) doc.querySelector(selector)?.setAttribute('content',translate(language,'metaDescription'));
  const toggle=doc.querySelector('#language-toggle');
  toggle?.setAttribute('aria-label',translate(language,'languageToggle'));
  toggle?.setAttribute('aria-pressed',String(language==='en'));
}

export function createLanguageController({initialLanguage,commit,animatePhase,persist,reducedMotion}) {
  let language=initialLanguage, active=null;
  return {
    getLanguage() { return language; },
    async request(next) {
      if (!['ru','en'].includes(next)) return false;
      active?.abort();
      const task=new AbortController();
      active=task;
      const animate=next!==language && !reducedMotion();
      try {
        if(animate) await animatePhase('out',task.signal);
        if(task.signal.aborted) return false;
        commit(next);
        language=next;
        if(animate && !reducedMotion()) await animatePhase('in',task.signal);
        if(task.signal.aborted) return false;
        persist(next);
        if(active===task) active=null;
        return true;
      } catch(error) {
        if(error.name==='AbortError' || task.signal.aborted) return false;
        throw error;
      }
    }
  };
}
