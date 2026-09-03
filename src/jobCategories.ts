export interface JobCategoryFields {
  title?: string;
  source?: string;
  companyType?: string;
}

function normalize(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Official public vacancies and employment pools surfaced by the scrapers. */
export function isOfficialPublicJob(job: JobCategoryFields): boolean {
  const source = normalize(job.source);
  const companyType = normalize(job.companyType);
  const title = normalize(job.title);

  return source.includes('sistema nacional de empleo') ||
    source.includes('oficina virtual madrid') ||
    source.includes('administracion publica') ||
    source.includes('bolsa') ||
    companyType.includes('bolsa') ||
    title.includes('bolsa');
}

export function isUnedJob(job: JobCategoryFields): boolean {
  return normalize(`${job.source || ''} ${job.companyType || ''} ${job.title || ''}`)
    .includes('uned');
}
