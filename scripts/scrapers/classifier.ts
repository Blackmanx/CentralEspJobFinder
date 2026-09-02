import { ScrapedJob } from './types';

/**
 * Domain-Specific Classifier & Convenio Analyzer for Early Childhood & Teaching Jobs in Spain.
 * Classifies exact certifications:
 * - TSEI (Técnico Superior en Educación Infantil / FP Grado Superior)
 * - Magisterio_Infantil (Grado universitario / Diplomatura)
 * - Monitor_Ocio (Monitor de Ocio y Tiempo Libre / Extraescolares / Ludotecas)
 * - Auxiliar_Infancia (Auxiliar de Aula / Jardín de Infancia / Cuidador)
 *
 * References the standard Spanish Collective Agreements:
 * - XII Convenio Colectivo de Centros de Asistencia y Educación Infantil (0-3 años)
 * - VII Convenio Colectivo de Empresas de Enseñanza Privada sostenidas con Fondos Públicos (Concertada)
 * - Convenio Colectivo de Ocio Educativo y Animación Sociocultural
 */
export function classifyAndEnrichJob(job: ScrapedJob): ScrapedJob {
  const fullText = `${job.title} ${job.description || ''} ${(job.requirements || []).join(' ')} ${job.hours || ''} ${job.contract || ''} ${job.salary || ''}`.toLowerCase();

  const titleLower = job.title.toLowerCase();
  const descLower = (job.description || '').toLowerCase();
  const reqsLower = (job.requirements || []).join(' ').toLowerCase();

  const certificationTags: ('TSEI' | 'Magisterio_Infantil' | 'Monitor_Ocio' | 'Auxiliar_Infancia')[] = [];

  // 1. Check TSEI (FP Grado Superior / Educador 0-3)
  const isExplicitTsei = 
    titleLower.includes('tsei') ||
    titleLower.includes('técnico') && titleLower.includes('infantil') ||
    titleLower.includes('tecnico') && titleLower.includes('infantil') ||
    titleLower.includes('educador') && titleLower.includes('infantil') ||
    titleLower.includes('educadora') && titleLower.includes('infantil') ||
    descLower.includes('técnico superior en educación infantil') ||
    descLower.includes('tecnico superior en educacion infantil') ||
    reqsLower.includes('tsei') ||
    reqsLower.includes('técnico superior en educación infantil') ||
    reqsLower.includes('técnico de educación infantil');

  if (isExplicitTsei) {
    certificationTags.push('TSEI');
  }

  // 2. Check Magisterio Infantil (Grado Universitario / Colegios 2º ciclo 3-6)
  const isMagisterio = 
    titleLower.includes('maestro') && (titleLower.includes('infantil') || titleLower.includes('preschool')) ||
    titleLower.includes('maestra') && (titleLower.includes('infantil') || titleLower.includes('preschool')) ||
    titleLower.includes('profesor') && titleLower.includes('infantil') ||
    titleLower.includes('profesora') && titleLower.includes('infantil') ||
    titleLower.includes('preschool teacher') ||
    titleLower.includes('nursery teacher') ||
    descLower.includes('grado en educación infantil') ||
    descLower.includes('magisterio de educación infantil') ||
    reqsLower.includes('grado en educación infantil') ||
    reqsLower.includes('magisterio de educación infantil');

  if (isMagisterio) {
    certificationTags.push('Magisterio_Infantil');
  }

  // 3. Check Monitor Ocio / Comedor / Extraescolares
  const isMonitor = 
    titleLower.includes('monitor') ||
    titleLower.includes('monitores') ||
    titleLower.includes('animador') ||
    titleLower.includes('ocio y tiempo libre') ||
    titleLower.includes('ludoteca') ||
    titleLower.includes('comedor') ||
    titleLower.includes('patio') ||
    titleLower.includes('ruta escolar') ||
    titleLower.includes('extraescolar');

  if (isMonitor) {
    certificationTags.push('Monitor_Ocio');
  }

  // 4. Check Auxiliar de Infancia
  const isAuxiliar = 
    titleLower.includes('auxiliar de infancia') ||
    titleLower.includes('auxiliar infantil') ||
    titleLower.includes('teacher assistant') ||
    titleLower.includes('auxiliar de segundo ciclo') ||
    titleLower.includes('auxiliar de jardín de infancia') ||
    titleLower.includes('auxiliar de guardería') ||
    titleLower.includes('auxiliar de guarderia') ||
    descLower.includes('auxiliar de escuela infantil');

  if (isAuxiliar && !certificationTags.includes('Auxiliar_Infancia')) {
    certificationTags.push('Auxiliar_Infancia');
  }

  // Determine applicable Spanish collective agreement (Convenio)
  let convenioInfo: ScrapedJob['convenioInfo'] | undefined = undefined;

  const is0to3 = 
    fullText.includes('0-3') || 
    fullText.includes('0 a 3') || 
    fullText.includes('primer ciclo') || 
    fullText.includes('guardería') || 
    fullText.includes('guarderia') || 
    fullText.includes('nemomarlin') ||
    fullText.includes('escuela infantil');

  const isConcertada = 
    job.companyType?.toLowerCase().includes('concertado') || 
    job.companyType?.toLowerCase().includes('catolico') ||
    fullText.includes('concertad');

  if (is0to3 && !isConcertada) {
    convenioInfo = {
      convenioName: 'Convenio Colectivo Estatal de Centros de Asistencia y Educación Infantil (0-3 años)',
      applicableCategory: certificationTags.includes('TSEI') ? 'Educador/a Infantil (Grupo II)' : 'Personal de Aula / Auxiliar',
      referenceSalary: '1.200€ - 1.450€ Bruto/mes (según tablas actualizadas)',
      stage: '0-3_años'
    };
  } else if (isMonitor) {
    convenioInfo = {
      convenioName: 'Convenio Colectivo de Ocio Educativo y Animación Sociocultural / Colectividades',
      applicableCategory: 'Monitor/a de Actividades / Comedor y Acompañamiento',
      referenceSalary: '11,50€ - 14,00€ Bruto/hora o proporcional a jornada parcial',
      stage: 'Ocio_Comedor'
    };
  } else if (isConcertada) {
    convenioInfo = {
      convenioName: 'VII Convenio Colectivo de Enseñanza Concertada',
      applicableCategory: certificationTags.includes('Magisterio_Infantil') ? 'Profesor/a Titular 2º Ciclo Infantil' : 'Personal Complementario / Aula',
      referenceSalary: 'Tablas salariales de la Comunidad de Madrid (pago delegado)',
      stage: '3-6_años'
    };
  } else if (certificationTags.includes('Magisterio_Infantil') || fullText.includes('infantil')) {
    convenioInfo = {
      convenioName: 'Convenio Colectivo de Enseñanza Privada / Infantil',
      applicableCategory: 'Maestro/a de Educación Infantil (3-6 años)',
      referenceSalary: 'Según convenio de enseñanza privada',
      stage: '3-6_años'
    };
  }

  return {
    ...job,
    certificationTags: certificationTags.length > 0 ? certificationTags : undefined,
    convenioInfo
  };
}
