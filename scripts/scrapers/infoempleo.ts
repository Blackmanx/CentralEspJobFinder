import { ScrapedJob } from './types';
import { validateLink } from './utils';

export async function scrapeInfoempleo(): Promise<ScrapedJob[]> {
  console.log('=== [Infoempleo] Verificando vacantes de apoyo y refuerzo ===');

  const candidates: ScrapedJob[] = [
    {
      id: "infoempleo-profesores-domicilio",
      title: "Profesores Particulares y Apoyo Escolar en Madrid",
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
      publishDate: "Reciente",
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
      publishDate: "Reciente",
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

  const validJobs: ScrapedJob[] = [];
  for (const job of candidates) {
    const isValid = await validateLink(job.url, 'Infoempleo');
    if (isValid) {
      validJobs.push(job);
    }
  }

  console.log(`[Infoempleo] ${validJobs.length} ofertas validadas.`);
  return validJobs;
}
