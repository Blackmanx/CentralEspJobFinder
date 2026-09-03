import { ScrapedJob } from './types';

/**
 * Indeed currently serves authentication/anti-bot pages to this unattended
 * runner. Returning no data is safer than publishing a company page or a
 * stale hard-coded offer that a normal user cannot open.
 */
export async function scrapeIndeed(): Promise<ScrapedJob[]> {
  console.warn('[Indeed] Omitido: no se puede verificar una ficha accesible para usuarios normales.');
  return [];
}
