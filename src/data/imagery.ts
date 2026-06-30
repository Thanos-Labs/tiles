export type Bbox = [number, number, number, number];
export type SiteType = 'port' | 'naval' | 'shipyard';

export type Site = {
  id: string;
  type: SiteType;
  name: string;
  lat: number;
  lng: number;
  bbox: Bbox;
};

export type SatelliteLocation = {
  id: string;
  name: string;
  bbox: Bbox;
};

export type StacItem = {
  id: string;
  assets?: Record<string, unknown>;
  properties?: {
    datetime?: string;
  };
};

export const POI_URL = 'https://thanos-labs.github.io/naval-data/data/poi.json';
export const STAC_API = 'https://planetarycomputer.microsoft.com/api/stac/v1';
export const PLANETARY_COMPUTER_TILES = 'https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x';

export async function loadImageryLocations(): Promise<SatelliteLocation[]> {
  return extractSatelliteLocations(await fetchJson(POI_URL));
}

export async function loadSites(): Promise<Site[]> {
  return extractSites(await fetchJson(POI_URL));
}

export async function stacSearchLatestByBbox(collection: string, bbox: Bbox, requiredAssets: string[] = []): Promise<StacItem | null> {
  const params = new URLSearchParams({
    collections: collection,
    bbox: bbox.join(','),
    limit: requiredAssets.length > 0 ? '25' : '1',
    sortby: '-datetime',
  });
  const data = await fetchJson(`${STAC_API}/search?${params.toString()}`);
  if (!isRecord(data) || !Array.isArray(data.features)) return null;
  return (data.features as StacItem[]).find((item) => requiredAssets.every((asset) => item.assets?.[asset])) ?? null;
}

function extractSatelliteLocations(raw: unknown): SatelliteLocation[] {
  const entries = collectionEntries(raw);

  return entries.flatMap((entry, index) => {
    try {
      return [{ id: extractId(entry, index), name: extractName(entry, index), bbox: extractBbox(entry) }];
    } catch (error) {
      console.warn('Skipping satellite location without bounds', entry, error);
      return [];
    }
  });
}

function extractSites(raw: unknown): Site[] {
  return collectionEntries(raw).flatMap((entry, index) => {
    try {
      const type = extractSiteType(entry);
      if (!type) return [];
      const center = extractCenter(entry);
      return [{
        id: extractId(entry, index),
        type,
        name: extractName(entry, index),
        lat: center.lat,
        lng: center.lon,
        bbox: extractBbox(entry),
      }];
    } catch (error) {
      console.warn('Skipping site without center', entry, error);
      return [];
    }
  });
}

function collectionEntries(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw.features)) return raw.features;
  if (Array.isArray(raw.locations)) return raw.locations;
  return Object.values(raw);
}

function extractSiteType(entry: unknown): SiteType | null {
  if (!isRecord(entry)) return null;
  if (entry.type === 'port') return 'port';
  if (entry.type === 'shipyard') return 'shipyard';
  if (entry.type === 'naval_base') return 'naval';
  return null;
}

function extractCenter(entry: unknown): { lat: number; lon: number } {
  if (!isRecord(entry)) throw new Error('Location is not an object.');

  if (isRecord(entry.center)) {
    const lat = Number(entry.center.lat);
    const lon = Number(entry.center.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const [west, south, east, north] = extractBbox(entry);
  return {
    lat: (north + south) / 2,
    lon: (east + west) / 2,
  };
}

function extractBbox(entry: unknown): Bbox {
  if (Array.isArray(entry) && entry.length >= 4) return entry.slice(0, 4).map(Number) as Bbox;
  if (!isRecord(entry)) throw new Error('Location is not an object.');

  if (Array.isArray(entry.bbox) && entry.bbox.length >= 4) return entry.bbox.slice(0, 4).map(Number) as Bbox;
  if (isRecord(entry.bounds)) {
    const west = Number(entry.bounds.west);
    const south = Number(entry.bounds.south);
    const east = Number(entry.bounds.east);
    const north = Number(entry.bounds.north);
    if ([west, south, east, north].every(Number.isFinite)) return [west, south, east, north];
  }
  if (entry.type === 'Feature' && Array.isArray(entry.bbox) && entry.bbox.length >= 4) {
    return entry.bbox.slice(0, 4).map(Number) as Bbox;
  }

  throw new Error(`Could not find bbox on entry: ${JSON.stringify(entry)}`);
}

function extractId(entry: unknown, index: number): string {
  if (!isRecord(entry)) return `location_${index + 1}`;
  const properties = isRecord(entry.properties) ? entry.properties : undefined;
  return String(entry.id ?? entry.name ?? properties?.name ?? properties?.id ?? `location_${index + 1}`);
}

function extractName(entry: unknown, index: number): string {
  if (!isRecord(entry)) return `Location ${index + 1}`;
  const properties = isRecord(entry.properties) ? entry.properties : undefined;
  return String(entry.proper ?? entry.name ?? properties?.name ?? entry.id ?? `Location ${index + 1}`);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  return response.json() as Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
