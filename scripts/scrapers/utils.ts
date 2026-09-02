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

export async function validateLink(url: string, source: string): Promise<boolean> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent()
      },
      timeout: 7000,
      validateStatus: () => true
    });

    if (response.status === 404) {
      return false;
    }

    if ((source === 'Indeed' || source === 'Infojobs') && (response.status === 403 || response.status === 400)) {
      return true;
    }

    const html = response.data;
    if (typeof html === 'string') {
      const lowerHtml = html.toLowerCase();
      const closedIndicators = [
        'error 404',
        'página no encontrada',
        'oferta no disponible',
        'oferta caducada',
        'ya no está disponible',
        'convocatoria cerrada',
        'proceso finalizado'
      ];
      for (const indicator of closedIndicators) {
        if (lowerHtml.includes(indicator)) {
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
