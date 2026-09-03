import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { getRandomUserAgent, validateLink } from './utils';

/**
 * Scraper for UNED BICI (Boletín Interno de Coordinación Informativa)
 * Focuses on research contracts linked to education, childhood, literacy and child development.
 * Searches the current year and up to 3 months back (e.g. 2026.html, 2025.html).
 */
export async function scrapeUnedBici(): Promise<ScrapedJob[]> {
  console.log('=== [UNED BICI] Buscando contratos de investigación en Educación e Infancia ===');

  const currentYear = new Date().getFullYear();
  // Check current year and previous year to cover window properly
  const candidateYears = [currentYear, currentYear - 1];
  const now = new Date();
  const maxDays = (4 * 30.5) + 5; // Up to ~4 months (approx 125 days) to capture research contracts of current/previous quarter

  const spanishMonths: { [key: string]: number } = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  function parseDate(text: string, url: string): Date | null {
    const textMatch = text.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
    if (textMatch) {
      const day = parseInt(textMatch[1], 10);
      const mName = textMatch[2].toLowerCase();
      const year = parseInt(textMatch[3], 10);
      if (spanishMonths[mName] !== undefined) {
        return new Date(year, spanishMonths[mName], day);
      }
    }

    const urlMatch1 = url.match(/\/Curso\d{4}-\d{4}\/(20\d{2})(\d{2})(\d{2})\d{2}\//);
    if (urlMatch1) {
      return new Date(parseInt(urlMatch1[1], 10), parseInt(urlMatch1[2], 10) - 1, parseInt(urlMatch1[3], 10));
    }

    const urlMatch2 = url.match(/\/Curso\d{4}-\d{4}\/(\d{2})(\d{2})(\d{2})\d{2}\//);
    if (urlMatch2) {
      return new Date(2000 + parseInt(urlMatch2[1], 10), parseInt(urlMatch2[2], 10) - 1, parseInt(urlMatch2[3], 10));
    }

    return null;
  }

  const collectedJobs: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  for (const year of candidateYears) {
    const pageUrl = `https://www.uned.es/universidad/inicio/en/institucional/areas-direccion/vicerrectorados/investigacion/ofertas-empleo-investigacion/${year}.html`;

    try {
      console.log(`[UNED BICI] Consultando convocatorias de investigación año ${year}...`);
      const response = await axios.get(pageUrl, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status !== 200) {
        continue;
      }

      const $ = cheerio.load(response.data);

      const itemsToValidate: { title: string; url: string; date: Date }[] = [];

      $('a').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        const href = $(el).attr('href');
        if (!href || !href.includes('bici') || !href.includes('.htm')) return;

        const lower = text.toLowerCase();
        if (/designa|candidata elegida|candidato elegido|resoluci[oó]n de adjudicaci[oó]n/.test(lower)) return;
        // Target keywords on early childhood, education, literacy, children
        const isEducationOrInfancy =
          lower.includes('educa') ||
          lower.includes('infan') ||
          lower.includes('child') ||
          lower.includes('literacy') ||
          lower.includes('menor') ||
          lower.includes('adolescen') ||
          lower.includes('escuela');

        if (!isEducationOrInfancy) return;

        const date = parseDate(text, href);
        if (!date) return;

        const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

        // Filter: maximum 3 months old (or current/future within maxDays window)
        if (diffDays > maxDays || diffDays < -30) return;

        const cleanTitle = text.replace(/^-\s*/, '');
        itemsToValidate.push({ title: cleanTitle, url: href, date });
      });

      for (const item of itemsToValidate) {
        const cleanUrl = item.url.split('#')[0];
        if (seenUrls.has(cleanUrl) || seenUrls.has(item.url)) continue;

        // Verify that the body of the page is accessible and doesn't return 404 or closed
        const isValid = await validateLink(item.url, 'UNED');
        if (!isValid) continue;

        seenUrls.add(cleanUrl);
        seenUrls.add(item.url);

        const dateFormatted = item.date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });

        const isChildhood = item.title.toLowerCase().includes('early childhood') || item.title.toLowerCase().includes('infan') || item.title.toLowerCase().includes('literacy');

        collectedJobs.push({
          id: `uned-bici-${item.date.getTime()}-${Math.abs(item.title.length)}`,
          title: item.title,
          companyName: 'UNED - Vicerrectorado de Investigación (BICI)',
          companyLogo: 'https://www.uned.es/universidad/inicio/.resources/site-uned/webresources/img/uned_logo.svg',
          companyType: 'Universidad Pública / Contrato de Investigación',
          companyWeb: pageUrl,
          companyDesc: 'Ofertas de empleo y contratos laborales de proyectos de investigación en la UNED publicados en el BICI.',
          location: 'Madrid / UNED Sede Central',
          province: 'Madrid',
          hours: 'Jornada completa / Tiempo parcial según proyecto',
          contract: 'Laboral de Investigación / Proyecto',
          salary: 'Según bases de la convocatoria BICI (Retribución Investigador/a)',
          publishDate: dateFormatted,
          url: item.url,
          scrapedAt: new Date().toISOString(),
          source: 'UNED BICI Investigación',
          description: `Contrato laboral para proyecto de investigación publicado en el Boletín Interno de Coordinación Informativa (BICI) de la UNED: "${item.title}". Proyecto en el ámbito educativo e investigación de la infancia.`,
          requirements: [
            'Titulación universitaria requerida en las bases específicas (Grado en Educación Infantil, Magisterio, Pedagogía o afines).',
            'Presentación telemática de la solicitud a través de la Sede Electrónica de la UNED.',
            isChildhood ? 'Especialización o interés en educación infantil, desarrollo lector temprano o intervención en primera infancia.' : 'Conocimiento en metodologías de investigación educativa.'
          ]
        });
      }
    } catch (error) {
      console.error(`[UNED BICI] Error extrayendo ofertas del año ${year}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[UNED BICI] ${collectedJobs.length} contratos de investigación en Educación/Infancia validados.`);
  return collectedJobs;
}
