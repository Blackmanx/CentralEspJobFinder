import axios from 'axios';

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

export const getRandomUserAgent = () => {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const clean = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/<em>\|<\/em>/g, '')
    .trim();
};

import * as cheerio from 'cheerio';

/** Remove tracking parameters without removing identifiers needed by detail pages. */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|campaign$|applicationorigin$|page$|sortby$)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    // Keep path/query value casing: Colejobs uses case-sensitive offer tokens.
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

/** Only accept links that identify one offer/call, never a search or category page. */
export function isConcreteJobUrl(url: string, source = ''): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname.toLowerCase();
  const sourceName = source.toLowerCase();

  if (sourceName.includes('infojobs') || host === 'infojobs.net') {
    return host === 'infojobs.net' && /\/of-i[a-z0-9]+\/?$/.test(path);
  }
  if (sourceName.includes('colejobs') || host === 'colejobs.es') {
    return host === 'colejobs.es' && /\/ofertas-de-empleo\/[^/]+-n[a-z0-9]+\/?$/.test(path);
  }
  if (sourceName.includes('colegios') || host === 'colegios.es') {
    return host === 'colegios.es' && /\/empleoprofesores\/[^/]+-\d{8}\/?$/.test(path);
  }
  if (sourceName.includes('infoempleo') || host === 'infoempleo.com') {
    return host === 'infoempleo.com' && /\/ofertas-trabajo\/[^/]+\/[^/]+\/\d+\/?$/.test(path);
  }
  if (sourceName.includes('indeed') || host === 'indeed.com' || host.endsWith('.indeed.com')) {
    return host.endsWith('indeed.com') && path.endsWith('/viewjob') && Boolean(parsed.searchParams.get('jk'));
  }
  if (sourceName.includes('madrid') || host === 'oficinavirtualempleo.comunidad.madrid') {
    return host === 'oficinavirtualempleo.comunidad.madrid' &&
      path.includes('/areapublica/ofertas/detalleoferta/') && Boolean(parsed.searchParams.get('id'));
  }
  if (sourceName.includes('administración') || sourceName.includes('administracion') || host === 'administracion.gob.es') {
    return host === 'administracion.gob.es' && path.endsWith('/detalleempleo.htm') && Boolean(parsed.searchParams.get('idConvocatoria'));
  }
  if (sourceName.includes('uned bici') || host === 'bici.uned.es') {
    return host === 'bici.uned.es' && /^\/\d{4}\/bici-n-o-\d+-\d{2}-\d{2}-\d{4}\/?$/.test(path);
  }
  if (sourceName.includes('uned') || host === 'uned.es' || host === 'www2.uned.es') {
    return (host === 'uned.es' || host === 'www2.uned.es') && path.includes('/bici/') && path.endsWith('.htm');
  }
  if (sourceName.includes('uam investigación') || host === 'uam.es') {
    return host === 'uam.es' && /^\/uam\/investigacion\/ofertas?-empleo\/[^/]+\/?$/.test(path);
  }
  if (sourceName.includes('ucm investigación') || host === 'ucm.es') {
    return host === 'ucm.es' && /^\/(?:pli|paii|pait)\d+-\d{2}\/?$/.test(path);
  }
  if (sourceName.includes('sa empleo') || host === 'saempleo.es') {
    return host === 'saempleo.es' && path.includes('/detalle-oferta') && Boolean(parsed.searchParams.get('ofertaid'));
  }
  if (sourceName.includes('sistema nacional') || host === 'sistemanacionalempleo.es') {
    return host === 'sistemanacionalempleo.es' && path.includes('/ofertadifusionweb/detalleoferta.do') &&
      Boolean(parsed.searchParams.get('id')) && Boolean(parsed.searchParams.get('idFlujo'));
  }
  return false;
}

export async function validateLink(url: string, source: string): Promise<boolean> {
  const sourceName = source.toLowerCase();
  if (!isConcreteJobUrl(url, source)) {
    console.warn(`[${source}] URL descartada por no ser una ficha de oferta: ${url}`);
    return false;
  }

  try {
    let response: Awaited<ReturnType<typeof axios.get>> | undefined;
    for (let attempt = 0; attempt < 2 && !response; attempt++) {
      try {
        response = await axios.get(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9'
          },
          timeout: 15000,
          validateStatus: () => true
        });
      } catch (error) {
        if (attempt === 1) throw error;
        await delay(500);
      }
    }
    if (!response) return false;

    // A normal user must receive the detail page; bot-blocked responses are not valid.
    if (response.status < 200 || response.status >= 300) return false;

    const finalUrl = response.request?.res?.responseUrl;
    if (typeof finalUrl === 'string' && !isConcreteJobUrl(finalUrl, source)) return false;

    const html = response.data;
    if (typeof html === 'string') {
      const $ = cheerio.load(html);
      const title = $('title').text().toLowerCase();
      const h1 = $('h1').text().toLowerCase();
      const bodyText = $('body').text().toLowerCase().replace(/\s+/g, ' ');

      // Check for 404 in HTML Title or Heading (avoids false positives in script tags)
      const notFoundKeywords = [
        '404',
        'página no encontrada',
        'pagina no encontrada',
        'not found',
        'página no existe',
        'pagina no existe',
        'recurso no encontrado'
      ];

      for (const kw of notFoundKeywords) {
        if (title.includes(kw) || h1.includes(kw)) {
          return false;
        }
      }

      // Archived BICI articles remain valid, even when the application deadline has passed.
      // They are intentionally kept for the current-year historical view and marked in the UI.
      if (sourceName.includes('uned bici')) return true;

      // Check for closed or expired job listings
      const closedIndicators = [
        'oferta no disponible',
        'oferta caducada',
        'ya no está disponible',
        'esta oferta ha caducado',
        'el contenido solicitado no existe',
        'convocatoria cerrada',
        'el proceso ha finalizado',
        'plazo de solicitud cerrado',
        'oferta cerrada',
        'oferta finalizada'
      ];

      for (const indicator of closedIndicators) {
        if (title.includes(indicator) || h1.includes(indicator) || bodyText.includes(indicator)) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`Error al validar link ${url}:`, error instanceof Error ? error.message : error);
    return false;
  }
}
