import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent } from './utils';

const LIST_URL = 'https://www.uam.es/uam/investigacion/ofertas-empleo';
const RELEVANT_TERMS = /educaci[oó]n|educational|education|infan|early childhood|child development|literacy|aprendizaje|learning|escuela|school|pedagog|teacher|docen|lenguaje|adolescen|youth/i;

interface UamCandidate {
  url: string;
  title: string;
  status: string;
  applicationLabel: string;
}

async function getHtml(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9'
      },
      timeout: 20000,
      validateStatus: () => true
    });
    return response.status === 200 && typeof response.data === 'string' ? response.data : null;
  } catch (error) {
    console.warn(`[UAM Investigación] No se pudo consultar ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

function parseDate(value: string): Date | null {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isStillRelevant(status: string, applicationLabel: string, now: Date): boolean {
  if (/cerrada|resuelta/i.test(status)) return false;
  const dates = [...applicationLabel.matchAll(/\d{1,2}\/\d{1,2}\/\d{4}/g)]
    .map(match => parseDate(match[0]))
    .filter((date): date is Date => Boolean(date));
  const endDate = dates.at(-1);
  return !endDate || endDate >= now;
}

export async function scrapeUamResearch(): Promise<ScrapedJob[]> {
  console.log('=== [UAM Investigación] Buscando contratos de investigación educativa ===');
  const html = await getHtml(LIST_URL);
  if (!html) return [];

  const $ = cheerio.load(html);
  const candidates: UamCandidate[] = [];
  const seenUrls = new Set<string>();
  const now = new Date();

  $('a.uam-becas-card[href*="/investigacion/oferta"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const url = new URL(href, LIST_URL).toString();
    if (seenUrls.has(url)) return;

    const status = clean($(element).find('.uam-becas-status').text());
    const applicationLabel = clean($(element).find('.uam-becas-date').text());
    if (!isStillRelevant(status, applicationLabel, now)) return;

    const title = clean($(element).attr('title') || $(element).find('p').text());
    if (!title) return;
    seenUrls.add(url);
    candidates.push({ url, title, status, applicationLabel });
  });

  const jobs: ScrapedJob[] = [];
  for (const candidate of candidates) {
    const detailHtml = await getHtml(candidate.url);
    if (!detailHtml) continue;

    const detail = cheerio.load(detailHtml);
    const title = clean(detail('main h1').first().text() || detail('h1').first().text() || candidate.title);
    const content = detail('main').clone();
    content.find('script, style, noscript').remove();
    const detailText = clean(content.text() || detail('body').text());
    if (!RELEVANT_TERMS.test(`${title} ${detailText}`)) continue;
    if (/estado\s*resuelta|oferta\s*(?:cerrada|finalizada)/i.test(detailText)) continue;

    const slug = new URL(candidate.url).pathname.split('/').filter(Boolean).at(-1) || String(jobs.length);
    jobs.push({
      id: `uam-investigacion-${slug}`,
      title,
      companyName: 'Universidad Autónoma de Madrid',
      companyType: 'Universidad Pública / Contrato de Investigación',
      companyWeb: LIST_URL,
      companyDesc: 'Ofertas oficiales de contratos y plazas de investigación de la UAM.',
      location: 'Madrid / Universidad Autónoma de Madrid',
      province: 'Madrid',
      contract: 'Contrato de investigación / Personal investigador',
      hours: 'Según las bases de la convocatoria',
      publishDate: candidate.applicationLabel || `Estado: ${candidate.status}`,
      url: candidate.url,
      scrapedAt: now.toISOString(),
      source: 'UAM Investigación',
      description: `${detailText.slice(0, 2200)} Fuente: convocatoria oficial UAM.`,
      requirements: ['Consultar requisitos, documentación y forma de solicitud en la ficha oficial enlazada.']
    });
  }

  console.log(`[UAM Investigación] ${jobs.length} contratos educativos vigentes o próximos encontrados.`);
  return jobs;
}
