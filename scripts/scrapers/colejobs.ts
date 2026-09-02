import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedJob } from './types';
import { clean, delay, getRandomUserAgent } from './utils';

const BASE_URL = 'https://www.colejobs.es';
const TARGET_REGIONS = [
  'madrid',
  'segovia',
  'avila',
  'toledo',
  'guadalajara'
];

async function scrapeJobDetails(jobUrl: string): Promise<Partial<ScrapedJob>> {
  try {
    const response = await axios.get(jobUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const container = $('.caja-der');

    if (!container.length) {
      return {};
    }

    const getLIValue = (sectionTitle: string, label: string): string => {
      let val = '';
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

    const companyWeb = container.find('ul.listado-datos-cv li a').first().attr('href');
    const companyName = getLIValue('Datos de la empresa', 'Nombre empresa:') || 'Colegio Concertado / Privado';
    const companyDesc = getLIValue('Datos de la empresa', 'Descripción:') || getLIValue('Datos de la empresa', 'Descripcion:');
    
    const dates = getLIValue('Datos oferta', 'Periodo de la oferta:') || getLIValue('Datos oferta', 'Periodo:');
    const province = getLIValue('Datos oferta', 'Provincia:') || 'Madrid';
    const location = getLIValue('Datos oferta', 'Población:') || getLIValue('Datos oferta', 'Poblacion:') || province;
    
    let description = '';
    const descLi = container.find('ul.listado-datos-cv li').filter((_, li) => {
      return $(li).text().trim().toLowerCase().startsWith('descripción:') || 
             $(li).text().trim().toLowerCase().startsWith('descripcion:');
    });
    if (descLi.length) {
      const strongText = descLi.find('strong').text().trim();
      description = descLi.html()?.replace(`<strong>${strongText}</strong>`, '').trim() || descLi.text().replace(strongText, '').trim();
    }

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
    console.warn(`[Colejobs] Error al extraer detalles de ${jobUrl}:`, error instanceof Error ? error.message : error);
    return {};
  }
}

export async function scrapeColejobs(): Promise<ScrapedJob[]> {
  console.log('=== [Colejobs] Iniciando extracción de vacantes ===');
  const jobListings: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  for (const region of TARGET_REGIONS) {
    const regionUrl = `${BASE_URL}/ofertas-de-empleo/${region}/`;
    try {
      console.log(`[Colejobs] Explorando región: ${regionUrl}`);
      const response = await axios.get(regionUrl, {
        headers: { 'User-Agent': getRandomUserAgent() },
        timeout: 8000
      });
      const $ = cheerio.load(response.data);

      const pageUrls: string[] = [regionUrl];
      $('.paginador a.paginate').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const fullPageUrl = href.startsWith('http') ? href : `${BASE_URL}/${href}`;
          if (!pageUrls.includes(fullPageUrl)) {
            pageUrls.push(fullPageUrl);
          }
        }
      });

      for (const pageUrl of pageUrls) {
        let pageData = response.data;
        if (pageUrl !== regionUrl) {
          await delay(300);
          const pageRes = await axios.get(pageUrl, {
            headers: { 'User-Agent': getRandomUserAgent() },
            timeout: 8000
          });
          pageData = pageRes.data;
        }

        const page$ = cheerio.load(pageData);
        page$('section.dos-columnas article').each((_, article) => {
          const a = page$(article).find('a').first();
          const href = a.attr('href');
          if (href && href.includes('ofertas-de-empleo/')) {
            const fullJobUrl = href.startsWith('http') ? href : `${BASE_URL}/${href}`;
            if (seenUrls.has(fullJobUrl)) return;

            const title = clean(page$(article).find('h3').text());
            const companyNameListing = clean(page$(article).find('h4').text());
            const publishDate = clean(page$(article).find('footer p').first().text());
            const metaText = clean(page$(article).find('footer p.meta').text());
            const metaParts = metaText.split('|').map(p => p.trim());
            const location = metaParts[0] || (region.charAt(0).toUpperCase() + region.slice(1));
            const hours = metaParts[1] || '';
            const contract = metaParts[2] || '';

            const logoText = page$(article).find('figure span').text().trim();
            let companyType = 'Colegio';
            if (logoText === 'CC') companyType = 'Colegio Concertado';
            if (logoText === 'CP') companyType = 'Colegio Privado';
            if (logoText === 'CCA') companyType = 'Colegio Catolico';

            const logoImg = page$(article).find('figure img').attr('src');
            const companyLogo = logoImg ? (logoImg.startsWith('http') ? logoImg : `${BASE_URL}/${logoImg}`) : undefined;

            seenUrls.add(fullJobUrl);
            const slugParts = href.split('/');
            const slug = slugParts[slugParts.length - 1] || slugParts[slugParts.length - 2];

            jobListings.push({
              id: slug,
              title,
              companyName: companyNameListing,
              companyLogo,
              companyType,
              location,
              province: region.charAt(0).toUpperCase() + region.slice(1),
              hours,
              contract,
              url: fullJobUrl,
              publishDate,
              requirements: [],
              scrapedAt: new Date().toISOString(),
              source: 'Colejobs'
            });
          }
        });
      }
    } catch (err) {
      console.warn(`[Colejobs] Omitiendo región ${region}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[Colejobs] Encontradas ${jobListings.length} ofertas en los listados.`);

  // Enrich details with politeness delay for top jobs (especially priority early childhood & recent offers)
  const detailedJobs: ScrapedJob[] = [];
  const maxDetailsToFetch = Math.min(jobListings.length, 30);

  // Sort so that preschool / infantil / primary / priority jobs get detailed info first
  jobListings.sort((a, b) => {
    const aLower = a.title.toLowerCase();
    const bLower = b.title.toLowerCase();
    const aIsInf = aLower.includes('infantil') || aLower.includes('preschool') || aLower.includes('auxiliar') || aLower.includes('tsei') ? 1 : 0;
    const bIsInf = bLower.includes('infantil') || bLower.includes('preschool') || bLower.includes('auxiliar') || bLower.includes('tsei') ? 1 : 0;
    return bIsInf - aIsInf;
  });

  for (let i = 0; i < maxDetailsToFetch; i++) {
    const job = jobListings[i];
    await delay(350);
    const details = await scrapeJobDetails(job.url);
    detailedJobs.push({
      ...job,
      ...details,
      companyName: details.companyName || job.companyName,
      location: details.location || job.location,
      hours: details.hours || job.hours,
      contract: details.contract || job.contract,
      requirements: details.requirements || []
    });
  }

  // Add the remaining listings
  for (let i = maxDetailsToFetch; i < jobListings.length; i++) {
    detailedJobs.push(jobListings[i]);
  }

  return detailedJobs;
}
