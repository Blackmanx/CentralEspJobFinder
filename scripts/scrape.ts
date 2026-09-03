import * as fs from 'fs/promises';
import * as path from 'path';
import { ScrapedJob } from './scrapers/types';
import { classifyAndEnrichJob } from './scrapers/classifier';
import { scrapeColejobs } from './scrapers/colejobs';
import { scrapeInfojobs } from './scrapers/infojobs';
import { scrapeIndeed } from './scrapers/indeed';
import { scrapeInfoempleo } from './scrapers/infoempleo';
import { scrapeUnedBici } from './scrapers/uned';
import { scrapeUamResearch } from './scrapers/uamResearch';
import { scrapeUcmResearch } from './scrapers/ucmResearch';
import { scrapeColegios } from './scrapers/colegios';
import { scrapeAdministracionPublica } from './scrapers/administracionPublica';
import { scrapeMadrid } from './scrapers/madrid';
import { scrapeSNE } from './scrapers/sne';
import { isConcreteJobUrl, normalizeUrl, validateLink } from './scrapers/utils';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');

// Strict C2 filter logic: Discard if job explicitly requires English C2 without allowing C1/B2
function filterC2Requirement(job: ScrapedJob): boolean {
  const fullText = `${job.title} ${job.description || ''} ${(job.requirements || []).join(' ')}`.toLowerCase();
  const mentionsC2 = fullText.includes('c2') || fullText.includes('proficiency') || fullText.includes('cpe');
  
  if (!mentionsC2) {
    return true; // No C2 mentioned, keep
  }

  // If C2 is mentioned, keep only explicit equivalent alternatives.
  const admitsAlternatives = /\bc1\b|\bb2\b|nivel nativo|nativo|cualquiera de los niveles|o superior/.test(fullText);
  return admitsAlternatives;
}

// Strict filter to exclude international jobs (e.g. Germany, Ireland, UK, etc.)
function filterExcludeForeignCountries(job: ScrapedJob): boolean {
  // Inspect only job title and geographic fields. Requirements/descriptions
  // can legitimately mention English, France, Germany, etc. as subjects or
  // languages while the workplace is in Spain.
  const locationText = `${job.title} ${job.location || ''} ${job.province || ''}`.toLowerCase();
  const foreignKeywords = [
    'alemania', 'germany', 'deutschland', 
    'irlanda', 'ireland', 'dublin', 'dublín',
    'reino unido', 'united kingdom', 'uk', 'londres', 'london',
    'francia', 'france', 'holanda', 'países bajos', 'netherlands',
    'italia', 'italy', 'portugal', 'belgica', 'bélgica', 'suiza', 'switzerland',
    'polonia', 'poland', 'paises nordicos', 'escandinavia'
  ];

  const isForeign = foreignKeywords.some(kw => {
    const expression = kw === 'uk' ? /(^|[^a-záéíóúüñ])uk([^a-záéíóúüñ]|$)/i : new RegExp(kw, 'i');
    return expression.test(locationText);
  });
  return !isForeign;
}

// Strict date filter: Exclude commercial offers published more than 3 weeks ago (21 days)
// (UNED BICI research contracts already manage their own 3-4 months quarterly window)
function filterRecentDate(job: ScrapedJob): boolean {
  if (
    job.source?.includes('UNED') ||
    job.source?.includes('Administración') ||
    job.source?.includes('Oficina Virtual') ||
    job.source?.includes('UAM Investigación') ||
    job.source?.includes('UCM Investigación')
  ) return true;
  // If no date or marked as Reciente / Convocatoria / Curso, keep it
  if (!job.publishDate) return true;
  const pDateLower = job.publishDate.toLowerCase();
  if (
    pDateLower.includes('reciente') || 
    pDateLower.includes('convocatoria') || 
    pDateLower.includes('curso') || 
    pDateLower.includes('hoy') || 
    pDateLower.includes('ayer') ||
    pDateLower.includes('hace')
  ) {
    // Check if relative date says more than 3 weeks (e.g. "hace 1 mes", "hace 4 semanas")
    if (pDateLower.includes('mes') || pDateLower.includes('año')) return false;
    const weeksMatch = pDateLower.match(/hace\s+(\d+)\s*sem/);
    if (weeksMatch && parseInt(weeksMatch[1], 10) > 3) return false;
    const daysMatch = pDateLower.match(/hace\s+(\d+)\s*d/);
    if (daysMatch && parseInt(daysMatch[1], 10) > 21) return false;
    return true;
  }

  // Parse Spanish date strings: "27 agosto de 2026" or "27/08/2026"
  const spanishMonths: { [key: string]: number } = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  const textMatch = pDateLower.match(/(\d{1,2})\s+([a-z]+)\s+(?:de\s+)?(\d{4})/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const month = spanishMonths[textMatch[2]];
    const year = parseInt(textMatch[3], 10);
    if (month !== undefined) {
      const pubDate = new Date(year, month, day);
      const diffDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 21; // Within 21 days (3 weeks)
    }
  }

  const slashMatch = pDateLower.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    const pubDate = new Date(year, month, day);
    const diffDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 21;
  }

  return true;
}

export async function runAllScrapers() {
  console.log('===========================================================');
  console.log('JobCrawling - Multi-Source Scraping Engine (v2.0)');
  console.log('Target: Vacantes Docentes, Técnico Infantil y Bolsas de Empleo');
  console.log('===========================================================\n');

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // 1. Scrape Colejobs (Educational portal)
    const colejobsList = await scrapeColejobs();

    // 2. Scrape Infojobs nationwide (direct offer URLs only)
    const infojobsList = await scrapeInfojobs();

    // 3. Indeed is intentionally empty while its anti-bot response prevents verification
    const indeedList = await scrapeIndeed();

    // 4. Infoempleo is intentionally empty while its SEO pages do not expose stable details
    const infoempleoList = await scrapeInfoempleo();

    // 5. Official, concrete public calls and current Madrid employment offers
    const administracionList = await scrapeAdministracionPublica();
    const madridList = await scrapeMadrid();
    const sneList = await scrapeSNE();

    // 6. Nationwide private/concerted early-childhood vacancies
    const colegiosList = await scrapeColegios();

    // 7. UNED BICI (research contracts on early childhood & education)
    const unedList = await scrapeUnedBici();

    // 8. Official university research-contract calls with concrete detail pages
    const uamResearchList = await scrapeUamResearch();
    const ucmResearchList = await scrapeUcmResearch();

    // Combine all sources
    const allScraped = [
      ...infojobsList,
      ...indeedList,
      ...colejobsList,
      ...infoempleoList,
      ...administracionList,
      ...madridList,
      ...sneList,
      ...colegiosList,
      ...unedList,
      ...uamResearchList,
      ...ucmResearchList
    ];

    console.log(`\nTotal ofertas agregadas en bruto: ${allScraped.length}`);

    // Deduplicate by normalized URL or Title+Company
    const seenMap = new Set<string>();
    const deduplicated: ScrapedJob[] = [];

    for (const job of allScraped) {
      if (!isConcreteJobUrl(job.url, job.source || '')) continue;
      const cleanUrl = normalizeUrl(job.url).toLowerCase();
      const titleKey = `${job.title.toLowerCase().trim()}_${job.companyName.toLowerCase().trim()}`;
      
      if (seenMap.has(cleanUrl) || seenMap.has(titleKey)) {
        continue;
      }

      seenMap.add(cleanUrl);
      seenMap.add(titleKey);
      deduplicated.push(job);
    }

    // Apply strict quality filters (Spain, freshness, and English C2 requirements)
    const eligibleJobs = deduplicated
      .filter(filterExcludeForeignCountries)
      .filter(filterRecentDate)
      .filter(filterC2Requirement);

    // Final gate: every published URL must be a reachable concrete detail page.
    const verifiedJobs: ScrapedJob[] = [];
    for (let i = 0; i < eligibleJobs.length; i += 8) {
      const batch = eligibleJobs.slice(i, i + 8);
      const checks = await Promise.all(batch.map(job => validateLink(job.url, job.source || 'Fuente')));
      batch.forEach((job, index) => { if (checks[index]) verifiedJobs.push(job); });
    }
    const filteredJobs = verifiedJobs.map(classifyAndEnrichJob);

    console.log(`Total ofertas tras deduplicación, filtros y validación de enlaces: ${filteredJobs.length}`);

    // Write final dataset
    await fs.writeFile(DATA_FILE, JSON.stringify(filteredJobs, null, 2), 'utf-8');
    console.log(`✅ Base de datos unificada actualizada exitosamente en: ${DATA_FILE}`);

    // Also mirror to dist/data/jobs.json if dist directory exists (for live Caddy web server)
    const distDataFile = path.join(process.cwd(), 'dist', 'data', 'jobs.json');
    try {
      await fs.mkdir(path.dirname(distDataFile), { recursive: true });
      await fs.writeFile(distDataFile, JSON.stringify(filteredJobs, null, 2), 'utf-8');
    } catch {
      // Ignore if dist has not been generated yet
    }

  } catch (error) {
    console.error('Error fatal durante la ejecución de los scrapers:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].includes('scrape')) {
  runAllScrapers();
}
