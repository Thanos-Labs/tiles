export type Bbox = [number, number, number, number];

export type SatelliteLocation = {
  id: string;
  name: string;
  bbox: Bbox;
};

export type StacItem = {
  id: string;
  properties?: {
    datetime?: string;
  };
};

export const NAVAL_BASES_URL = 'https://thanos-labs.github.io/naval-data/data/naval_bases.json';
export const STAC_API = 'https://planetarycomputer.microsoft.com/api/stac/v1';
export const PLANETARY_COMPUTER_TILES = 'https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x';

export async function loadImageryLocations(): Promise<SatelliteLocation[]> {
  return extractSatelliteLocations(await fetchJson(NAVAL_BASES_URL));
}

export async function stacSearchLatestByBbox(collection: string, bbox: Bbox): Promise<StacItem | null> {
  const params = new URLSearchParams({
    collections: collection,
    bbox: bbox.join(','),
    limit: '1',
    sortby: '-datetime',
  });
  const data = await fetchJson(`${STAC_API}/search?${params.toString()}`);
  if (!isRecord(data) || !Array.isArray(data.features)) return null;
  return (data.features[0] as StacItem | undefined) ?? null;
}

function extractSatelliteLocations(raw: unknown): SatelliteLocation[] {
  const entries = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.features)
      ? raw.features
      : isRecord(raw) && Array.isArray(raw.locations)
        ? raw.locations
        : [];

  return entries.flatMap((entry, index) => {
    try {
      return [{ id: extractId(entry, index), name: extractName(entry, index), bbox: extractBbox(entry) }];
    } catch (error) {
      console.warn('Skipping satellite location without bounds', entry, error);
      return [];
    }
  });
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
  return String(entry.name ?? properties?.name ?? entry.id ?? `Location ${index + 1}`);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  return response.json() as Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
