import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";

type SiteType = "port" | "naval" | "shipyard";
type Bbox = [number, number, number, number];
type Site = {
  type: SiteType;
  name: string;
  lat: number;
  lng: number;
  bbox: Bbox;
};
type SatelliteLocation = {
  id: string;
  name: string;
  bbox: Bbox;
};
type StacItem = {
  id: string;
  properties?: {
    datetime?: string;
  };
};

const POI_URL = "https://thanos-labs.github.io/naval-data/data/poi.json";
const STAC_API = "https://planetarycomputer.microsoft.com/api/stac/v1";
const PLANETARY_COMPUTER_TILES = "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x";
const SATELLITE_COLLECTION = "sentinel-2-l2a";
const SATELLITE_ASSETS = "visual";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <main id="map" aria-label="Satellite map"></main>
  <section class="panel" aria-label="Map controls">
    <div class="layers" aria-label="Layers">
      <label class="toggle"><input id="satelliteLayerToggle" type="checkbox" checked> <span>Satellite imagery</span></label>
      <label class="toggle"><input id="siteLayerToggle" type="checkbox" checked> <span>Ports, bases, and shipyards</span></label>
    </div>
    <p>Satellite imagery uses the latest Sentinel-2 visual asset available from Microsoft Planetary Computer for each location bounding box.</p>
    <p id="satelliteStatus" class="status">Loading satellite imagery...</p>
  </section>
`;

const satelliteStatus = document.querySelector<HTMLElement>("#satelliteStatus");
const satelliteLayerToggle = document.querySelector<HTMLInputElement>("#satelliteLayerToggle");
const siteLayerToggle = document.querySelector<HTMLInputElement>("#siteLayerToggle");
if (!satelliteStatus || !satelliteLayerToggle || !siteLayerToggle) {
  throw new Error("Missing controls");
}
const satelliteStatusElement = satelliteStatus;

const map = L.map("map", {
  worldCopyJump: true,
  minZoom: 2,
  maxZoom: 18,
  zoomControl: true,
  preferCanvas: true
}).setView([16, -155], 3);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 18,
  updateWhenIdle: true,
  updateWhenZooming: false,
  keepBuffer: 2
}).addTo(map);

map.createPane("satellitePane");
const satellitePane = map.getPane("satellitePane");
if (satellitePane) satellitePane.style.zIndex = "250";

let sites: Site[] = [];

const siteLayer = L.layerGroup().addTo(map);
const satelliteLayer = L.layerGroup().addTo(map);

loadSatelliteImagery().catch(error => {
  console.error("Satellite imagery failed", error);
  setSatelliteStatus("Satellite imagery failed to load.", false);
});
renderVisibleSites();

map.on("moveend zoomend", renderVisibleSites);

satelliteLayerToggle.addEventListener("change", () => setLayerEnabled(satelliteLayer, satelliteLayerToggle.checked));
siteLayerToggle.addEventListener("change", () => setLayerEnabled(siteLayer, siteLayerToggle.checked));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    cleanupServiceWorkers().catch(() => undefined);
  });
}

async function cleanupServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(registration => registration.unregister()));

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith("satellite-locations-map-"))
        .map(key => caches.delete(key))
    );
  }
}

function renderVisibleSites(): void {
  const bounds = map.getBounds().pad(0.08);
  siteLayer.clearLayers();

  for (const site of sites) {
    const { type, name, lat, lng } = site;
    const west = bounds.getWest();
    const east = bounds.getEast();
    const minWorld = Math.floor((west - lng) / 360);
    const maxWorld = Math.ceil((east - lng) / 360);

    for (let world = minWorld; world <= maxWorld; world += 1) {
      const displayLng = lng + world * 360;
      if (!bounds.contains([lat, displayLng])) continue;
      const typeLabel = type === "port" ? "Port" : type === "shipyard" ? "Shipyard" : "Naval base";
      const [bboxWest, bboxSouth, bboxEast, bboxNorth] = site.bbox;
      const outlineBounds = L.latLngBounds(
        [bboxSouth, bboxWest + world * 360],
        [bboxNorth, bboxEast + world * 360]
      );

      L.rectangle(outlineBounds, {
        color: siteColor(type),
        dashArray: "5 5",
        fill: false,
        interactive: false,
        opacity: 0.95,
        weight: 2
      }).addTo(siteLayer);

      L.marker([lat, displayLng], {
        riseOnHover: true,
        icon: L.divIcon({
          className: "",
          html: `<span class="site-marker ${type}" aria-hidden="true"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      })
        .bindPopup(`<strong>${escapeHtml(name)}</strong><br>${typeLabel}`, {
          closeButton: false
        })
        .addTo(siteLayer);
    }
  }
}

async function loadSatelliteImagery(): Promise<void> {
  setSatelliteStatus("Loading satellite locations...", true);
  const raw = await fetchJson(POI_URL);
  sites = extractSites(raw);
  renderVisibleSites();
  const locations = extractSatelliteLocations(raw);

  if (locations.length === 0) {
    setSatelliteStatus("No satellite locations found.", false);
    return;
  }

  setSatelliteStatus(`Finding Sentinel-2 imagery for ${locations.length} locations...`, true);
  let loaded = 0;
  let missing = 0;

  const results = await Promise.allSettled(locations.map(async location => {
    const item = await stacSearchLatestByBbox(SATELLITE_COLLECTION, location.bbox);
    if (!item) {
      missing += 1;
      return;
    }

    addSatelliteTileLayer(location, item);
    loaded += 1;
    setSatelliteStatus(`Loaded satellite imagery for ${loaded}/${locations.length} locations...`, true);
  }));

  missing += results.filter(result => result.status === "rejected").length;
  if (missing > 0) {
    console.warn("Some satellite locations failed to load", results.filter(result => result.status === "rejected"));
  }

  setSatelliteStatus(
    loaded > 0
      ? `Satellite imagery loaded for ${loaded} locations${missing > 0 ? `; ${missing} unavailable.` : "."}`
      : "No satellite imagery found.",
    false
  );
}

function addSatelliteTileLayer(location: SatelliteLocation, item: StacItem): void {
  const params = new URLSearchParams({
    collection: SATELLITE_COLLECTION,
    item: item.id,
    assets: SATELLITE_ASSETS
  });
  const [west, south, east, north] = location.bbox;
  const bounds = L.latLngBounds([south, west], [north, east]);
  const layer = L.tileLayer(`${PLANETARY_COMPUTER_TILES}?${params.toString()}`, {
    attribution: "Sentinel-2 imagery &copy; ESA, rendered by Microsoft Planetary Computer",
    bounds,
    maxNativeZoom: 18,
    maxZoom: 18,
    opacity: 0.78,
    pane: "satellitePane",
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 1
  });

  layer.bindPopup(
    `<strong>${escapeHtml(location.name)}</strong><br>Sentinel-2 ${escapeHtml(item.properties?.datetime?.slice(0, 10) ?? item.id)}`,
    { closeButton: false }
  );
  layer.addTo(satelliteLayer);
}

function extractSatelliteLocations(raw: unknown): SatelliteLocation[] {
  const entries = collectionEntries(raw);

  return entries.flatMap((entry, index) => {
    try {
      const bbox = extractBbox(entry);
      return [{
        id: extractId(entry, index),
        name: extractName(entry, index),
        bbox
      }];
    } catch (error) {
      console.warn("Skipping satellite location without bounds", entry, error);
      return [];
    }
  });
}

function extractSites(raw: unknown): Site[] {
  return collectionEntries(raw).flatMap((entry): Site[] => {
    try {
      const type = extractSiteType(entry);
      if (!type) return [];
      const center = extractCenter(entry);
      return [{
        type,
        name: extractName(entry, 0),
        lat: center.lat,
        lng: center.lon,
        bbox: extractBbox(entry)
      }];
    } catch (error) {
      console.warn("Skipping site without center", entry, error);
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
  if (entry.type === "port") return "port";
  if (entry.type === "shipyard") return "shipyard";
  if (entry.type === "naval_base") return "naval";
  return null;
}

function extractCenter(entry: unknown): { lat: number; lon: number } {
  if (!isRecord(entry)) throw new Error("Location is not an object.");

  if (isRecord(entry.center)) {
    const lat = Number(entry.center.lat);
    const lon = Number(entry.center.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const [west, south, east, north] = extractBbox(entry);
  return {
    lat: (north + south) / 2,
    lon: (east + west) / 2
  };
}

function extractBbox(entry: unknown): Bbox {
  if (Array.isArray(entry) && entry.length >= 4) return entry.slice(0, 4).map(Number) as Bbox;
  if (!isRecord(entry)) throw new Error("Location is not an object.");

  if (Array.isArray(entry.bbox) && entry.bbox.length >= 4) return entry.bbox.slice(0, 4).map(Number) as Bbox;
  if (isRecord(entry.bounds)) {
    const west = Number(entry.bounds.west);
    const south = Number(entry.bounds.south);
    const east = Number(entry.bounds.east);
    const north = Number(entry.bounds.north);
    if ([west, south, east, north].every(Number.isFinite)) return [west, south, east, north];
  }
  if (entry.type === "Feature" && Array.isArray(entry.bbox) && entry.bbox.length >= 4) {
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

async function stacSearchLatestByBbox(collection: string, bbox: Bbox): Promise<StacItem | null> {
  const params = new URLSearchParams({
    collections: collection,
    bbox: bbox.join(","),
    limit: "1",
    sortby: "-datetime"
  });
  const data = await fetchJson(`${STAC_API}/search?${params.toString()}`);
  if (!isRecord(data) || !Array.isArray(data.features)) return null;
  return data.features[0] as StacItem | undefined ?? null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  return response.json() as Promise<unknown>;
}

function setLayerEnabled(layer: L.Layer, enabled: boolean): void {
  if (enabled) {
    if (!map.hasLayer(layer)) layer.addTo(map);
  } else if (map.hasLayer(layer)) {
    layer.remove();
  }
}

function setSatelliteStatus(message: string, isLoading: boolean): void {
  satelliteStatusElement.textContent = message;
  satelliteStatusElement.classList.toggle("loading", isLoading);
}

function siteColor(type: SiteType): string {
  if (type === "port") return "#ffcc4d";
  if (type === "shipyard") return "#ff9f43";
  return "#ff6b6b";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[character] ?? character);
}
