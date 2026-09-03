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

export async function validateLink(url: string, source: string): Promise<boolean> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9'
      },
      timeout: 8000,
      validateStatus: () => true
    });

    // Check HTTP status code
    if (response.status === 404 || response.status === 410) {
      return false;
    }

    // Platforms with anti-bot shields: allow 403/400 if bot detected
    if ((source === 'Indeed' || source === 'Infojobs') && (response.status === 403 || response.status === 400 || response.status === 401)) {
      return true;
    }

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

      // Check for closed or expired job listings
      const closedIndicators = [
        'oferta no disponible',
        'oferta caducada',
        'ya no está disponible',
        'esta oferta ha caducado',
        'el contenido solicitado no existe',
        'convocatoria cerrada',
        'el proceso ha finalizado',
        'plazo de solicitud cerrado'
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
