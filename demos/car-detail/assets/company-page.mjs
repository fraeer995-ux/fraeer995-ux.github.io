import { loadCompany, applyCompany } from './company.mjs';

try {
  applyCompany(document, await loadCompany());
} catch {
  // Static document remains readable if the configuration cannot be loaded.
}
