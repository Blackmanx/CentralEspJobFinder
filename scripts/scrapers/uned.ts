import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent, validateLink } from './utils';

const ARCHIVE_ENDPOINT = 'https://www.uned.es/universidad/inicio/en/unidad/bici/hemeroteca/main/0';
const ARCHIVE_PAGE = 'https://www.uned.es/universidad/inicio/en/unidad/bici/hemeroteca.html';
const BICI_SITE = 'https://bici.uned.es';
const DAY_MS = 24 * 60 * 60 * 1000;

const spanishMonths = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

interface BiciIssue {
  number: number;
  date: Date;
  archiveUrl: string;
}

function parseIssue(text: string, href: string): BiciIssue | null {
  const match = text.match(/BICI\s*N?\.?\s*(\d+)\s*\((\d{1,2})\/(\d{1,2})\/(\d{4})\)/i);
  if (!match) return null;

  const issueDate = new Date(Number(match[4]), Number(match[3]) - 1, Number(match[2]));
  if (Number.isNaN(issueDate.getTime())) return null;

  return {
    number: Number(match[1]),
    date: issueDate,
    archiveUrl: new URL(href, ARCHIVE_ENDPOINT).toString()
  };
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')} de ${spanishMonths[date.getMonth()]} de ${date.getFullYear()}`;
}

function articleUrl(issue: BiciIssue): string {
  const day = String(issue.date.getDate()).padStart(2, '0');
  const month = String(issue.date.getMonth() + 1).padStart(2, '0');
  return `${BICI_SITE}/${issue.date.getFullYear()}/bici-n-o-${issue.number}-${day}-${month}-${issue.date.getFullYear()}/`;
}

function isRelevantResearchCall(title: string, body: string): boolean {
  const titleNormalized = title.toLowerCase();
  const normalized = `${title} ${body}`.toLowerCase();
  if (/resoluci[oó]n|designa(?:ci[oó]n)?|adjudicaci[oó]n|candidato(?:a)? elegido/.test(titleNormalized)) return false;

  const isCall = /contrato\s+(?:laboral|de\s+investigaci[oó]n)|convocatoria[\s\S]{0,120}(?:contrat|plaza.*investig)|oferta[\s\S]{0,120}(?:empleo|contrato)/.test(titleNormalized);
  const titleIsEducationRelated =
    /educaci[oó]n|educational|education|infan|child|literacy|alfabetizaci[oó]n|escuela|school|pedagog|maestr[oa]|teacher|docen/.test(titleNormalized);
  const bodyIsEducationRelated =
    /educaci[oó]n\s+(?:infantil|primaria|secundaria|especial)|early childhood|child development|emergent literacy|alfabetizaci[oó]n emergente|educational research|school-based|pedagog/.test(body.toLowerCase());

  return isCall && (titleIsEducationRelated || bodyIsEducationRelated);
}

function extractSection($: cheerio.CheerioAPI, heading: cheerio.Element): string {
  const parts: string[] = [];
  let sibling = $(heading).next();

  while (sibling.length) {
    const tag = sibling[0]?.tagName?.toLowerCase();
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') break;
    const text = clean(sibling.text());
    if (text) parts.push(text);
    sibling = sibling.next();
  }

  return parts.join(' ');
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
    console.warn(`[UNED BICI] No se pudo consultar ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function findCurrentYearIssues(currentYear: number): Promise<BiciIssue[]> {
  const yearStart = new Date(currentYear, 0, 1);
  const issues = new Map<string, BiciIssue>();

  for (let offset = 0; offset <= 100; offset += 10) {
    const endpoint = `${ARCHIVE_ENDPOINT}?offset=${offset}`;
    const html = await getHtml(endpoint);
    if (!html) break;

    const $ = cheerio.load(html);
    const pageIssues: BiciIssue[] = [];
    $('a[href*="idBici="]').each((_, element) => {
      const issue = parseIssue(clean($(element).text()), $(element).attr('href') || '');
      if (!issue) return;
      pageIssues.push(issue);
      issues.set(`${issue.number}-${issue.date.toISOString().slice(0, 10)}`, issue);
    });

    if (!pageIssues.length || pageIssues.every(issue => issue.date < yearStart)) break;
  }

  return [...issues.values()]
    .filter(issue => issue.date >= yearStart && issue.date.getFullYear() === currentYear)
    .sort((left, right) => right.date.getTime() - left.date.getTime());
}

/**
 * Reads the official BICI archive instead of the retired UNED employment page.
 * Every result points to the concrete WordPress article and is retained for the
 * whole calendar year; old entries are explicitly marked for the user.
 */
export async function scrapeUnedBici(): Promise<ScrapedJob[]> {
  console.log('=== [UNED BICI] Buscando contratos de investigación en Educación e Infancia ===');

  const now = new Date();
  const currentYear = now.getFullYear();
  const issues = await findCurrentYearIssues(currentYear);
  const collectedJobs: ScrapedJob[] = [];
  const seenKeys = new Set<string>();

  for (const issue of issues) {
    const url = articleUrl(issue);
    const html = await getHtml(url);
    if (!html) continue;

    const $ = cheerio.load(html);
    $('h4').each((index, element) => {
      const title = clean($(element).text());
      const body = extractSection($, element);
      if (!isRelevantResearchCall(title, body)) return;

      const key = `${issue.number}-${title.toLowerCase()}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const concreteUrl = `${url}#:~:text=${encodeURIComponent(title.slice(0, 180))}`;
      const ageInDays = (now.getTime() - issue.date.getTime()) / DAY_MS;
      const dateFormatted = formatDate(issue.date);

      collectedJobs.push({
        id: `uned-bici-${issue.date.getTime()}-${issue.number}-${index}`,
        title,
        companyName: 'UNED - Vicerrectorado de Investigación (BICI)',
        companyLogo: 'https://www.uned.es/universidad/inicio/.resources/site-uned/webresources/img/uned_logo.svg',
        companyType: 'Universidad Pública / Contrato de Investigación',
        companyWeb: issue.archiveUrl,
        companyDesc: 'Convocatorias de contratos y plazas de investigación de la UNED publicadas en el BICI.',
        location: 'Madrid / UNED Sede Central',
        province: 'Madrid',
        hours: 'Según las bases de la convocatoria',
        contract: 'Contrato laboral de investigación / Proyecto',
        salary: 'Según las bases de la convocatoria BICI',
        publishDate: dateFormatted,
        isOlderThanMonth: ageInDays > 30,
        url: concreteUrl,
        scrapedAt: now.toISOString(),
        source: 'UNED BICI Investigación',
        description: `${body.slice(0, 2200)} Publicado en el BICI nº ${issue.number} de ${dateFormatted}.`,
        requirements: ['Consultar las bases y requisitos completos en la convocatoria oficial enlazada.']
      });
    });
  }

  const validJobs: ScrapedJob[] = [];
  for (const job of collectedJobs) {
    if (await validateLink(job.url, 'UNED BICI Investigación')) validJobs.push(job);
  }

  console.log(`[UNED BICI] ${validJobs.length} contratos de investigación en Educación/Infancia del año ${currentYear} validados.`);
  return validJobs;
}
