import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

const BASE_URL = 'https://www.colejobs.es';
const INITIAL_URL = `${BASE_URL}/ofertas-de-empleo/madrid/`;
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');

interface Job {
  id: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  companyType?: string;
  companyWeb?: string;
  companyDesc?: string;
  dates?: string;
  province?: string;
  location?: string;
  description?: string;
  requirements: string[];
  hours?: string;
  contract?: string;
  salary?: string;
  publishDate?: string;
  url: string;
  scrapedAt: string;
}

// Helper to delay execution (throttling)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Clean up text
const clean = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/<em>\|<\/em>/g, '')
    .trim();
};

async function scrapeJobDetails(jobUrl: string): Promise<Partial<Job>> {
  try {
    console.log(`Scrapeando detalle: ${jobUrl}`);
    const response = await axios.get(jobUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
      }
    });

    const $ = cheerio.load(response.data);
    const container = $('.caja-der');

    if (!container.length) {
      console.warn(`No se encontro la estructura de detalles en: ${jobUrl}`);
      return {};
    }

    // Helper to get text from list item by checking strong tag label
    const getLIValue = (sectionTitle: string, label: string): string => {
      let val = '';
      // Find the h2 section
      const h2 = $(`h2:contains("${sectionTitle}")`);
      if (h2.length) {
        const ul = h2.next('ul.listado-datos-cv');
        ul.find('li').each((_, li) => {
          const liText = $(li).text().trim();
          if (liText.toLowerCase().includes(label.toLowerCase())) {
            const strongText = $(li).find('strong').text().trim();
            val = liText.replace(strongText, '').trim();
          }
        });
      }
      return val;
    };

    // Extracting fields
    const companyWeb = container.find('a[title="Colegio Mater Immaculata"]').length 
      ? container.find('a[title="Colegio Mater Immaculata"]').attr('href')
      : container.find('ul.listado-datos-cv li a').first().attr('href');

    const companyName = getLIValue('Datos de la empresa', 'Nombre empresa:') || 'Colegio Concertado';
    const companyDesc = getLIValue('Datos de la empresa', 'Descripción:') || getLIValue('Datos de la empresa', 'Descripcion:');
    
    const dates = getLIValue('Datos oferta', 'Periodo de la oferta:') || getLIValue('Datos oferta', 'Periodo:');
    const province = getLIValue('Datos oferta', 'Provincia:') || 'Madrid';
    const location = getLIValue('Datos oferta', 'Población:') || getLIValue('Datos oferta', 'Poblacion:') || 'Madrid';
    
    // Description can have HTML format, so we get the inner HTML or clean text
    let description = '';
    const descLi = container.find('ul.listado-datos-cv li').filter((_, li) => {
      return $(li).text().trim().toLowerCase().startsWith('descripción:') || 
             $(li).text().trim().toLowerCase().startsWith('descripcion:');
    });
    if (descLi.length) {
      const strongText = descLi.find('strong').text().trim();
      description = descLi.html()?.replace(`<strong>${strongText}</strong>`, '').trim() || descLi.text().replace(strongText, '').trim();
    }

    // Requirements
    const requirements: string[] = [];
    const reqsH2 = $('h2:contains("Requisitos")');
    if (reqsH2.length) {
      const ul = reqsH2.next('ul.listado-datos-cv');
      ul.find('li').each((_, li) => {
        let text = $(li).text().trim();
        if (text.toLowerCase().startsWith('requisitos:')) {
          text = text.replace(/requisitos:/i, '').trim();
        }
        if (text) {
          requirements.push(text);
        }
      });
    }

    // Contract Info
    const hours = getLIValue('Información sobre el contrato', 'Jornada:') || getLIValue('Informacion sobre el contrato', 'Jornada:');
    const contract = getLIValue('Información sobre el contrato', 'Contrato:') || getLIValue('Informacion sobre el contrato', 'Contrato:');
    const salary = getLIValue('Información sobre el contrato', 'Salario:') || getLIValue('Informacion sobre el contrato', 'Salario:');

    return {
      companyName,
      companyWeb,
      companyDesc,
      dates,
      province,
      location,
      description,
      requirements,
      hours,
      contract,
      salary
    };
  } catch (error) {
    console.error(`Error al scrapeando los detalles de ${jobUrl}:`, error instanceof Error ? error.message : error);
    return {};
  }
}

async function scrape() {
  console.log('=== Iniciando Scraper de Empleo de Colejobs.es ===');

  try {
    // 1. Fetch First Page
    console.log(`Obteniendo listado inicial de Madrid: ${INITIAL_URL}`);
    const response = await axios.get(INITIAL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // 2. Extract paginator links
    const pageUrls: string[] = [INITIAL_URL];
    $('.paginador a.paginate').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const fullPageUrl = href.startsWith('http') ? href : `${BASE_URL}/${href}`;
        if (!pageUrls.includes(fullPageUrl)) {
          pageUrls.push(fullPageUrl);
        }
      }
    });

    console.log(`Encontradas ${pageUrls.length} paginas en total.`);

    // 3. Loop all pages to extract job list links
    const jobListings: Job[] = [];
    const jobLinks = new Set<string>();

    for (const pageUrl of pageUrls) {
      console.log(`Procesando listado de pagina: ${pageUrl}`);
      const pageResponse = await axios.get(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const page$ = cheerio.load(pageResponse.data);

      page$('section.dos-columnas article').each((_, article) => {
        const a = page$(article).find('a').first();
        const href = a.attr('href');
        if (href && href.includes('ofertas-de-empleo/')) {
          const fullJobUrl = href.startsWith('http') ? href : `${BASE_URL}/${href}`;
          
          // Initial info from listing page
          const title = clean(page$(article).find('h3').text());
          const companyNameListing = clean(page$(article).find('h4').text());
          const publishDate = clean(page$(article).find('footer p').first().text());
          
          const metaText = clean(page$(article).find('footer p.meta').text());
          const metaParts = metaText.split('|').map(p => p.trim());
          const location = metaParts[0] || 'Madrid';
          const hours = metaParts[1] || '';
          const contract = metaParts[2] || '';

          // Determine school type abbreviation from logo if image is not loaded
          const logoText = page$(article).find('figure span').text().trim();
          let companyType = 'Colegio';
          if (logoText === 'CC') companyType = 'Colegio Concertado';
          if (logoText === 'CP') companyType = 'Colegio Privado';
          if (logoText === 'CCA') companyType = 'Colegio Catolico';

          const logoImg = page$(article).find('figure img').attr('src');
          const companyLogo = logoImg ? (logoImg.startsWith('http') ? logoImg : `${BASE_URL}/${logoImg}`) : undefined;

          // Only collect valid job links
          if (fullJobUrl && !jobLinks.has(fullJobUrl)) {
            jobLinks.add(fullJobUrl);
            
            // Generate id from slug
            const slugParts = href.split('/');
            const slug = slugParts[slugParts.length - 1] || slugParts[slugParts.length - 2];

            jobListings.push({
              id: slug,
              title,
              companyName: companyNameListing,
              companyLogo,
              companyType,
              location,
              hours,
              contract,
              url: fullJobUrl,
              publishDate,
              requirements: [],
              scrapedAt: new Date().toISOString()
            });
          }
        }
      });

      // Throttle listing requests slightly
      await delay(500);
    }

    console.log(`Extraidas ${jobListings.length} ofertas de empleo del listado. Iniciando extraccion de detalles...`);

    // 4. Scrape details for each job with throttling
    const finalJobs: Job[] = [];
    for (let i = 0; i < jobListings.length; i++) {
      const job = jobListings[i];
      console.log(`[${i + 1}/${jobListings.length}] Procesando details de: ${job.title}`);
      
      // Wait 1.5 seconds between detail requests for politeness
      await delay(1500);

      const details = await scrapeJobDetails(job.url);
      
      // Merge details
      finalJobs.push({
        ...job,
        ...details,
        // Fallback to listing values if detail page fails or does not have it
        companyName: details.companyName || job.companyName,
        location: details.location || job.location,
        hours: details.hours || job.hours,
        contract: details.contract || job.contract,
        requirements: details.requirements || []
      });
    }

    // 5. Ensure folder exists and save to JSON
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(finalJobs, null, 2), 'utf-8');
    
    console.log(`=== Scraper completado con exito. Guardadas ${finalJobs.length} ofertas en ${DATA_FILE} ===`);

  } catch (error) {
    console.error('Error fatal durante la ejecucion del scraper:', error);
  }
}

scrape();
