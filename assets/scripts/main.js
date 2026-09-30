import { normalizePortfolio, createProjectSection } from './projects.js';
import { translate } from './copy.js';
import { readPreferences, savePreference } from './preferences.js';
import { applyLanguage, createLanguageController } from './language.js';
import { createTextTransition } from './text-transition.js';
import { createSurface } from './surface.js';
import { attachPointerEffects, watchPageLifecycle } from './interactions.js';

let storage=null;
try {storage=window.localStorage;} catch { /* Storage is optional. */ }
const preferences=readPreferences(storage);
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const root=document.documentElement;
root.dataset.theme=preferences.theme;
const themeButton=document.querySelector('#theme-toggle');
themeButton.setAttribute('data-i18n-aria-label',preferences.theme==='dark'?'themeLight':'themeDark');
if(matchMedia('(pointer: coarse)').matches)document.querySelector('[data-i18n="surfaceHint"]').dataset.i18n='surfaceTouchHint';
const pointerCleanup=attachPointerEffects(document,motionQuery);
let cardsCleanup=()=>{};
const section=createProjectSection({root:document.querySelector('#project-list'),status:document.querySelector('#project-status'),filters:document.querySelectorAll('[data-filter]'),translate,onCardsRendered(cards){cardsCleanup();cardsCleanup=attachPointerEffects(cards,motionQuery);}});
section.setLanguage(preferences.language);
applyLanguage(document,preferences.language);
const surface=createSurface({container:document.querySelector('#surface-container'),controls:{mode:document.querySelector('#surface-mode')},motionQuery});
let requestedLanguage=preferences.language;
const textTransition=createTextTransition(document,{reducedMotion:()=>motionQuery.matches});
let previousText=new Map();
const controller=createLanguageController({
  initialLanguage:preferences.language,
  reducedMotion:()=>motionQuery.matches,
  animatePhase:(phase,signal)=>phase==='in'?textTransition.play(previousText,signal):Promise.resolve(),
  commit(language) {
    const y=window.scrollY;
    previousText=textTransition.capture();
    section.setLanguage(language);applyLanguage(document,language);surface.refresh();
    window.scrollTo({top:y,behavior:'instant'});
  },
  persist(language) {
    savePreference(storage,'language',language);
    document.querySelector('#language-status').textContent=translate(language,'languageAnnouncement');
  }
});
document.querySelector('#language-toggle').addEventListener('click',()=>{
  requestedLanguage=requestedLanguage==='ru'?'en':'ru';
  controller.request(requestedLanguage).catch(()=>{
    section.setLanguage(requestedLanguage);applyLanguage(document,requestedLanguage);surface.refresh();
  });
});
let themeTimer,themeSerial=0,activeTransition=null,requestedTheme=preferences.theme;
function applyTheme(theme) {
  root.dataset.theme=theme;
  const key=theme==='dark'?'themeLight':'themeDark';
  themeButton.setAttribute('data-i18n-aria-label',key);
  themeButton.setAttribute('aria-label',translate(controller.getLanguage(),key));
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#1c1c1c':'#eeeeee';
  surface.setTheme(theme);savePreference(storage,'theme',theme);
}
function switchTheme() {
  requestedTheme=requestedTheme==='dark'?'light':'dark';
  const next=requestedTheme,id=++themeSerial;
  activeTransition?.skipTransition();
  if(motionQuery.matches){applyTheme(next);return;}
  if(typeof document.startViewTransition!=='function') {
    clearTimeout(themeTimer);root.classList.add('theme-transition');applyTheme(next);
    themeTimer=setTimeout(()=>root.classList.remove('theme-transition'),500);return;
  }
  const rect=themeButton.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  const transition=document.startViewTransition(()=>{if(id===themeSerial)applyTheme(next);});
  activeTransition=transition;
  transition.ready.then(()=>{
    if(id!==themeSerial || motionQuery.matches){transition.skipTransition();return;}
    root.animate({clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+radius+'px at '+x+'px '+y+'px)']},{duration:650,easing:'cubic-bezier(.22,.85,.24,1)',pseudoElement:'::view-transition-new(root)'});
  }).catch(()=>{if(id===themeSerial)applyTheme(next);});
  transition.finished.finally(()=>{if(activeTransition===transition)activeTransition=null;}).catch(()=>{});
}
applyTheme(preferences.theme);
themeButton.addEventListener('click',switchTheme);
const reduceTheme=()=>{if(motionQuery.matches)activeTransition?.skipTransition();};
motionQuery.addEventListener('change',reduceTheme);
let brandClicks=0,brandTimer;
document.querySelector('.brand').addEventListener('click',()=>{
  clearTimeout(brandTimer);brandClicks++;
  if(brandClicks===3){surface.setMode('orbit');brandClicks=0;}
  brandTimer=setTimeout(()=>{brandClicks=0;},700);
});
watchPageLifecycle(window,()=>{surface.destroy();pointerCleanup();cardsCleanup();clearTimeout(themeTimer);clearTimeout(brandTimer);activeTransition?.skipTransition();motionQuery.removeEventListener('change',reduceTheme);});
try {
  const response=await fetch('content/portfolio.json');
  if(!response.ok)throw new Error('Content unavailable');
  const {profile,projects,issues}=normalizePortfolio(await response.json());
  for(const name of document.querySelectorAll('[data-profile-name]'))name.textContent=profile.displayName;
  for(const link of document.querySelectorAll('[data-profile-github]'))link.href=profile.github;
  const telegram=document.querySelector('#telegram-contact');
  if(profile.telegram){telegram.href=profile.telegram;telegram.hidden=false;}
  if(issues.length)console.warn(issues.length+' invalid project entries skipped');
  section.setProjects(projects);
  applyLanguage(document,controller.getLanguage());surface.refresh();
} catch {section.setLoadError('Content unavailable');}
document.querySelector('#year').textContent=new Date().getFullYear();
