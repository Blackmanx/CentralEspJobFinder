import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, getRandomUserAgent } from './utils';

// Specific high-yield search terms for Técnico de Educación Infantil, Monitores and Childhood Education
const SEARCH_QUERIES = [
  'tecnico educacion infantil',
  'educador infantil',
  'tsei',
  'auxiliar infantil guarderia',
  'primer ciclo educacion infantil',
  'monitor infantil',
  'monitor ocio y tiempo libre',
  'monitor comedor infantil',
  'monitor patio y comedor',
  'monitor extraescolares',
  'monitor ludoteca',
  'animador infantil',
  'monitor ruta escolar'
];

const REGIONS_CONFIG = [
  { name: 'Madrid', provinceParam: 'provinceIds=33' },
  { name: 'Toledo', provinceParam: 'provinceIds=48' }
];

export async function scrapeInfojobs(): Promise<ScrapedJob[]> {
  console.log('=== [Infojobs] Iniciando extracción de vacantes específicas de Infantil (Madrid y Toledo) ===');
  const results: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  for (const region of REGIONS_CONFIG) {
    for (const query of SEARCH_QUERIES) {
      const encoded = encodeURIComponent(query);
      const searchUrl = `https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=${encoded}&${region.provinceParam}`;

      try {
        console.log(`[Infojobs - ${region.name}] Buscando: "${query}"...`);
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

        // Tailor requirements dynamically based on role type
        const lowerTitleStr = title.toLowerCase();
        let companyType = 'Escuela Infantil / Empresa Educativa';
        let requirements = [
          'Titulación de Técnico Superior en Educación Infantil (TSEI) o Grado en Magisterio Infantil.',
          'Experiencia en cuidado y desarrollo pedagógico en la etapa 0-3 / 3-6 años.',
          'Capacidad de trabajo en equipo y empatía con las familias.'
        ];

        if (lowerTitleStr.includes('monitor') || lowerTitleStr.includes('comedor') || lowerTitleStr.includes('ocio') || lowerTitleStr.includes('animad') || lowerTitleStr.includes('extraescolar')) {
          companyType = 'Empresa de Servicios Educativos / Ocio y Tiempo Libre';
          requirements = [
            'Título de Monitor de Ocio y Tiempo Libre o experiencia demostrable en dinamización infantil.',
            'Vigilancia activa, resolución constructiva de conflictos y pautas de higiene/convivencia.',
            'Certificado negativo de delitos de naturaleza sexual en vigor.'
          ];
        }

        results.push({
          id,
          title,
          companyName,
          companyType,
          location: region.name === 'Toledo' && location === 'Madrid' ? 'Toledo' : location,
          province: region.name,
          hours,
          contract,
          url: cleanUrl,
          publishDate: 'Reciente',
          scrapedAt: new Date().toISOString(),
          source: 'Infojobs',
          description: `Oferta activa publicada en InfoJobs para el puesto de ${title}. Puesto orientado a la atención educativa, dinamización o cuidado infantil en ${region.name}. Revisa los detalles y postúlate directamente en el enlace oficial.`,
          requirements
        });
      });
    } catch (err) {
      console.warn(`[Infojobs - ${region.name}] Error al consultar término "${query}":`, err instanceof Error ? err.message : err);
    }
  }
}

  console.log(`[Infojobs] Total de ofertas verificadas obtenidas: ${results.length}`);
  return results;
}
