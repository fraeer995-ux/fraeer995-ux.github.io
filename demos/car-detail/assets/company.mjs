// Company identity always comes from company.json, including on returning visits.
const rootURL = new URL('../', import.meta.url);

export async function loadCompany() {
  const response = await fetch(new URL('./company.json', import.meta.url), {
    cache: 'no-cache', credentials: 'omit',
  });
  if (!response.ok) throw new Error('Не удалось загрузить данные компании.');
  const company = await response.json();
  if (!company.name?.trim()) throw new Error('Укажите название компании в assets/company.json.');
  return company;
}

export function companyValues(company) {
  const contact = company.contact || {};
  const legal = company.legal || {};
  return {
    name: company.name,
    initials: company.initials || company.name.split(/\s+/).map(word => [...word][0]).slice(0, 2).join('').toUpperCase(),
    descriptor: company.descriptor || '',
    fullName: [company.name, company.descriptor].filter(Boolean).join(' '),
    locationLabel: ['Локация', contact.city].filter(Boolean).join(' / '),
    mapLabel: [company.name, contact.city].filter(Boolean).join(' / '),
    locationDescription: [company.name, contact.city, contact.address].filter(Boolean).join(' · '),
    installTitle: `${company.name} под рукой`,
    bookingLabel: `${company.name} / ОНЛАЙН-ЗАПИСЬ`,
    legalLabel: `${company.name} / ПРАВОВАЯ ИНФОРМАЦИЯ`,
    privacyLabel: `${company.name} / КОНФИДЕНЦИАЛЬНОСТЬ`,
    ...Object.fromEntries(Object.entries(contact).map(([key, value]) => [`contact.${key}`, value])),
    ...Object.fromEntries(Object.entries(legal).map(([key, value]) => [`legal.${key}`, value])),
    'legal.privacyEmail': legal.privacyEmail || contact.email || '',
    'legal.postalAddress': legal.postalAddress || legal.address || '',
  };
}

export function isMapConfigured(company) {
  const address = company?.contact?.address;
  const map = company?.map || {};
  return typeof address === 'string' && Boolean(address.trim())
    && typeof map.longitude === 'number' && Number.isFinite(map.longitude) && Math.abs(map.longitude) <= 180
    && typeof map.latitude === 'number' && Number.isFinite(map.latitude) && Math.abs(map.latitude) <= 90;
}

function assetURL(path) {
  if (!path) return '';
  const url = new URL(path, rootURL);
  return url.origin === rootURL.origin || /^data:image\/(png|jpeg|webp);base64,/.test(path) ? url.href : '';
}

export function applyCompany(root, company) {
  const values = companyValues(company);
  root.querySelectorAll('[data-company]').forEach(element => {
    element.textContent = values[element.dataset.company] || (element.hasAttribute('data-company-fallback') ? element.dataset.companyFallback : 'Не указано');
  });
  root.querySelectorAll('[data-company-logo]').forEach(element => {
    const src = assetURL(company.logo);
    element.classList.toggle('has-company-logo', Boolean(src));
    if (src) {
      const img = element.ownerDocument.createElement('img');
      img.src = src;
      img.alt = ''; // The containing brand link supplies the accessible company name.
      element.replaceChildren(img);
    } else {
      element.textContent = values.initials;
    }
  });
  root.querySelectorAll('[data-company-home]').forEach(link => {
    link.setAttribute('aria-label', `${company.name}, ${link.dataset.companyHome}`);
  });
  if (root.nodeType !== 9) return;

  const doc = root;
  doc.documentElement.dataset.companyName = company.name;
  if (doc.title.includes(' — ')) doc.title = `${doc.title.split(' — ')[0]} — ${company.name}`;
  else doc.title = `${company.name} | Детейлинг и уход за автомобилем`;
  const description = doc.querySelector('meta[name="description"]');
  if (description) description.content = company.description || company.name;
  const appTitle = doc.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appTitle) appTitle.content = company.name;
  for (const [selector, path] of [['link[rel="icon"]', company.favicon], ['link[rel="apple-touch-icon"]', company.appleTouchIcon]]) {
    const link = doc.querySelector(selector);
    if (link && assetURL(path)) {
      link.href = assetURL(path);
      link.removeAttribute('type');
    }
  }
  const hintIcon = doc.querySelector('.install-hint-icon');
  if (hintIcon) hintIcon.src = assetURL(company.logo || company.appIcon192);

  const map = company.map || {};
  const longitude = map.longitude, latitude = map.latitude;
  const valid = isMapConfigured(company);
  const embed = doc.querySelector('#map-embed');
  const mapLink = doc.querySelector('.location-open-map');
  if (embed && mapLink) {
    embed.dataset.mapConfigured = String(valid);
    const zoom = Math.max(1, Math.min(21, Number(map.zoom) || 14));
    const params = new URLSearchParams({ ll: `${longitude},${latitude}`, z: String(zoom), pt: `${longitude},${latitude},pm2rdm`, lang: 'ru_RU' });
    embed.dataset.mapSrc = valid ? `https://yandex.ru/map-widget/v1/?${params}` : '';
    embed.dataset.mapTitle = `Яндекс.Карта: ${values.locationDescription}`;
    mapLink.hidden = !valid;
    if (valid) mapLink.href = `https://yandex.ru/maps/?${params}`;
    const section = doc.querySelector('.location-section');
    if (section) section.hidden = !valid;
    doc.querySelector('.location-map').hidden = !valid;
  }
}
