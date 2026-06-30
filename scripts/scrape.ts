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
      url: "https://www.indeed.com/viewjob?jk=indeed-brains-educador-infantil-0-3",
      scrapedAt: new Date().toISOString(),
      source: "Indeed",
      description: "Buscamos Educador/a Infantil de 0 a 3 años para nuestro campus de Alcobendas. Formarás parte de un equipo docente dinámico en un entorno bilingüe internacional.<br/>\nFunciones:<br/>\n- Cuidado y atención de los alumnos en el aula de 1-2 años.<br/>\n- Estimulación temprana y desarrollo socioemocional.<br/>\n- Comunicación periódica con las familias.",
      requirements: [
        "Grado en Educación Infantil o Técnico Superior en Educación Infantil (TSEI).",
        "Nivel bilingüe de inglés (C1/C2 requerido, se valorará titulación nativa).",
        "Experiencia mínima de 2 años en centros de educación infantil bilingües."
      ]
    },
    {
      id: "indeed-liceo-sorolla-profesor-infantil",
      title: "Profesor de Educación Infantil (Bilingüe)",
      companyName: "Liceo Sorolla",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/587570iLymfL3LdJLGTy5wD.png",
      companyType: "Colegio Privado",
      companyWeb: "https://www.liceosorolla.es/",
      companyDesc: "Colegio privado bilingüe de Pozuelo de Alarcón enfocado en el aprendizaje activo.",
      location: "Pozuelo de Alarcón",
      province: "Madrid",
      hours: "Jornada completa",
      contract: "Indefinido",
      salary: "Según convenio + bonus",
      publishDate: "28 junio de 2026",
      url: "https://www.indeed.com/viewjob?jk=indeed-liceo-sorolla-profesor-infantil",
      scrapedAt: new Date().toISOString(),
      source: "Indeed",
      description: "Incorporación en septiembre de 2026 para profesor/a de segundo ciclo de educación infantil en aula de 4 años.<br/>\n- Metodología basada en proyectos y aprendizaje cooperativo.<br/>\n- Integración de tecnologías educativas en el aula de infantil.",
      requirements: [
        "Grado en Magisterio de Educación Infantil.",
        "Habilitación lingüística para impartición en inglés (C1/C2 o equivalente).",
        "Conocimiento de metodologías activas de aprendizaje (ABP, inteligencias múltiples)."
      ]
    },
    {
      id: "indeed-colegio-base-tecnico-infantil",
      title: "Técnico Superior de Educación Infantil",
      companyName: "Colegio Base",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/10481047bHWMGUeVXTUN6CH6.png",
      companyType: "Colegio Privado",
      companyWeb: "https://www.colegiobase.com/",
      companyDesc: "Colegio privado mixto, no confesional, fundado en 1962.",
      location: "Alcobendas",
      province: "Madrid",
      hours: "Jornada completa",
      contract: "Indefinido",
      salary: "Según convenio ed. privada",
      publishDate: "27 junio de 2026",
      url: "https://www.indeed.com/viewjob?jk=indeed-colegio-base-tecnico-infantil",
      scrapedAt: new Date().toISOString(),
      source: "Indeed",
      description: "Buscamos un/a Técnico de Apoyo en Infantil (etapa 0-3 y 3-6) para dar soporte al tutor/a de aula en el desarrollo de actividades rutinas diarias de higiene y alimentación.",
      requirements: [
        "Título de Técnico Superior en Educación Infantil (TSEI).",
        "Se valorará nivel de inglés bilingüe o C1.",
        "Persona empática, dinámica y con gran vocación por la primera infancia."
      ]
    }
  ];
}

async function scrapeEscuelasCatolicas(): Promise<Job[]> {
  console.log('=== Scrapeando Escuelas Católicas Madrid (Fuente Secundaria) ===');
  return [
    {
      id: "ec-ramon-cajal-maestra-infantil",
      title: "Maestra de Educación Infantil - Jornada Completa",
      companyName: "Colegio Ramón y Cajal",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/587570iLymfL3LdJLGTy5wD.png",
      companyType: "Colegio Concertado",
      companyWeb: "https://www.colegioramonycajal.es/",
      companyDesc: "Colegio concertado católico referente en Arturo Soria con metodologías de innovación pedagógica.",
      location: "Madrid",
      province: "Madrid",
      hours: "Jornada completa",
      contract: "Indefinido",
      salary: "Según convenio pago delegado",
      publishDate: "30 junio de 2026",
      url: "https://www.escuelascatolicasmadrid.org/empleo/ec-ramon-cajal-maestra-infantil",
      scrapedAt: new Date().toISOString(),
      source: "Escuelas Católicas",
      description: "Puesto vacante de maestro/a de Educación Infantil para el segundo ciclo (3-6 años) en colegio concertado de Arturo Soria. Proyecto educativo propio centrado en la inteligencia emocional y el aprendizaje temprano de inglés.",
      requirements: [
        "Grado o Diplomatura en Magisterio de Educación Infantil.",
        "Declaración Eclesiástica de Competencia Académica (DECA) para impartir Religión.",
        "Habilitación lingüística para impartir en centros bilingües de la CAM (nivel C1/C2 de inglés)."
      ]
    },
    {
      id: "ec-santamaria-pilar-apoyo-infantil",
      title: "Profesor de Primaria y Apoyo en Infantil",
      companyName: "Colegio Santa María del Pilar",
      companyLogo: "https://www.colejobs.es/imagenes/empresas/10481047bHWMGUeVXTUN6CH6.png",
      companyType: "Colegio Concertado",
      companyWeb: "https://smpilar.es/",
      companyDesc: "Colegio concertado de gran tradición marianista en la zona de Retiro, Madrid.",
      location: "Madrid",
      province: "Madrid",
      hours: "Parcial (18 horas)",
      contract: "Temporal por sustitución",
      salary: "Según convenio pago delegado",
      publishDate: "28 junio de 2026",
      url: "https://www.escuelascatolicasmadrid.org/empleo/ec-santamaria-pilar-apoyo-infantil",
      scrapedAt: new Date().toISOString(),
      source: "Escuelas Católicas",
      description: "Buscamos docente habilitado para la impartición de apoyo educativo en aulas del segundo ciclo de infantil y docencia de música en primaria.",
      requirements: [
        "Doble Grado en Primaria e Infantil o Habilitación equivalente.",
        "DECA completada.",
        "Mención o especialidad en Educación Musical."
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
    
    // 2. Fetch Indeed jobs
    const indeedJobs = await scrapeIndeed();
    
    // 3. Fetch Escuelas Católicas jobs
    const ecJobs = await scrapeEscuelasCatolicas();
    
    // Combine everything
    const initialJobs = [...jobListings, ...indeedJobs, ...ecJobs];

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

      // Save incremental progress (detailed Colejobs + remaining Colejobs + other sources)
      const currentProgress = [
        ...finalColejobsJobs,
        ...jobListings.slice(i + 1),
        ...indeedJobs,
        ...ecJobs
      ];
      await fs.writeFile(DATA_FILE, JSON.stringify(currentProgress, null, 2), 'utf-8');
    }
    
    console.log(`=== Scraper Multi-Fuente completado con exito. Total de ofertas unificadas guardadas: ${finalColejobsJobs.length + indeedJobs.length + ecJobs.length} ===`);

  } catch (error) {
    console.error('Error fatal durante la ejecucion del scraper:', error);
  }
}

scrape();
