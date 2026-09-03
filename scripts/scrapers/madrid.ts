import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent, validateLink } from './utils';

const LIST_URL = 'https://oficinavirtualempleo.comunidad.madrid/AreaPublica/Ofertas/';
const BASE_URL = 'https://oficinavirtualempleo.comunidad.madrid';
const TITLE_RELEVANT = /infantil|educaci[oó]n infantil|guarder[ií]a|niñ[oa]|monitor(?:a)?|animador(?:a)?|comedor escolar|aula infantil|ocio|ludoteca|extraescolar/i;
const CONTENT_RELEVANT = /infantil|guarder[ií]a|niñ[oa]|monitor(?:a)?|comedor escolar|aula infantil|menor(?:es)?|ocio infantil|ludoteca|extraescolar/i;

function absoluteUrl(href: string): string {
  return new URL(href, BASE_URL).toString();
}

function value($: cheerio.CheerioAPI, id: string): string {
  return clean($(`#${id}`).attr('value') || $(`#${id}`).text());
}

export async function scrapeMadrid(): Promise<ScrapedJob[]> {
  console.log('=== [Oficina Virtual Madrid] Buscando ofertas de infancia y educación ===');
  try {
    const response = await axios.get(LIST_URL, {
      headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    const candidates = new Map<string, string>();
    $('table#tablaTodasOfertas tr').each((_, row) => {
      const text = clean($(row).text());
      const href = $(row).find('a[href*="DetalleOferta"]').attr('href');
      if (href && TITLE_RELEVANT.test(text)) candidates.set(absoluteUrl(href), text);
    });

    const jobs: ScrapedJob[] = [];
    for (const [url, rowText] of candidates) {
      try {
        const detailResponse = await axios.get(url, {
          headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
          timeout: 12000
        });
        const detail$ = cheerio.load(detailResponse.data);
        const title = value(detail$, 'sie_nombrepuesto') || value(detail$, 'sie_ocupacionpreferidaid_name') || rowText;
        const occupation = value(detail$, 'sie_ocupacionpreferidaid_name');
        const rawDescription = value(detail$, 'observacionesov');
        if (!TITLE_RELEVANT.test(title) && !CONTENT_RELEVANT.test(rawDescription)) continue;
        const description = CONTENT_RELEVANT.test(rawDescription)
          ? rawDescription
          : `Oferta publicada en la Oficina Virtual de Empleo de Madrid para ${clean(title)}. Consulta la ficha oficial para conocer funciones y requisitos.`;
        const endDate = value(detail$, 'sie_fechafindifusioncm');
        const deadline = endDate ? new Date(endDate) : null;
        if (deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) continue;
        if (!(await validateLink(url, 'Oficina Virtual Madrid'))) continue;

        const id = new URL(url).searchParams.get('id') || url;
        const municipality = value(detail$, 'sie_municipiopuestotrabajoid_name') || 'Comunidad de Madrid';
        jobs.push({
          id: `madrid-oferta-${id}`,
          title: clean(title),
          companyName: 'Oficina Virtual de Empleo de la Comunidad de Madrid',
          companyType: 'Oferta de empleo',
          location: municipality,
          province: 'Madrid',
          contract: value(detail$, 'sie_tiporelacioncontractualid_name'),
          hours: value(detail$, 'sie_jornadatrabajoid_name'),
          salary: value(detail$, 'sie_salariomensualdesde'),
          publishDate: value(detail$, 'sie_fechainiciodifusioncm') || 'Reciente',
          url,
          scrapedAt: new Date().toISOString(),
          source: 'Oficina Virtual Madrid',
          description,
          requirements: []
        });
      } catch (error) {
        console.warn(`[Oficina Virtual Madrid] No se pudo leer ${url}:`, error instanceof Error ? error.message : error);
      }
    }
    console.log(`[Oficina Virtual Madrid] ${jobs.length} ofertas directas verificadas.`);
    return jobs;
  } catch (error) {
    console.warn('[Oficina Virtual Madrid] No se pudo consultar el listado:', error instanceof Error ? error.message : error);
    return [];
  }
}
