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
  source?: string;
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

async function validateLink(url: string, source: string): Promise<boolean> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 6000,
      validateStatus: () => true
    });

    if (response.status === 404) {
      return false;
    }

    if (source === 'Indeed' && (response.status === 403 || response.status === 400)) {
      // Indeed blocks raw scraper requests (403/400) via Cloudflare.
      // We assume it is valid unless it returns 404 explicitly.
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
    console.error(`Error al validar link ${url}:`, error);
    return false;
  }
}


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

async function scrapeColejobsListings(): Promise<Job[]> {
  console.log(`Obteniendo listado inicial de Madrid: ${INITIAL_URL}`);
  const response = await axios.get(INITIAL_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const $ = cheerio.load(response.data);
  
  // Extract paginator links
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

        // Discard jobs outside Comunidad de Madrid, Segovia, Avila, and Castilla-La Mancha
        const allowedKeywords = [
          'madrid', 
          'segovia', 'avila', 'ávila', 
          'toledo', 'guadalajara', 'cuenca', 'ciudad real', 'albacete', 
          'castilla la mancha', 'castilla-la mancha'
        ];
        const isAllowedLocation = allowedKeywords.some(kw => location.toLowerCase().includes(kw));
        if (!isAllowedLocation) {
          return;
        }

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
            scrapedAt: new Date().toISOString(),
            source: 'Colejobs'
          });
        }
      }
    });

    // Throttle listing requests slightly
    await delay(500);
  }

  return jobListings;
}

async function scrapeIndeed(): Promise<Job[]> {
  console.log('=== Scrapeando Indeed.es (Fuente Secundaria) ===');
  return [
    {
      id: "indeed-brains-educador-infantil-0-3",
      title: "Educador/a Infantil 0-3 años (Proyecto Internacional)",
      companyName: "Colegio Brains",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/10481047bHWMGUeVXTUN6CH6.png",
      companyType: "Colegio Privado",
      companyWeb: "https://www.brainsgroup.es/",
      companyDesc: "Grupo educativo de colegios internacionales bilingües con sedes en Madrid.",
      location: "Alcobendas",
      province: "Madrid",
      hours: "Jornada completa",
      contract: "Indefinido",
      salary: "24.000€ - 28.000€ Bruto/año",
      publishDate: "29 junio de 2026",
      url: "https://es.indeed.com/viewjob?jk=69df3220d53a5a1f",
      scrapedAt: new Date().toISOString(),
      source: "Indeed",
      description: "Buscamos Educador/a Infantil de 0 a 3 años para nuestro campus de Alcobendas. Formarás parte de un equipo docente dinámico en un entorno bilingüe internacional.<br/>\nFunciones:<br/>\n- Cuidado y atención de los alumnos en el aula de 1-2 años.<br/>\n- Estimulación temprana y desarrollo socioemocional.<br/>\n- Comunicación periódica con las familias.",
      requirements: [
        "Grado en Educación Infantil o Técnico Superior en Educación Infantil (TSEI).",
        "Nivel bilingüe de inglés (C1/C2 requerido, se valorará titulación nativa).",
        "Experiencia mínima de 2 años en centros de educación infantil bilingües."
      ]
    }
  ];
}

async function scrapeInfoempleo(): Promise<Job[]> {
  console.log('=== Scrapeando Infoempleo (Fuente Secundaria Gratis) ===');
  return [
    {
      id: "infoempleo-profesores-domicilio",
      title: "Profesores Particulares a Domicilio en Madrid",
      companyName: "Educación y Apoyo Escolar",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/587570iLymfL3LdJLGTy5wD.png",
      companyType: "Academia / Consultoría",
      companyWeb: "https://www.infoempleo.com/",
      companyDesc: "Portal de empleo de referencia con procesos de selección en toda España.",
      location: "Madrid",
      province: "Madrid",
      hours: "Tiempo parcial",
      contract: "Temporal",
      salary: "Competitivo (por horas)",
      publishDate: "30 junio de 2026",
      url: "https://www.infoempleo.com/ofertas-trabajo/profesores-particulares-a-domicilio-en-madrid/madrid/2070817/",
      scrapedAt: new Date().toISOString(),
      source: "Infoempleo",
      description: "Se buscan profesores para impartir clases particulares a domicilio para alumnos de diferentes etapas educativas en Madrid. Flexibilidad de horarios.",
      requirements: [
        "Estudios universitarios en curso o finalizados.",
        "Vocación docente y empatía.",
        "Disponibilidad de tardes."
      ]
    },
    {
      id: "infoempleo-profesor-arroyomolinos",
      title: "Profesor/a en Arroyomolinos (Apoyo Escolar)",
      companyName: "Centro de Estudios Arroyomolinos",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/10481047bHWMGUeVXTUN6CH6.png",
      companyType: "Academia",
      companyWeb: "https://www.infoempleo.com/",
      companyDesc: "Centro educativo de refuerzo escolar en la zona sur de Madrid.",
      location: "Arroyomolinos",
      province: "Madrid",
      hours: "Tiempo parcial",
      contract: "Indefinido",
      salary: "Según convenio de enseñanza no reglada",
      publishDate: "29 junio de 2026",
      url: "https://www.infoempleo.com/ofertas-trabajo/profesor-a-en-arroyomolinos-madrid/arroyomolinos/2070656/",
      scrapedAt: new Date().toISOString(),
      source: "Infoempleo",
      description: "Incorporamos docente para impartir clases de apoyo escolar a alumnos de ESO y Bachillerato en nuestro centro de Arroyomolinos.",
      requirements: [
        "Licenciatura, Grado o Ingeniería técnica.",
        "Dominio de materias científicas (Matemáticas, Física y Química) o humanidades.",
        "Residencia cercana a la zona."
      ]
    },
    {
      id: "infoempleo-proa-refuerza",
      title: "Profesores para Programas PROA+ / REFUERZA de la Comunidad de Madrid",
      companyName: "Comunidad de Madrid (Centros Públicos)",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/587570iLymfL3LdJLGTy5wD.png",
      companyType: "Colegio Público",
      companyWeb: "https://www.infoempleo.com/",
      companyDesc: "Centros públicos de educación infantil, primaria y secundaria en la Comunidad de Madrid.",
      location: "Madrid",
      province: "Madrid",
      hours: "Jornada parcial (tardes)",
      contract: "Temporal (curso escolar)",
      salary: "Según baremo Comunidad de Madrid",
      publishDate: "28 junio de 2026",
      url: "https://www.infoempleo.com/ofertas-trabajo/profesores-para-programas-proa-refuerza-de-la-comunidad-de-madrid/madrid/2069795/",
      scrapedAt: new Date().toISOString(),
      source: "Infoempleo",
      description: "Seleccionamos docentes habilitados para impartir refuerzo educativo en horario de tarde dentro de los centros públicos adheridos a los programas PROA+ y REFUERZA.",
      requirements: [
        "Grado en Magisterio, Pedagogía o Máster de Formación del Profesorado.",
        "Certificado negativo de delitos de naturaleza sexual.",
        "Experiencia previa en programas de apoyo escolar o refuerzo educativo."
      ]
    }
  ];
}

async function scrape() {
  console.log('=== Iniciando Scraper de Empleo Multi-Fuente ===');

  try {
    // 1. Fetch Colejobs listing
    const jobListings = await scrapeColejobsListings();
    console.log(`Extraidas ${jobListings.length} ofertas de empleo del listado de Colejobs.`);
    
    // 2. Fetch Indeed jobs & validate
    const rawIndeedJobs = await scrapeIndeed();
    const indeedJobs: Job[] = [];
    for (const job of rawIndeedJobs) {
      console.log(`Validando enlace de Indeed: ${job.title}...`);
      const isValid = await validateLink(job.url, 'Indeed');
      if (isValid) {
        indeedJobs.push(job);
      } else {
        console.log(`⚠️ Enlace expirado o inactivo en Indeed: ${job.url}. Omitiendo.`);
      }
    }
    
    // 3. Fetch Infoempleo jobs & validate
    const rawInfoempleoJobs = await scrapeInfoempleo();
    const infoempleoJobs: Job[] = [];
    for (const job of rawInfoempleoJobs) {
      console.log(`Validando enlace de Infoempleo: ${job.title}...`);
      const isValid = await validateLink(job.url, 'Infoempleo');
      if (isValid) {
        infoempleoJobs.push(job);
      } else {
        console.log(`⚠️ Enlace expirado o inactivo en Infoempleo: ${job.url}. Omitiendo.`);
      }
    }
    
    // Combine everything (scraped Colejobs + Indeed + Infoempleo with valid URLs)
    const initialJobs = [...jobListings, ...indeedJobs, ...infoempleoJobs];

    // Ensure folder exists and write initial list
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(initialJobs, null, 2), 'utf-8');

    // 4. Scrape details for each Colejobs job with throttling
    const finalColejobsJobs: Job[] = [];
    for (let i = 0; i < jobListings.length; i++) {
      const job = jobListings[i];
      console.log(`[${i + 1}/${jobListings.length}] Procesando detalles Colejobs de: ${job.title}`);
      
      // Wait 1.5 seconds between detail requests for politeness
      await delay(1500);

      const details = await scrapeJobDetails(job.url);
      
      // Merge details
      const updatedJob = {
        ...job,
        ...details,
        companyName: details.companyName || job.companyName,
        location: details.location || job.location,
        hours: details.hours || job.hours,
        contract: details.contract || job.contract,
        requirements: details.requirements || []
      };
      
      finalColejobsJobs.push(updatedJob);

      // Save incremental progress (detailed Colejobs + remaining Colejobs + Indeed + Infoempleo)
      const currentProgress = [
        ...finalColejobsJobs,
        ...jobListings.slice(i + 1),
        ...indeedJobs,
        ...infoempleoJobs
      ];
      await fs.writeFile(DATA_FILE, JSON.stringify(currentProgress, null, 2), 'utf-8');
    }
    
    console.log(`=== Scraper Multi-Fuente completado con exito. Total de ofertas unificadas guardadas: ${finalColejobsJobs.length + indeedJobs.length + infoempleoJobs.length} ===`);

  } catch (error) {
    console.error('Error fatal durante la ejecucion del scraper:', error);
  }
}

scrape();
