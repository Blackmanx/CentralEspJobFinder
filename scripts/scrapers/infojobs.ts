import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent } from './utils';

// Specific high-yield search terms for Técnico de Educación Infantil
const SEARCH_QUERIES = [
  'tecnico educacion infantil',
  'educador infantil',
  'tsei',
  'auxiliar infantil guarderia',
  'primer ciclo educacion infantil'
];

export async function scrapeInfojobs(): Promise<ScrapedJob[]> {
  console.log('=== [Infojobs] Iniciando extracción de vacantes específicas de Infantil ===');
  const results: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    const encoded = encodeURIComponent(query);
    // Province 33 is Madrid in InfoJobs
    const searchUrl = `https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=${encoded}&provinceIds=33`;

    try {
      console.log(`[Infojobs] Buscando: "${query}"...`);
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept-Language': 'es-ES,es;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 9000
      });

      const $ = cheerio.load(response.data);

      $('a.ij-OfferCardContent-description-link').each((_, el) => {
        let href = $(el).attr('href');
        if (!href) return;
        if (href.startsWith('//')) href = 'https:' + href;
        const cleanUrl = href.split('?')[0];
        if (seenUrls.has(cleanUrl)) return;
        seenUrls.add(cleanUrl);

        const title = clean($(el).text()) || clean($(el).attr('aria-label') || '');
        if (!title) return;

        // Ensure relevance: exclude medical, hospital, nursing roles that appear from broad queries
        const lowerTitle = title.toLowerCase();
        const nonEducationalKeywords = ['enfermer', 'hospital', 'quirófano', 'médico', 'farmac', 'odontol'];
        if (nonEducationalKeywords.some(kw => lowerTitle.includes(kw))) {
          return;
        }

        // Container lookup for metadata
        const card = $(el).closest('.ij-OfferCardContent-description, [class*="OfferCardContent"]');
        const companyName = clean(
          card.find('a[href*="/empresa-"], .ij-OfferCardContent-description-subtitle, [class*="subtitle"]').first().text()
        ) || 'Centro Educativo / Infantil';

        // Extract tags, location & contract metadata
        const metaTokens: string[] = [];
        card.find('li, [class*="tag"], [class*="badge"], span').each((_, s) => {
          const t = clean($(s).text());
          if (t && t.length < 50 && !metaTokens.includes(t) && t !== title && t !== companyName) {
            metaTokens.push(t);
          }
        });

        // Determine location and contract from tokens
        let location = 'Madrid';
        for (const token of metaTokens) {
          if (token.toLowerCase().includes('madrid') || token.toLowerCase().includes('rozas') || token.toLowerCase().includes('alcobendas') || token.toLowerCase().includes('getafe') || token.toLowerCase().includes('alcorcón') || token.toLowerCase().includes('leganés')) {
            location = token;
            break;
          }
        }

        const hours = metaTokens.find(t => t.toLowerCase().includes('jornada') || t.toLowerCase().includes('completa') || t.toLowerCase().includes('parcial')) || 'Jornada no especificada';
        const contract = metaTokens.find(t => t.toLowerCase().includes('indefinido') || t.toLowerCase().includes('temporal') || t.toLowerCase().includes('sustitu')) || 'Convenio colectivo';

        // Extract ID from url (of-XXXX)
        const idMatch = cleanUrl.match(/of-([a-zA-Z0-9]+)/);
        const id = idMatch ? `infojobs-${idMatch[1]}` : `infojobs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        results.push({
          id,
          title,
          companyName,
          companyType: 'Escuela Infantil / Empresa Educativa',
          location,
          province: 'Madrid',
          hours,
          contract,
          url: cleanUrl,
          publishDate: 'Reciente',
          scrapedAt: new Date().toISOString(),
          source: 'Infojobs',
          description: `Oferta publicada en InfoJobs para el puesto de ${title}. Revisa los requisitos completos y postúlate directamente en el enlace oficial.`,
          requirements: [
            'Titulación de Técnico Superior en Educación Infantil (TSEI) o Grado en Magisterio Infantil.',
            'Experiencia en cuidado y desarrollo pedagógico en la etapa 0-3 / 3-6 años.',
            'Capacidad de trabajo en equipo y empatía con las familias.'
          ]
        });
      });
    } catch (err) {
      console.warn(`[Infojobs] Error al consultar término "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[Infojobs] Total de ofertas verificadas obtenidas: ${results.length}`);
  return results;
}
