import { ScrapedJob } from './types';

interface LocationHint {
  aliases: string[];
  location: string;
  province: string;
}

/**
 * Fallback catalogue for sources such as InfoJobs whose search result only
 * reports "España" while the job title contains the work area. Keep the
 * aliases conservative: a false municipality is worse than leaving Spain.
 */
const LOCATION_HINTS: LocationHint[] = [
  { aliases: ['Valdemorillo / Villafranca del Castillo'], location: 'Valdemorillo / Villafranca del Castillo', province: 'Madrid' },
  { aliases: ['Cangas del Narcea'], location: 'Cangas del Narcea', province: 'Asturias' },
  { aliases: ['Baix Llobregat'], location: 'Baix Llobregat', province: 'Barcelona' },
  { aliases: ['Los Cristianos'], location: 'Los Cristianos (Arona)', province: 'Santa Cruz de Tenerife' },
  { aliases: ['Cala Millor'], location: 'Cala Millor', province: 'Illes Balears' },
  { aliases: ['Las Rozas de Madrid', 'Las Rozas'], location: 'Las Rozas de Madrid', province: 'Madrid' },
  { aliases: ['Alcobendas'], location: 'Alcobendas', province: 'Madrid' },
  { aliases: ['Móstoles'], location: 'Móstoles', province: 'Madrid' },
  { aliases: ['El Escorial'], location: 'El Escorial', province: 'Madrid' },
  { aliases: ['Valdemorillo'], location: 'Valdemorillo', province: 'Madrid' },
  { aliases: ['Las Tablas'], location: 'Las Tablas', province: 'Madrid' },
  { aliases: ['Madrid'], location: 'Madrid', province: 'Madrid' },
  { aliases: ['Barcelona'], location: 'Barcelona', province: 'Barcelona' },
  { aliases: ['L’Hospitalet de Llobregat', "L'Hospitalet de Llobregat", 'Hospitalet de Llobregat'], location: "L'Hospitalet de Llobregat", province: 'Barcelona' },
  { aliases: ['Badalona'], location: 'Badalona', province: 'Barcelona' },
  { aliases: ['Sabadell'], location: 'Sabadell', province: 'Barcelona' },
  { aliases: ['Terrassa'], location: 'Terrassa', province: 'Barcelona' },
  { aliases: ['Oviedo'], location: 'Oviedo', province: 'Asturias' },
  { aliases: ['Gijón', 'Gijon'], location: 'Gijón', province: 'Asturias' },
  { aliases: ['Avilés', 'Aviles'], location: 'Avilés', province: 'Asturias' },
  { aliases: ['Burgos'], location: 'Burgos', province: 'Burgos' },
  { aliases: ['León', 'Leon'], location: 'León', province: 'León' },
  { aliases: ['Salamanca'], location: 'Salamanca', province: 'Salamanca' },
  { aliases: ['Segovia'], location: 'Segovia', province: 'Segovia' },
  { aliases: ['Valladolid'], location: 'Valladolid', province: 'Valladolid' },
  { aliases: ['Ávila', 'Avila'], location: 'Ávila', province: 'Ávila' },
  { aliases: ['Benidorm'], location: 'Benidorm', province: 'Alicante' },
  { aliases: ['Alicante'], location: 'Alicante', province: 'Alicante' },
  { aliases: ['Valencia'], location: 'Valencia', province: 'Valencia' },
  { aliases: ['Castellón', 'Castellon'], location: 'Castellón', province: 'Castellón' },
  { aliases: ['Sevilla'], location: 'Sevilla', province: 'Sevilla' },
  { aliases: ['Málaga', 'Malaga'], location: 'Málaga', province: 'Málaga' },
  { aliases: ['Granada'], location: 'Granada', province: 'Granada' },
  { aliases: ['Córdoba', 'Cordoba'], location: 'Córdoba', province: 'Córdoba' },
  { aliases: ['Marbella'], location: 'Marbella', province: 'Málaga' },
  { aliases: ['Palma', 'Mallorca'], location: 'Mallorca', province: 'Illes Balears' },
  { aliases: ['Santa Cruz de Tenerife'], location: 'Santa Cruz de Tenerife', province: 'Santa Cruz de Tenerife' },
  { aliases: ['Las Palmas de Gran Canaria', 'Las Palmas'], location: 'Las Palmas de Gran Canaria', province: 'Las Palmas' },
  { aliases: ['Toledo'], location: 'Toledo', province: 'Toledo' },
  { aliases: ['Albacete'], location: 'Albacete', province: 'Albacete' },
  { aliases: ['Ciudad Real'], location: 'Ciudad Real', province: 'Ciudad Real' },
  { aliases: ['Cuenca'], location: 'Cuenca', province: 'Cuenca' },
  { aliases: ['Guadalajara'], location: 'Guadalajara', province: 'Guadalajara' },
  { aliases: ['Talavera de la Reina'], location: 'Talavera de la Reina', province: 'Toledo' },
  { aliases: ['Vigo'], location: 'Vigo', province: 'Pontevedra' },
  { aliases: ['A Coruña', 'La Coruña', 'Coruña'], location: 'A Coruña', province: 'A Coruña' },
  { aliases: ['Bilbao'], location: 'Bilbao', province: 'Bizkaia' },
  { aliases: ['Vitoria', 'Vitoria-Gasteiz'], location: 'Vitoria-Gasteiz', province: 'Álava' },
  { aliases: ['Pamplona'], location: 'Pamplona', province: 'Navarra' },
  { aliases: ['Zaragoza'], location: 'Zaragoza', province: 'Zaragoza' }
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function containsAlias(title: string, alias: string): boolean {
  const normalizedTitle = normalize(title);
  const normalizedAlias = normalize(alias);
  if (!normalizedAlias) return false;
  const escapedAlias = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^a-z0-9])${escapedAlias}(?:$|[^a-z0-9])`, 'i').test(normalizedTitle);
}

function isGenericLocation(value: string): boolean {
  return /^(?:espana|spain|nacional|todo el territorio nacional)$/i.test(normalize(value));
}

/** Fill a generic source location from a municipality/province in the title. */
export function enrichJobLocation(job: ScrapedJob): ScrapedJob {
  const location = job.location || '';
  const province = job.province || '';
  if (!isGenericLocation(location) && !isGenericLocation(province)) return job;

  for (const hint of LOCATION_HINTS) {
    if (hint.aliases.some(alias => containsAlias(job.title, alias))) {
      return {
        ...job,
        location: hint.location,
        province: hint.province,
        locationFromTitle: true
      };
    }
  }

  return job;
}
