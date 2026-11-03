import { loadCompany } from './company.mjs';
import { api, visitorToken } from './supabase-client.mjs';
export * from './studio-domain.mjs';
let current = null;
async function decorate(state) {
 const company = await loadCompany();
 return { ...state, company, site: { ...state.site, brand: company.name }, contact: {
  phone: company.contact?.phone || '', location: company.contact?.address || '',
  hours: company.contact?.hours || '', email: company.contact?.email || '', privacyPolicyUrl: './legal/privacy.html'
 }};
}
export async function loadStudio({staff=false}={}) {
 const state = await api(staff ? 'staff-state' : 'public-state', staff ? {} : {visitorToken:visitorToken()}, {auth:staff});
 current = await decorate(state);
 return current;
}
export async function saveStudio(state) {
 const saved = await api('staff-save', {state,revision:state._revision}, {auth:true});
 current = await decorate(saved);
 globalThis.dispatchEvent?.(new Event('studio-change'));
 return current;
}
export function getStoredStudio() { return current; }
