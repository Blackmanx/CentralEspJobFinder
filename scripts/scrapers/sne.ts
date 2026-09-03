import axios from 'axios';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent } from './utils';

const BASE_URL = 'https://www.sistemanacionalempleo.es';
const INDEX_URL = `${BASE_URL}/SNE_ListadoOfertasDifusionWEB/consultarOfertasFrm.do?CA=&modo=inicio`;
const RELEVANT = /educaci[oó]n infantil|educador(?:\/a)?\s+infantil|t[eé]cnico(?:\/a)?[^\n]{0,60}infantil|escuela[s]? infantil|guarder[ií]a|maestr(?:o|a)[^\n]{0,60}infantil|profesor(?:\/a)?[^\n]{0,60}infantil|monitor(?:\/a)?[^\n]{0,60}(?:ocio|comedor|escolar|campamento)|actividades extraescolares[^\n]{0,80}(?:infantil|niñ)|atenci[oó]n y cuidado de niñ/i;
const ROLE_IN_TITLE = /educaci[oó]n infantil|educador(?:\/a)?\s+infantil|t[eé]cnico(?:\/a)?[^\n]{0,60}infantil|escuela[s]? infantil|guarder[ií]a|maestr(?:o|a)[^\n]{0,60}infantil|profesor(?:\/a)?[^\n]{0,60}(?:infantil|primaria)|docente[^\n]{0,60}infantil|monitor(?:\/a)?|monitors?|vigilantes?[^\n]{0,40}(?:comedor|menjador)|menjador escolar|extraescolar|animador|cociner(?:o|a)[^\n]{0,40}(?:escuela|escola) infantil/i;
const CHILD_CONTEXT = /infantil|niñ|nens?|guarder[ií]a|escuela|escola|comedor|menjador|extraescolar|ocio y tiempo libre|3\s*a\s*12|0\s*[-a]\s*3|primaria/i;

const cleanSNE = (text: string): string => clean(text).replace(/[\u0080-\u009f]/g, '');

function isRelevantOffer(title: string, data: string): boolean {
  const text = `${title} ${data}`;
  if (!RELEVANT.test(text)) return false;
  if (ROLE_IN_TITLE.test(title)) return true;
  return /profesor|maestro|docente|monitor|educador|cuidador|animador/i.test(title) && CHILD_CONTEXT.test(text);
}

interface Feed {
  region: string;
  flow: string;
  pdfUrl: string;
}

function parseDate(value: string): Date | null {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function detailUrl(id: string, flow: string): string {
  return `${BASE_URL}/OfertaDifusionWEB/detalleOferta.do?id=${encodeURIComponent(id)}&idFlujo=${encodeURIComponent(flow)}&modo=inicio&ret=B`;
}

function headingText($: cheerio.CheerioAPI, label: string): string {
  const headings = $('h4.accboxh4');
  const selected = headings.filter((_, heading) => clean($(heading).text()).toLowerCase() === label).first();
  const heading = selected.length ? selected : headings.first();
  return cleanSNE(heading.next('p').first().text());
}

async function getFeeds(): Promise<Feed[]> {
  const response = await axios.get(INDEX_URL, {
    headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
    timeout: 15000,
    responseType: 'arraybuffer'
  });
  const $ = cheerio.load(Buffer.from(response.data).toString('latin1'));
  const feeds: Feed[] = [];
  $('a[href*="modo=verPDF"]').each((_, link) => {
    const url = new URL($(link).attr('href') || '', `${BASE_URL}/SNE_ListadoOfertasDifusionWEB/`);
    const flow = url.searchParams.get('idFlujo');
    const filter = url.searchParams.get('filtroCA');
    if (flow && filter) feeds.push({ region: clean($(link).text()), flow, pdfUrl: url.toString() });
  });
  return feeds;
}

async function getCandidates(feed: Feed): Promise<string[]> {
  try {
    const response = await axios.get(feed.pdfUrl, {
      headers: { 'User-Agent': getRandomUserAgent() },
      timeout: 25000,
      responseType: 'arraybuffer'
    });
    const parsed = await pdfParse(Buffer.from(response.data));
    return parsed.text
      .split(/(?=\s*Oferta:\s*[0-9])/i)
      .filter(block => /Oferta:\s*[0-9]/i.test(block) && RELEVANT.test(block))
      .map(block => {
        const id = block.match(/Oferta:\s*([0-9]+)/i)?.[1];
        return id ? detailUrl(id, feed.flow) : '';
      })
      .filter(Boolean);
  } catch (error) {
    console.warn(`[SNE] No se pudo leer el PDF de ${feed.region}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

export async function scrapeSNE(): Promise<ScrapedJob[]> {
  console.log('=== [Sistema Nacional de Empleo] Buscando ofertas de infancia en difusión ===');
  try {
    const feeds = await getFeeds();
    const candidateUrls = new Set<string>();
    for (let i = 0; i < feeds.length; i += 4) {
      const batch = await Promise.all(feeds.slice(i, i + 4).map(getCandidates));
      batch.flat().forEach(url => candidateUrls.add(url));
    }

    const jobs: ScrapedJob[] = [];
    for (const url of candidateUrls) {
      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': getRandomUserAgent(), 'Accept-Language': 'es-ES,es;q=0.9' },
          timeout: 15000,
          responseType: 'arraybuffer'
        });
        const $ = cheerio.load(Buffer.from(response.data).toString('latin1'));
        const body = cleanSNE($('body').text());
        const title = headingText($, 'descripción') ||
          clean(body.match(/Datos de la oferta n[uú]mero:\s*[^\s]+\s+(.+?)\s+Provincia:/i)?.[1] || 'Oferta de empleo');
        const dataText = cleanSNE($('h4.accboxh4').filter((_, heading) => cleanSNE($(heading).text()).toLowerCase() === 'datos').first().nextAll('div').first().text());
        if (!isRelevantOffer(title, dataText)) continue;

        const endDateText = body.match(/Fecha de fin:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)?.[1] || '';
        const endDate = parseDate(endDateText);
        if (endDate && endDate.getTime() < Date.now()) continue;
        const province = clean(body.match(/Provincia:\s*([^\n]+?)(?:\s+Descripci[oó]n|\s+Datos)/i)?.[1] || 'España');
        const location = clean(dataText.match(/Localidad de Ubicaci[oó]n del Puesto:\s*(.+?)(?=\s+(?:Salario|Duraci[oó]n|Datos adicionales|Datos de contacto|$))/i)?.[1] || province);
        const id = new URL(url).searchParams.get('id') || url;

        jobs.push({
          id: `sne-${id}`,
          title,
          companyName: 'Entidad ofertante a través del Sistema Nacional de Empleo',
          companyType: 'Oferta de empleo en difusión',
          location,
          province,
          contract: dataText.match(/(Contrato[^.]{0,100})/i)?.[1] || '',
          hours: dataText.match(/(Tipo de jornada:\s*[^.]{1,80})/i)?.[1] || '',
          salary: dataText.match(/(Salario:\s*[^.]{1,100})/i)?.[1] || '',
          publishDate: body.match(/Oferta:\s*\d+\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)?.[1] || 'Reciente',
          url,
          scrapedAt: new Date().toISOString(),
          source: 'Sistema Nacional de Empleo',
          description: dataText.slice(0, 1800),
          requirements: []
        });
      } catch (error) {
        console.warn(`[SNE] No se pudo leer ${url}:`, error instanceof Error ? error.message : error);
      }
    }
    console.log(`[SNE] ${jobs.length} ofertas de infancia extraídas de fichas directas.`);
    return jobs;
  } catch (error) {
    console.warn('[SNE] No se pudo consultar el índice nacional:', error instanceof Error ? error.message : error);
    return [];
  }
}
