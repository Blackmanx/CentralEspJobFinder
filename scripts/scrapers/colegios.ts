import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent, validateLink } from './utils';

const LIST_URL = 'https://colegios.es/empleoprofesores/educacion-infantil/';
const BASE_URL = 'https://colegios.es';

function absoluteUrl(href: string): string {
  return new URL(href, BASE_URL).toString();
}

function firstText($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const selector of selectors) {
    const value = clean($(selector).first().text());
    if (value) return value;
  }
  return '';
}

export async function scrapeColegios(): Promise<ScrapedJob[]> {
  console.log('=== [Colegios.es] Buscando ofertas nacionales de Educación Infantil ===');
  try {
    const listResponse = await axios.get(LIST_URL, {
      headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
      timeout: 12000
    });
    const $ = cheerio.load(listResponse.data);
    const candidates = new Map<string, string>();

    $('script[type="application/ld+json"]').each((_, script) => {
      try {
        const json = JSON.parse($(script).contents().text());
        for (const item of json?.itemListElement || []) {
          if (typeof item?.url === 'string') candidates.set(absoluteUrl(item.url), clean(item?.name || ''));
        }
      } catch { /* Ignore unrelated JSON-LD blocks. */ }
    });
    $('a[href*="/empleoprofesores/"]').each((_, link) => {
      const url = absoluteUrl($(link).attr('href') || '');
      if (/\/empleoprofesores\/[^/]+-\d{8}\/?$/i.test(new URL(url).pathname)) {
        candidates.set(url, clean($(link).text()));
      }
    });

    const jobs: ScrapedJob[] = [];
    for (const [url, listTitle] of candidates) {
      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
          timeout: 12000
        });
        const detail$ = cheerio.load(response.data);
        const body = clean(detail$('body').text());
        if (/oferta\s+(cerrada|finalizada)|ya no est[aá] disponible/i.test(body)) continue;
        const title = firstText(detail$, ['h2', 'h1']) ||
          clean(detail$('meta[property="og:title"]').attr('content') || '') || listTitle;
        if (!title || !(await validateLink(url, 'Colegios.es'))) continue;

        const description = clean(detail$('div[itemprop="description"]').first().text());
        const province = clean(detail$('span[itemprop="addressRegion"]').first().text()) ||
          firstText(detail$, ['.provincia', '[class*="provincia"]', '[class*="ubicacion"]']) || 'España';
        const postedAt = clean(detail$('[itemprop="datePosted"]').first().text());
        const isoDate = postedAt.match(/(\d{4})-(\d{2})-(\d{2})/);
        const date = isoDate ? `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}` : 'Reciente';
        const hours = clean(detail$('[itemprop="employmentType"]').attr('content') || '');
        const cleanDescription = description || `Oferta de Educación Infantil publicada en Colegios.es para ${title}.`;
        const id = url.match(/-(\d{8})\/?$/)?.[1] || url;
        jobs.push({
          id: `colegios-${id}`,
          title,
          companyName: 'Centro educativo privado o concertado',
          companyType: 'Colegio / Escuela Infantil Privada o Concertada',
          location: province,
          province,
          hours,
          publishDate: date,
          url,
          scrapedAt: new Date().toISOString(),
          source: 'Colegios.es',
          description: cleanDescription,
          requirements: []
        });
      } catch (error) {
        console.warn(`[Colegios.es] No se pudo leer ${url}:`, error instanceof Error ? error.message : error);
      }
    }
    console.log(`[Colegios.es] ${jobs.length} ofertas nacionales verificadas.`);
    return jobs;
  } catch (error) {
    console.warn('[Colegios.es] No se pudo consultar el listado:', error instanceof Error ? error.message : error);
    return [];
  }
}
