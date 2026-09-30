const allowed = {language:['ru','en'],theme:['dark','light']};
export function readPreferences(storage) {
  const values = {language:'ru',theme:'dark'};
  for (const key of Object.keys(values)) {
    try { const value = storage?.getItem('portfolio.'+key); if (allowed[key].includes(value)) values[key] = value; } catch { /* Private browsing can deny storage. */ }
  }
  return values;
}
export function savePreference(storage, key, value) {
  if (!allowed[key]?.includes(value)) return;
  try { storage?.setItem('portfolio.'+key, value); } catch { /* Preferences remain usable for this visit. */ }
}
