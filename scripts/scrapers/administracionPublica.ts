import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent, validateLink } from './utils';

const BASE_URL = 'https://administracion.gob.es';
const SEARCH_TERMS = ['educacion infantil', 'educador infantil', 'tecnico educacion infantil'];
const RELEVANT = /educaci[oó]n infantil|educador(?:a)? infantil|t[eé]cnico(?:a)? (?:superior )?en educaci[oó]n infantil|jard[ií]n de infancia|maestro(?:a)?[^.]{0,40}infantil/i;

function absoluteUrl(href: string): string {
  return new URL(href, BASE_URL).toString();
}

function parseSpanishDate(value: string): Date | null {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

export async function scrapeAdministracionPublica(): Promise<ScrapedJob[]> {
  console.log('=== [Administración Pública] Buscando bolsas nacionales de Educación Infantil ===');
  const candidates = new Map<string, string>();

  for (const term of SEARCH_TERMS) {
    for (let page = 1; page <= 6; page++) {
      const searchUrl = `${BASE_URL}/pagFront/ofertasempleopublico/resultadosEmpleo.htm?tipoBusqueda=BOLSA_EMPLEO&txtClaveE=${encodeURIComponent(term)}&desde=${page}`;
      try {
        const response = await axios.get(searchUrl, {
          headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
          timeout: 12000
        });
        const $ = cheerio.load(response.data);
        $('a[href*="detalleEmpleo.htm?idConvocatoria="]').each((_, link) => {
          const title = clean($(link).text());
          const url = absoluteUrl($(link).attr('href') || '');
          if (title && RELEVANT.test(title)) candidates.set(url, title);
        });
        const totalPagesText = clean($('body').text()).match(/numPaginasTotales\s*[=:]\s*(\d+)/i)?.[1];
        if (page >= Math.min(Number(totalPagesText) || 6, 6)) break;
      } catch (error) {
        console.warn(`[Administración Pública] Error en "${term}" página ${page}:`, error instanceof Error ? error.message : error);
        break;
      }
    }
  }

  const jobs: ScrapedJob[] = [];
  for (const [url, listTitle] of candidates) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
        timeout: 12000
      });
      const $ = cheerio.load(response.data);
      const body = clean($('body').text());
      const title = clean(body.match(/Detalle de convocatoria\s+(.+?)\s+Ref:/i)?.[1] || listTitle);
      if (!RELEVANT.test(`${title} ${body}`)) continue;
      const deadlineText = body.match(/Hasta el\s+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)?.[1] || '';
      const deadline = parseSpanishDate(deadlineText);
      if (deadline && deadline.getTime() < Date.now()) continue;
      if (!(await validateLink(url, 'Administración Pública'))) continue;

      const ref = url.match(/idConvocatoria=(\d+)/i)?.[1] || url;
      const location = body.match(/(?:Comunidad Aut[oó]noma|Provincia)\s+([A-ZÁÉÍÓÚÑ][^|]{2,80})/i)?.[1]?.trim() || 'España';
      jobs.push({
        id: `administracion-${ref}`,
        title,
        companyName: 'Administración Pública Española',
        companyType: 'Bolsa de Empleo Público',
        location,
        province: location,
        contract: 'Bolsa / Interinidad',
        publishDate: deadlineText ? `Plazo hasta ${deadlineText}` : 'Convocatoria vigente',
        url,
        scrapedAt: new Date().toISOString(),
        source: 'Administración Pública',
        description: `Ficha oficial de bolsa de empleo público. ${body.slice(-900)}`,
        requirements: []
      });
    } catch (error) {
      console.warn(`[Administración Pública] No se pudo leer ${url}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`[Administración Pública] ${jobs.length} fichas nacionales vigentes verificadas.`);
  return jobs;
}
