import L, { LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";

type SiteType = "port" | "naval";
type Site = [SiteType, string, number, number];

const GEBCO_OPENDAP_ASCII_URL = import.meta.env.DEV
  ? "/gebco/gebco_2026.ascii"
  : "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc.ascii";
const GEBCO_GRID_WIDTH = 86400;
const GEBCO_GRID_HEIGHT = 43200;
const GEBCO_GRID_RESOLUTION = 1 / 240;
const GEBCO_NODATA = -32767;
const DEPTH_TILE_SIZE = 256;
const DEPTH_SAMPLE_SIZE = 64;
const MAX_GEBCO_REQUESTS = 4;
const GEBCO_RETRY_COUNT = 2;
const DEPTH_TILE_RETRY_COUNT = 2;

let activeGebcoRequests = 0;
const gebcoRequestQueue: Array<() => void> = [];

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <main id="map" aria-label="Ocean navigation depth map"></main>
  <section class="panel" aria-label="Depth controls">
    <div class="readout">
      <span>Minimum safe water</span>
      <strong id="depthValue">10 m</strong>
    </div>
    <input id="depthSlider" type="range" min="0" max="50" step="5" value="10">
    <div class="scale"><span>0 m</span><span>50 m</span></div>
    <p>Blue overlay uses GEBCO 2026 bathymetry. Areas shown are at or deeper than selected depth. Not for navigation.</p>
    <p id="depthStatus" class="status">Loading GEBCO depth data...</p>
  </section>
`;

const depthSlider = document.querySelector<HTMLInputElement>("#depthSlider");
const depthValue = document.querySelector<HTMLElement>("#depthValue");
const depthStatus = document.querySelector<HTMLElement>("#depthStatus");
if (!depthSlider || !depthValue || !depthStatus) throw new Error("Missing controls");
const status = depthStatus;

const map = L.map("map", {
  worldCopyJump: true,
  minZoom: 2,
  maxZoom: 12,
  zoomControl: true,
  preferCanvas: true
}).setView([16, -155], 3);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 12,
  updateWhenIdle: true,
  updateWhenZooming: false,
  keepBuffer: 2
}).addTo(map);

const sites: Site[] = [
  ["port", "Shanghai", 31.23, 121.49],
  ["port", "Singapore", 1.26, 103.82],
  ["port", "Ningbo-Zhoushan", 29.88, 121.55],
  ["port", "Shenzhen", 22.55, 114.06],
  ["port", "Busan", 35.1, 129.04],
  ["port", "Rotterdam", 51.95, 4.14],
  ["port", "Antwerp-Bruges", 51.28, 4.27],
  ["port", "Hamburg", 53.54, 9.97],
  ["port", "Los Angeles / Long Beach", 33.75, -118.22],
  ["port", "New York / New Jersey", 40.67, -74.04],
  ["port", "Houston", 29.73, -95.26],
  ["port", "Santos", -23.96, -46.3],
  ["port", "Durban", -29.88, 31.05],
  ["port", "Jebel Ali", 25.01, 55.06],
  ["port", "Port Klang", 3.0, 101.39],
  ["port", "Tanjung Pelepas", 1.36, 103.55],
  ["port", "Piraeus", 37.94, 23.63],
  ["port", "Algeciras", 36.13, -5.44],
  ["port", "Colombo", 6.94, 79.84],
  ["port", "Sydney", -33.85, 151.2],
  ["naval", "Norfolk Naval Station", 36.95, -76.31],
  ["naval", "San Diego Naval Base", 32.68, -117.16],
  ["naval", "Pearl Harbor", 21.35, -157.95],
  ["naval", "Portsmouth Naval Base", 50.81, -1.1],
  ["naval", "Toulon Naval Base", 43.11, 5.93],
  ["naval", "Rota Naval Base", 36.64, -6.35],
  ["naval", "Yokosuka Naval Base", 35.29, 139.67],
  ["naval", "Sasebo Naval Base", 33.16, 129.72],
  ["naval", "Changi Naval Base", 1.31, 104.04],
  ["naval", "Visakhapatnam Naval Base", 17.69, 83.28],
  ["naval", "Garden Island Naval Base", -33.86, 151.23],
  ["naval", "Severomorsk", 69.07, 33.42]
];

const siteLayer = L.layerGroup().addTo(map);
const slider = depthSlider;

let redrawTimer = 0;
let navigationRedrawFrame = 0;

class GebcoDepthLayer extends L.GridLayer {
  private readonly sampleCache = new Map<string, Promise<DepthSample>>();
  private readonly maxSampleCache = 360;
  private hasData = false;
  private tileFailures = 0;
  private pendingTiles = 0;
  private retryRedrawTimer = 0;

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = L.DomUtil.create("canvas", "depth-mask-tile") as HTMLCanvasElement;
    tile.width = DEPTH_TILE_SIZE;
    tile.height = DEPTH_TILE_SIZE;

    const threshold = Number(slider.value);
    this.setLoading(true);
    this.drawTileWithRetry(tile, coords, threshold, DEPTH_TILE_RETRY_COUNT)
      .then(() => done(undefined, tile))
      .catch(error => {
        console.error("GEBCO depth tile failed", error);
        this.tileFailures += 1;
        if (!this.hasData && this.tileFailures > 8) {
          status.textContent = "GEBCO depth overlay failed to load.";
        } else if (!this.hasData) {
          status.textContent = "Loading GEBCO 2026 depth data...";
        }
        this.scheduleRetryRedraw();
        done(undefined, tile);
      })
      .finally(() => {
        this.setLoading(false);
      });

    return tile;
  }

  private async drawTileWithRetry(
    tile: HTMLCanvasElement,
    coords: L.Coords,
    threshold: number,
    retries: number
  ): Promise<void> {
    try {
      await this.drawTile(tile, coords, threshold);
    } catch (error) {
      if (retries <= 0) throw error;
      await delay(300 * (DEPTH_TILE_RETRY_COUNT - retries + 1));
      return this.drawTileWithRetry(tile, coords, threshold, retries - 1);
    }
  }

  private scheduleRetryRedraw(): void {
    window.clearTimeout(this.retryRedrawTimer);
    this.retryRedrawTimer = window.setTimeout(() => {
      if (map.hasLayer(this)) this.redraw();
    }, 1200);
  }

  private setLoading(isLoading: boolean): void {
    this.pendingTiles += isLoading ? 1 : -1;
    this.pendingTiles = Math.max(0, this.pendingTiles);
    status.classList.toggle("loading", this.pendingTiles > 0);
    if (this.pendingTiles > 0 && !this.hasData) {
      status.textContent = "Loading GEBCO 2026 depth data...";
    }
  }

  private async drawTile(tile: HTMLCanvasElement, coords: L.Coords, threshold: number): Promise<void> {
    const ctx = tile.getContext("2d", { alpha: true });
    if (!ctx) return;

    const bounds = tileBounds(coords);
    const windows = rasterWindows(bounds);
    if (windows.length === 0) return;

    let rendered = false;
    ctx.clearRect(0, 0, DEPTH_TILE_SIZE, DEPTH_TILE_SIZE);
    const mask = ctx.createImageData(DEPTH_TILE_SIZE, DEPTH_TILE_SIZE);
    const tileOrigin = coords.scaleBy(L.point(DEPTH_TILE_SIZE, DEPTH_TILE_SIZE));

    for (const window of windows) {
      const sample = await this.readSample(window);
      const xStart = Math.max(0, Math.floor(window.destX));
      const xEnd = Math.min(DEPTH_TILE_SIZE, Math.ceil(window.destX + window.destWidth));

      for (let y = 0; y < DEPTH_TILE_SIZE; y += 1) {
        const lat = map.unproject(L.point(tileOrigin.x, tileOrigin.y + y + 0.5), coords.z).lat;
        const sampleY = Math.round((latToGridFloat(lat) - sample.latStart) / sample.latStride);
        if (sampleY < 0 || sampleY >= sample.height) continue;

        for (let x = xStart; x < xEnd; x += 1) {
          const lon = map.unproject(L.point(tileOrigin.x + x + 0.5, tileOrigin.y + y + 0.5), coords.z).lng;
          const sampleX = Math.round((lonToGridFloat(lon) - sample.lonStart) / sample.lonStride);
          if (sampleX < 0 || sampleX >= sample.width) continue;

          const elevation = sample.values[sampleY * sample.width + sampleX];
          if (elevation <= GEBCO_NODATA) continue;

          const depth = elevation < 0 ? -elevation : 0;
          if (depth >= threshold) {
            const p = (y * DEPTH_TILE_SIZE + x) * 4;
            const strength = Math.min(1, (Math.min(depth, 50) - threshold) / Math.max(5, 50 - threshold));
            mask.data[p] = 14;
            mask.data[p + 1] = Math.round(125 + strength * 75);
            mask.data[p + 2] = Math.round(180 + strength * 55);
            mask.data[p + 3] = Math.round(82 + strength * 108);
            rendered = true;
          }
        }
      }
    }
    ctx.putImageData(mask, 0, 0);
    if (!rendered) return;

    if (!this.hasData) {
      this.hasData = true;
      status.textContent = "GEBCO 2026 depth data loaded.";
    }
    this.tileFailures = 0;
  }

  private readSample(window: RasterWindow): Promise<DepthSample> {
    const cached = this.sampleCache.get(window.key);
    if (cached) return cached;

    const promise = fetchGebcoText(opendapUrl(window))
      .then(parseOpendapGrid)
      .then(sample => ({
        ...sample,
        latStart: window.latStart,
        latStride: window.latStride,
        lonStart: window.lonStart,
        lonStride: window.lonStride
      }))
      .catch(error => {
        this.sampleCache.delete(window.key);
        throw error;
      });

    this.sampleCache.set(window.key, promise);
    while (this.sampleCache.size > this.maxSampleCache) {
      const first = this.sampleCache.keys().next().value;
      if (first === undefined) break;
      this.sampleCache.delete(first);
    }
    return promise;
  }
}

const depthLayer = new GebcoDepthLayer({
  tileSize: DEPTH_TILE_SIZE,
  opacity: 0.72,
  maxZoom: 12,
  updateWhenIdle: true,
  updateWhenZooming: true,
  keepBuffer: 2
}).addTo(map);

renderVisibleSites();

map.on("moveend zoomend", renderVisibleSites);
map.on("move zoom moveend zoomend", scheduleDepthRedraw);

depthSlider.addEventListener("input", () => {
  depthValue.textContent = `${Number(depthSlider.value).toLocaleString()} m`;
  window.clearTimeout(redrawTimer);
  redrawTimer = window.setTimeout(() => depthLayer.redraw(), 80);
});

function scheduleDepthRedraw(): void {
  if (navigationRedrawFrame !== 0) return;
  navigationRedrawFrame = window.requestAnimationFrame(() => {
    navigationRedrawFrame = 0;
    depthLayer.redraw();
  });
}

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
        .filter(key => key.startsWith("ocean-depth-map-"))
        .map(key => caches.delete(key))
    );
  }
}

function renderVisibleSites(): void {
  const bounds = map.getBounds().pad(0.08);
  siteLayer.clearLayers();

  for (const [type, name, lat, lng] of sites) {
    const west = bounds.getWest();
    const east = bounds.getEast();
    const minWorld = Math.floor((west - lng) / 360);
    const maxWorld = Math.ceil((east - lng) / 360);

    for (let world = minWorld; world <= maxWorld; world += 1) {
      const displayLng = lng + world * 360;
      if (!bounds.contains([lat, displayLng])) continue;
      L.marker([lat, displayLng], {
        riseOnHover: true,
        icon: L.divIcon({
          className: "",
          html: `<span class="site-marker ${type}" aria-hidden="true"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      })
        .bindPopup(`<strong>${name}</strong><br>${type === "port" ? "Major port" : "Major naval base"}`, {
          closeButton: false
        })
        .addTo(siteLayer);
    }
  }
}

function tileBounds(coords: L.Coords): LatLngBounds {
  const tileSize = L.point(DEPTH_TILE_SIZE, DEPTH_TILE_SIZE);
  const nw = map.unproject(coords.scaleBy(tileSize), coords.z);
  const se = map.unproject(coords.add([1, 1]).scaleBy(tileSize), coords.z);
  return L.latLngBounds(se, nw);
}

type RasterWindow = {
  key: string;
  west: number;
  east: number;
  latStart: number;
  latStride: number;
  latEnd: number;
  lonStart: number;
  lonStride: number;
  lonEnd: number;
  destX: number;
  destWidth: number;
};

type RawDepthSample = {
  width: number;
  height: number;
  values: Int16Array;
};

type DepthSample = RawDepthSample & {
  latStart: number;
  latStride: number;
  lonStart: number;
  lonStride: number;
};

function rasterWindows(bounds: LatLngBounds): RasterWindow[] {
  const west = bounds.getWest();
  const east = bounds.getEast();
  const north = clamp(bounds.getNorth(), -89.999, 89.999);
  const south = clamp(bounds.getSouth(), -89.999, 89.999);
  const spans = splitLonSpan(west, east);

  return spans.flatMap(span => {
    const destX = ((span.sourceWest - west) / (east - west)) * DEPTH_TILE_SIZE;
    const destWidth = ((span.sourceEast - span.sourceWest) / (east - west)) * DEPTH_TILE_SIZE;
    const lonStart = lonToGridStart(span.west);
    const lonEnd = lonToGridEnd(span.east);
    const latStart = latToGridStart(south);
    const latEnd = latToGridEnd(north);

    if (lonEnd < lonStart || latEnd < latStart || destWidth <= 0) return [];

    const targetWidth = Math.max(2, Math.round((destWidth / DEPTH_TILE_SIZE) * DEPTH_SAMPLE_SIZE));
    const lonStride = strideFor(lonStart, lonEnd, targetWidth);
    const latStride = strideFor(latStart, latEnd, DEPTH_SAMPLE_SIZE);
    const key = [
      latStart,
      latStride,
      latEnd,
      lonStart,
      lonStride,
      lonEnd
    ].join(":");

    return [{
      key,
      west: span.west,
      east: span.east,
      latStart,
      latStride,
      latEnd,
      lonStart,
      lonStride,
      lonEnd,
      destX,
      destWidth
    }];
  });
}

function splitLonSpan(west: number, east: number): Array<{
  west: number;
  east: number;
  sourceWest: number;
  sourceEast: number;
}> {
  const spans: Array<{ west: number; east: number; sourceWest: number; sourceEast: number }> = [];
  for (let cursor = west; cursor < east - 0.000001; ) {
    const wrappedWest = wrapLng(cursor);
    const boundary = cursor + (180 - wrappedWest || 360);
    const next = Math.min(east, boundary);
    const wrappedEast = wrapLng(next);
    const rasterWest = wrappedWest === 180 ? -180 : wrappedWest;
    const rasterEast = wrappedEast <= rasterWest ? 180 : wrappedEast;
    spans.push({
      west: rasterWest,
      east: rasterEast,
      sourceWest: cursor,
      sourceEast: next
    });
    cursor = next <= cursor ? cursor + 360 : next;
  }
  return spans;
}

function lonToGridStart(lon: number): number {
  return clamp(Math.ceil(((lon + 180) - GEBCO_GRID_RESOLUTION / 2) / GEBCO_GRID_RESOLUTION), 0, GEBCO_GRID_WIDTH - 1);
}

function lonToGridFloat(lon: number): number {
  return ((lon + 180) - GEBCO_GRID_RESOLUTION / 2) / GEBCO_GRID_RESOLUTION;
}

function lonToGridEnd(lon: number): number {
  return clamp(Math.floor(((lon + 180) - GEBCO_GRID_RESOLUTION / 2) / GEBCO_GRID_RESOLUTION), 0, GEBCO_GRID_WIDTH - 1);
}

function latToGridStart(lat: number): number {
  return clamp(Math.ceil(((lat + 90) - GEBCO_GRID_RESOLUTION / 2) / GEBCO_GRID_RESOLUTION), 0, GEBCO_GRID_HEIGHT - 1);
}

function latToGridFloat(lat: number): number {
  return ((lat + 90) - GEBCO_GRID_RESOLUTION / 2) / GEBCO_GRID_RESOLUTION;
}

function latToGridEnd(lat: number): number {
  return clamp(Math.floor(((lat + 90) - GEBCO_GRID_RESOLUTION / 2) / GEBCO_GRID_RESOLUTION), 0, GEBCO_GRID_HEIGHT - 1);
}

function strideFor(start: number, end: number, targetCount: number): number {
  return Math.max(1, Math.ceil((end - start + 1) / targetCount));
}

function opendapUrl(window: RasterWindow): string {
  const constraint =
    `elevation.elevation[${window.latStart}:${window.latStride}:${window.latEnd}]` +
    `[${window.lonStart}:${window.lonStride}:${window.lonEnd}]`;
  return `${GEBCO_OPENDAP_ASCII_URL}?${encodeURIComponent(constraint)}`;
}

function parseOpendapGrid(text: string): RawDepthSample {
  const separatorIndex = text.indexOf("---------------------------------------------");
  const body = separatorIndex >= 0 ? text.slice(separatorIndex) : text;
  const rows: number[][] = [];
  const rowPattern = /^\[\d+\],\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = rowPattern.exec(body)) !== null) {
    rows.push(match[1].split(",").map(value => Number(value.trim())));
  }

  if (rows.length === 0 || rows[0].length === 0) {
    throw new Error("GEBCO response did not contain an elevation grid.");
  }

  const width = rows[0].length;
  const values = new Int16Array(width * rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error("GEBCO response rows have inconsistent widths.");
    row.forEach((value, x) => {
      values[y * width + x] = value;
    });
  });

  return {
    width,
    height: rows.length,
    values
  };
}

function fetchGebcoText(url: string): Promise<string> {
  return scheduleGebcoRequest(() => fetchWithRetry(url, GEBCO_RETRY_COUNT));
}

function scheduleGebcoRequest<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeGebcoRequests += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeGebcoRequests -= 1;
          gebcoRequestQueue.shift()?.();
        });
    };

    if (activeGebcoRequests < MAX_GEBCO_REQUESTS) {
      run();
    } else {
      gebcoRequestQueue.push(run);
    }
  });
}

async function fetchWithRetry(url: string, retries: number): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GEBCO request failed: ${response.status}`);
    return await response.text();
  } catch (error) {
    if (retries <= 0) throw error;
    await delay(350 * (GEBCO_RETRY_COUNT - retries + 1));
    return fetchWithRetry(url, retries - 1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
