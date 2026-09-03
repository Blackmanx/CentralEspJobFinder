import axios from 'axios';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent } from './utils';

const LIST_URLS = [
  'https://www.ucm.es/personal-contratado-de-actividades-cientifico-tecnicas-pli-ucm',
  'https://www.ucm.es/personal-de-apoyo-a-la-investigacion-pai-ucm'
];
const RELEVANT_TERMS = /educaci[oó]n|educational|education|infan|early childhood|child development|literacy|aprendizaje|learning|escuela|school|pedagog|teacher|docen|lenguaje|adolescen|youth/i;

interface UcmCandidate {
  url: string;
  publishedLabel: string;
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
    console.warn(`[UCM Investigación] No se pudo consultar ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function getPdfText(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': getRandomUserAgent(), Accept: 'application/pdf,*/*' },
      timeout: 30000,
      validateStatus: () => true
    });
    if (response.status < 200 || response.status >= 300) return '';
    const parsed = await pdfParse(Buffer.from(response.data));
    return clean(parsed.text);
  } catch (error) {
    console.warn(`[UCM Investigación] No se pudo leer el anexo ${url}:`, error instanceof Error ? error.message : error);
    return '';
  }
}

function parseDate(value: string): Date | null {
  const match = value.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getApplicationEndDate(text: string): Date | null {
  const match = text.match(/Inicio\s*:\s*\d{1,2}[-\/]\d{1,2}[-\/]\d{4}[\s\S]{0,120}?Final\s*:\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i);
  return match ? parseDate(match[1]) : null;
}

function isConcreteUcmPath(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return /^\/(?:pli|paii|pait)\d+-\d{2}\/?$/.test(path);
}

export async function scrapeUcmResearch(): Promise<ScrapedJob[]> {
  console.log('=== [UCM Investigación] Buscando contratos de investigación educativa ===');
  const candidates: UcmCandidate[] = [];
  const seenUrls = new Set<string>();
  const now = new Date();

  for (const listUrl of LIST_URLS) {
    const html = await getHtml(listUrl);
    if (!html) continue;
    const $ = cheerio.load(html);
    $('main a[href]').each((_, element) => {
      const url = new URL($(element).attr('href') || '', listUrl).toString();
      if (!isConcreteUcmPath(url) || seenUrls.has(url)) return;
      seenUrls.add(url);
      candidates.push({ url, publishedLabel: clean($(element).text()) });
    });
  }

  const jobs: ScrapedJob[] = [];
  for (const candidate of candidates) {
    const html = await getHtml(candidate.url);
    if (!html) continue;
    const $ = cheerio.load(html);
    const content = $('main').clone();
    content.find('script, style, noscript').remove();
    const mainText = clean(content.text());
    const endDate = getApplicationEndDate(mainText);
    if (!endDate || endDate < now) continue;

    const annex = $('main a').filter((_, element) => {
      const text = $(element).text().toLowerCase();
      return /anexo/.test(text) && /\/file\//i.test($(element).attr('href') || '');
    }).first();
    const annexUrl = annex.attr('href') ? new URL(annex.attr('href') || '', candidate.url).toString() : '';
    const annexText = annexUrl ? await getPdfText(annexUrl) : '';
    const searchableText = `${mainText} ${annexText}`;
    if (!RELEVANT_TERMS.test(searchableText)) continue;

    const titleCandidates = $('main h1, main h2').map((_, element) => clean($(element).text())).get();
    const title = titleCandidates.sort((left, right) => right.length - left.length)[0] || `Convocatoria UCM ${new URL(candidate.url).pathname}`;
    const slug = new URL(candidate.url).pathname.replace(/\//g, '-').replace(/^-|-$/g, '');
    const publishedDate = candidate.publishedLabel.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/)?.[0];

    jobs.push({
      id: `ucm-investigacion-${slug}`,
      title,
      companyName: 'Universidad Complutense de Madrid',
      companyType: 'Universidad Pública / Contrato de Investigación',
      companyWeb: 'https://www.ucm.es/pinves',
      companyDesc: 'Convocatorias oficiales de personal investigador de la UCM.',
      location: 'Madrid / Universidad Complutense de Madrid',
      province: 'Madrid',
      contract: 'Contrato de investigación / Personal investigador',
      hours: 'Según las bases de la convocatoria',
      publishDate: publishedDate ? `Publicado el ${publishedDate}` : 'Convocatoria vigente',
      url: candidate.url,
      scrapedAt: now.toISOString(),
      source: 'UCM Investigación',
      description: `${mainText.slice(0, 1700)}${annexText ? ` Detalle del anexo de plazas: ${annexText.slice(0, 1600)}` : ''}`,
      requirements: ['Consultar las bases, el anexo de plazas y la aplicación telemática en la convocatoria oficial enlazada.']
    });
  }

  console.log(`[UCM Investigación] ${jobs.length} contratos educativos vigentes encontrados.`);
  return jobs;
}
