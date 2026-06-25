import type { Bounds, DataKind, GeoItem, NavalBase, Point, Port } from "./types";

const DATA_URLS = {
  ports: "https://thanos-labs.github.io/naval-data/data/ports.json",
  naval_bases: "https://thanos-labs.github.io/naval-data/data/naval_bases.json",
} as const;

export const labels: Record<DataKind, string> = {
  ports: "Ports",
  naval_bases: "Naval Bases",
  areas_of_interest: "Areas of Interest",
};

export const colors: Record<DataKind, string> = {
  ports: "#48d7ff",
  naval_bases: "#ff6b6b",
  areas_of_interest: "#b7ff5a",
};

export async function loadData(): Promise<GeoItem[]> {
  const [ports, navalBases] = await Promise.all([
    fetchCollection(DATA_URLS.ports, "ports"),
    fetchCollection(DATA_URLS.naval_bases, "naval_bases"),
  ]);

  return [...ports, ...navalBases];
}

async function fetchCollection(url: string, kind: GeoItem["kind"]): Promise<GeoItem[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);

  const raw = await response.json() as unknown;
  return extractRecords(raw)
    .map((record) => normalizeRecord(record, kind))
    .filter((record): record is GeoItem => record !== null);
}

function extractRecords(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw.features)) {
    return raw.features.map((feature) => isRecord(feature) && "properties" in feature ? feature.properties : feature);
  }
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.locations)) return raw.locations;
  return [];
}

function normalizeRecord(record: unknown, kind: GeoItem["kind"]): GeoItem | null {
  if (!isRecord(record)) return null;
  const bounds = normalizeBounds(record.bounds);
  const name = typeof record.name === "string" ? record.name : null;
  if (!bounds || !name) return null;

  const common = {
    name,
    country: stringOrNull(record.country),
    bounds,
    location: normalizePoint(record.location),
    notes: stringOrNull(record.notes),
    wikipedia_url: stringOrNull(record.wikipedia_url),
  };

  if (kind === "ports") {
    const data: Port = {
      ...common,
      type: stringOrNull(record.type),
      operator: stringOrNull(record.operator),
    };
    return { kind, data };
  }

  const data: NavalBase = {
    ...common,
    operator: stringOrNull(record.operator),
  };
  return { kind, data };
}

function normalizeBounds(value: unknown): Bounds | null {
  if (Array.isArray(value) && value.length >= 4) {
    const [west, south, east, north] = value.map(Number);
    if ([north, south, east, west].every(Number.isFinite)) return { north, south, east, west };
  }

  if (!isRecord(value)) return null;
  const north = Number(value.north);
  const south = Number(value.south);
  const east = Number(value.east);
  const west = Number(value.west);
  if (![north, south, east, west].every(Number.isFinite)) return null;
  return { north, south, east, west };
}

function normalizePoint(value: unknown): Point | undefined {
  if (!isRecord(value)) return undefined;
  const lat = Number(value.lat);
  const lon = Number(value.lon);
  if (![lat, lon].every(Number.isFinite)) return undefined;
  return { lat, lon };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
