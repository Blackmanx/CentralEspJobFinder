import * as fs from 'fs/promises';
import path from 'path';
import { isConcreteJobUrl, validateLink } from './scrapers/utils';
import { ScrapedJob } from './scrapers/types';

const dataFile = path.join(process.cwd(), 'public', 'data', 'jobs.json');

async function main(): Promise<void> {
  const jobs = JSON.parse(await fs.readFile(dataFile, 'utf8')) as ScrapedJob[];
  const failures: string[] = [];
  for (let i = 0; i < jobs.length; i += 8) {
    const batch = jobs.slice(i, i + 8);
    const checks = await Promise.all(batch.map(async job => ({
      job,
      concrete: isConcreteJobUrl(job.url, job.source || ''),
      reachable: await validateLink(job.url, job.source || 'Fuente')
    })));
    for (const result of checks) {
      if (!result.concrete || !result.reachable) failures.push(`${result.job.source}: ${result.job.url}`);
    }
    console.log(`Comprobadas ${Math.min(i + 8, jobs.length)}/${jobs.length} URLs`);
  }
  if (failures.length) {
    console.error(`\n❌ ${failures.length} enlaces inválidos:`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log(`\n✅ Todas las ${jobs.length} ofertas tienen una URL de detalle accesible.`);
}

main().catch(error => {
  console.error('No se pudo validar jobs.json:', error);
  process.exitCode = 1;
});
