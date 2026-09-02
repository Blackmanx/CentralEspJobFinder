import * as fs from 'fs/promises';
import * as path from 'path';
import { ScrapedJob } from './scrapers/types';
import { scrapeColejobs } from './scrapers/colejobs';
import { scrapeInfojobs } from './scrapers/infojobs';
import { scrapeIndeed } from './scrapers/indeed';
import { scrapeInfoempleo } from './scrapers/infoempleo';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');

// Strict C2 filter logic: Discard if job explicitly requires English C2 without allowing C1/B2
function filterC2Requirement(job: ScrapedJob): boolean {
  const fullText = `${job.title} ${job.description || ''} ${(job.requirements || []).join(' ')}`.toLowerCase();
  const mentionsC2 = fullText.includes('c2') || fullText.includes('proficiency') || fullText.includes('cpe');
  
  if (!mentionsC2) {
    return true; // No C2 mentioned, keep
  }

  // If C2 is mentioned, check if C1 or B2 or native alternative is also acceptable
  const admitsAlternatives = fullText.includes('c1') || fullText.includes('b2') || fullText.includes('o superior') || fullText.includes('valorable');
  return admitsAlternatives;
}

// Ensure geography belongs to central Spain regions
function filterGeographicArea(job: ScrapedJob): boolean {
  const allowedKeywords = [
    'madrid', 
    'segovia', 'avila', 'ávila', 
    'toledo', 'guadalajara', 'cuenca', 'ciudad real', 'albacete', 
    'castilla la mancha', 'castilla-la mancha'
  ];

  const loc = `${job.location || ''} ${job.province || ''}`.toLowerCase();
  if (!loc.trim()) return true; // If unspecified, preserve
  return allowedKeywords.some(kw => loc.includes(kw));
}

export async function runAllScrapers() {
  console.log('===========================================================');
  console.log('CentralEspJobFinder - Multi-Source Scraping Engine (v2.0)');
  console.log('Target: Vacantes Docentes y Técnico de Educación Infantil');
  console.log('===========================================================\n');

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // 1. Scrape Colejobs (Educational portal)
    const colejobsList = await scrapeColejobs();

    // 2. Scrape Infojobs (Focus on Técnico de Educación Infantil / Primer Ciclo)
    const infojobsList = await scrapeInfojobs();

    // 3. Scrape Indeed (Targeted TSEI / 0-3 verified vacancies)
    const indeedList = await scrapeIndeed();

    // 4. Scrape Infoempleo (Teaching & support vacancies)
    const infoempleoList = await scrapeInfoempleo();

    // Combine all sources
    const allScraped = [
      ...infojobsList,
      ...indeedList,
      ...colejobsList,
      ...infoempleoList
    ];

    console.log(`\nTotal ofertas agregadas en bruto: ${allScraped.length}`);

    // Deduplicate by normalized URL or Title+Company
    const seenMap = new Set<string>();
    const deduplicated: ScrapedJob[] = [];

    for (const job of allScraped) {
      const cleanUrl = job.url.split('?')[0].toLowerCase();
      const titleKey = `${job.title.toLowerCase().trim()}_${job.companyName.toLowerCase().trim()}`;
      
      if (seenMap.has(cleanUrl) || seenMap.has(titleKey)) {
        continue;
      }

      seenMap.add(cleanUrl);
      seenMap.add(titleKey);
      deduplicated.push(job);
    }

    // Apply strict quality filters (Geographic & English C2)
    const filteredJobs = deduplicated
      .filter(filterGeographicArea)
      .filter(filterC2Requirement);

    console.log(`Total ofertas tras deduplicación y filtros de idoneidad: ${filteredJobs.length}`);

    // Write final dataset
    await fs.writeFile(DATA_FILE, JSON.stringify(filteredJobs, null, 2), 'utf-8');
    console.log(`✅ Base de datos unificada actualizada exitosamente en: ${DATA_FILE}`);

  } catch (error) {
    console.error('Error fatal durante la ejecución de los scrapers:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].includes('scrape')) {
  runAllScrapers();
}
