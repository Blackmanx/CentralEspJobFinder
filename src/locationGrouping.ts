import { Job } from './types/job';

export const AUTONOMOUS_COMMUNITIES = [
  'Andalucía',
  'Aragón',
  'Asturias',
  'Illes Balears',
  'Canarias',
  'Cantabria',
  'Castilla-La Mancha',
  'Castilla y León',
  'Cataluña',
  'Comunidad Valenciana',
  'Extremadura',
  'Galicia',
  'La Rioja',
  'Comunidad de Madrid',
  'Región de Murcia',
  'Navarra',
  'País Vasco',
  'Ceuta',
  'Melilla',
  'Toda España',
  'Sin comunidad identificada'
] as const;

type AutonomousCommunity = typeof AUTONOMOUS_COMMUNITIES[number];

const PROVINCE_TO_COMMUNITY: Record<string, AutonomousCommunity> = {
  alava: 'País Vasco', araba: 'País Vasco', albacete: 'Castilla-La Mancha',
  alicante: 'Comunidad Valenciana', almeria: 'Andalucía', asturias: 'Asturias',
  avila: 'Castilla y León', badajoz: 'Extremadura', baleares: 'Illes Balears',
  'balears illes': 'Illes Balears',
  barcelona: 'Cataluña', bizkaia: 'País Vasco', vizcaya: 'País Vasco',
  burgos: 'Castilla y León', caceres: 'Extremadura', cadiz: 'Andalucía',
  cantabria: 'Cantabria', castellon: 'Comunidad Valenciana', castello: 'Comunidad Valenciana',
  ciudadreal: 'Castilla-La Mancha', cordoba: 'Andalucía', cuenca: 'Castilla-La Mancha',
  girona: 'Cataluña', gerona: 'Cataluña', granada: 'Andalucía',
  guadalajara: 'Castilla-La Mancha', guipuzcoa: 'País Vasco', gipuzkoa: 'País Vasco',
  huelva: 'Andalucía', huesca: 'Aragón', jaen: 'Andalucía',
  lacoruna: 'Galicia', coruna: 'Galicia', leon: 'Castilla y León', lleida: 'Cataluña',
  lerida: 'Cataluña', lugo: 'Galicia', madrid: 'Comunidad de Madrid',
  malaga: 'Andalucía', murcia: 'Región de Murcia', navarra: 'Navarra',
  ourense: 'Galicia', orense: 'Galicia', palencia: 'Castilla y León',
  pontevedra: 'Galicia', salamanca: 'Castilla y León', segovia: 'Castilla y León',
  sevilla: 'Andalucía', soria: 'Castilla y León', tarragona: 'Cataluña',
  teruel: 'Aragón', toledo: 'Castilla-La Mancha', valencia: 'Comunidad Valenciana',
  valladolid: 'Castilla y León', zamora: 'Castilla y León', zaragoza: 'Aragón',
  laspalmas: 'Canarias', santacruzdetenerife: 'Canarias',
  rioja: 'La Rioja', 'la rioja': 'La Rioja'
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compact(value: string): string {
  return normalize(value).replace(/\s+/g, '');
}

function extractProvince(job: Job): string {
  const province = job.province || '';
  const location = job.location || '';
  const parenthesized = location.match(/\(([^)]+)\)/)?.[1] || '';
  return normalize(`${province} ${location} ${parenthesized}`);
}

export function getAutonomousCommunity(job: Job): AutonomousCommunity {
  const provinceText = normalize(job.province || '');
  const locationText = normalize(job.location || '');
  const text = normalize(`${job.province || ''} ${job.location || ''}`);
  if (locationText === 'espana' || (provinceText === 'espana' && !locationText)) return 'Toda España';

  const communityAliases: Array<[string, AutonomousCommunity]> = [
    ['comunidad de madrid', 'Comunidad de Madrid'],
    ['castilla la mancha', 'Castilla-La Mancha'],
    ['castilla y leon', 'Castilla y León'],
    ['comunidad valenciana', 'Comunidad Valenciana'],
    ['illes balears', 'Illes Balears'],
    ['islas baleares', 'Illes Balears'],
    ['region de murcia', 'Región de Murcia'],
    ['pais vasco', 'País Vasco'],
    ['santa cruz de tenerife', 'Canarias'],
    ['las palmas', 'Canarias'],
    ['andalucia', 'Andalucía'],
    ['aragon', 'Aragón'],
    ['galicia', 'Galicia'],
    ['cantabria', 'Cantabria'],
    ['extremadura', 'Extremadura'],
    ['navarra', 'Navarra'],
    ['asturias', 'Asturias'],
    ['la rioja', 'La Rioja'],
    ['ceuta', 'Ceuta'],
    ['melilla', 'Melilla']
  ];
  const community = communityAliases.find(([alias]) => text.includes(alias));
  if (community) return community[1];

  const provinceFields = extractProvince(job);
  for (const [province, communityName] of Object.entries(PROVINCE_TO_COMMUNITY)) {
    if (provinceFields.includes(province)) return communityName;
  }

  return 'Sin comunidad identificada';
}

function cleanMunicipality(value: string): string {
  let result = value.trim().replace(/^\d{5}\s*\/\s*/, '');
  result = result.replace(/\s*\([^)]*\)\s*$/, '');
  result = result.split(' / ')[0].trim();

  const commaParts = result.split(',').map(part => part.trim()).filter(Boolean);
  if (commaParts.length > 1 && PROVINCE_TO_COMMUNITY[compact(commaParts[commaParts.length - 1])]) {
    result = commaParts.slice(0, -1).join(', ');
  }

  return result || 'Ubicación no especificada';
}

export function getMunicipalityKey(job: Job): string {
  const location = cleanMunicipality(job.location || job.province || '');
  return normalize(location);
}

export function getLocationFilterKey(job: Job): string {
  return `${getAutonomousCommunity(job)}::${getMunicipalityKey(job)}`;
}

export function getMunicipalityLabel(job: Job): string {
  return cleanMunicipality(job.location || job.province || '');
}
