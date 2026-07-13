import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { IMAGERY_MIN_ZOOM, loadImageryLocations, PLANETARY_COMPUTER_TILES, stacSearchLatestByBbox } from '../data/imagery';
import type { Bbox, SatelliteLocation, StacItem } from '../data/imagery';
import { attachTileClip } from '../lib/tileClip';

const COMPARE_MIN_ZOOM = IMAGERY_MIN_ZOOM;
const OPTICAL_COLLECTION = 'sentinel-2-l2a';
const OPTICAL_ASSETS = 'visual';
const SAR_COLLECTION = 'sentinel-1-rtc';
const SAR_ASSETS = ['vv', 'vh'];
const SAR_FALSE_COLOR_EXPRESSION = 'vv;vh;vv/vh';

type CompareTile = {
  location: SatelliteLocation;
  opticalItem: StacItem;
  sarItem: StacItem;
};

type VisibleCompareCandidate = {
  location: SatelliteLocation;
  bbox: Bbox;
  offset: number;
};

type VisibleCompareTile = CompareTile & {
  bbox: Bbox;
  offset: number;
};

export function CompareImageryLayer({
  visible,
  onStatus,
}: {
  visible: boolean;
  onStatus: (status: string) => void;
}) {
  const map = useMap();
  const [locations, setLocations] = useState<SatelliteLocation[]>([]);
  const [tilesById, setTilesById] = useState<Record<string, CompareTile>>({});
  const [viewVersion, setViewVersion] = useState(0);
  const loadingIdsRef = useRef(new Set<string>());

  useMapEvents({
    moveend: () => setViewVersion((version) => version + 1),
    zoomend: () => setViewVersion((version) => version + 1),
    resize: () => setViewVersion((version) => version + 1),
  });

  useEffect(() => {
    if (!visible) {
      onStatus('Compare mode is off.');
      return;
    }

    let cancelled = false;

    async function load() {
      onStatus('Loading compare locations...');
      const loadedLocations = await loadImageryLocations();
      if (cancelled) return;

      if (loadedLocations.length === 0) {
        onStatus('No compare locations found.');
        return;
      }

      setLocations(loadedLocations);
      onStatus(`Compare mode enabled. Zoom to ${COMPARE_MIN_ZOOM}+ to show local sliders.`);
    }

    load().catch((error: unknown) => {
      console.error('Compare imagery failed', error);
      if (!cancelled) onStatus('Compare imagery failed to load.');
    });

    return () => {
      cancelled = true;
    };
  }, [visible, onStatus]);

  const visibleCandidates = useMemo<VisibleCompareCandidate[]>(() => {
    if (!visible) return [];

    const zoom = map.getZoom();
    if (zoom < COMPARE_MIN_ZOOM) return [];

    const bounds = map.getBounds().pad(0.12);
    return locations.flatMap((location) => (
      [-360, 0, 360].flatMap((offset) => {
        const bbox = shiftBbox(location.bbox, offset);
        return bounds.intersects(bboxToLatLngBounds(bbox)) ? [{ location, bbox, offset }] : [];
      })
    ));
  }, [locations, map, viewVersion, visible]);

  useEffect(() => {
    if (!visible || visibleCandidates.length === 0) return;

    const candidatesToLoad = visibleCandidates.filter(({ location }) => (
      !tilesById[location.id] && !loadingIdsRef.current.has(location.id)
    ));
    if (candidatesToLoad.length === 0) return;

    let cancelled = false;
    candidatesToLoad.forEach(({ location }) => loadingIdsRef.current.add(location.id));
    onStatus(`Pairing SAR and optical imagery for ${candidatesToLoad.length} visible locations...`);

    Promise.allSettled(candidatesToLoad.map(async ({ location }) => {
      const [opticalItem, sarItem] = await Promise.all([
        stacSearchLatestByBbox(OPTICAL_COLLECTION, location.bbox, [OPTICAL_ASSETS]),
        stacSearchLatestByBbox(SAR_COLLECTION, location.bbox, SAR_ASSETS),
      ]);
      if (!opticalItem || !sarItem) return null;
      return { location, opticalItem, sarItem };
    }))
      .then((results) => {
        if (cancelled) return;
        const loaded = results.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
        setTilesById((current) => ({
          ...current,
          ...Object.fromEntries(loaded.map((tile) => [tile.location.id, tile])),
        }));
        const missing = results.length - loaded.length;
        onStatus(
          loaded.length > 0
            ? `Compare imagery paired for ${loaded.length} visible locations${missing > 0 ? `; ${missing} unavailable.` : '.'}`
            : 'No paired compare imagery found for the visible locations.',
        );
      })
      .catch((error: unknown) => {
        console.error('Compare imagery failed', error);
        if (!cancelled) onStatus('Compare imagery failed to load.');
      })
      .finally(() => {
        candidatesToLoad.forEach(({ location }) => loadingIdsRef.current.delete(location.id));
      });

    return () => {
      cancelled = true;
    };
  }, [onStatus, tilesById, visible, visibleCandidates]);

  const visibleTiles = useMemo<VisibleCompareTile[]>(() => (
    visibleCandidates.flatMap((candidate) => {
      const tile = tilesById[candidate.location.id];
      return tile ? [{ ...tile, bbox: candidate.bbox, offset: candidate.offset }] : [];
    })
  ), [tilesById, visibleCandidates]);

  useEffect(() => {
    if (!visible || locations.length === 0) return;
    if (map.getZoom() < COMPARE_MIN_ZOOM) {
      onStatus(`Compare mode enabled. Zoom to ${COMPARE_MIN_ZOOM}+ to show local sliders.`);
      return;
    }

    if (visibleCandidates.length === 0) {
      onStatus('Compare mode enabled. Pan to a mapped location.');
      return;
    }

    if (visibleTiles.length > 0) {
      onStatus(`Compare sliders visible for ${visibleTiles.length} locations.`);
    }
  }, [locations.length, map, onStatus, viewVersion, visible, visibleCandidates.length, visibleTiles.length]);

  if (!visible) return null;

  return visibleTiles.map((tile) => (
    <CompareTilePair
      key={`${tile.location.id}:${tile.offset}`}
      bbox={tile.bbox}
      location={tile.location}
      offset={tile.offset}
      opticalItem={tile.opticalItem}
      sarItem={tile.sarItem}
    />
  ));
}

function CompareTilePair({
  bbox,
  location,
  offset,
  opticalItem,
  sarItem,
}: VisibleCompareTile) {
  const map = useMap();
  const ratioRef = useRef(0.5);
  const bboxKey = bbox.join(',');

  useEffect(() => {
    const id = safePaneId(location.id);
    const paneSuffix = `${id}-${offset}`;
    const sarPaneName = `compare-sar-${paneSuffix}`;
    const opticalPaneName = `compare-optical-${paneSuffix}`;
    const sarPane = ensurePane(map, sarPaneName, 252);
    const opticalPane = ensurePane(map, opticalPaneName, 254);
    sarPane.style.pointerEvents = 'none';
    opticalPane.style.pointerEvents = 'none';

    const bounds = bboxToLatLngBounds(bbox);
    const sarLayer = L.tileLayer(buildSarTileUrl(sarItem), {
      attribution: 'Sentinel-1 SAR imagery &copy; ESA, rendered by Microsoft Planetary Computer',
      bounds,
      maxNativeZoom: 18,
      maxZoom: 18,
      opacity: 1,
      pane: sarPaneName,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
    });
    const opticalLayer = L.tileLayer(buildOpticalTileUrl(opticalItem), {
      attribution: 'Sentinel-2 imagery &copy; ESA, rendered by Microsoft Planetary Computer',
      bounds,
      maxNativeZoom: 18,
      maxZoom: 18,
      opacity: 1,
      pane: opticalPaneName,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
    });
    const sarClip = attachTileClip({ layer: sarLayer, map, bbox, leftRatio: 0, rightRatio: 1 });
    const opticalClip = attachTileClip({ layer: opticalLayer, map, bbox, leftRatio: 0, rightRatio: ratioRef.current });
    sarLayer.addTo(map);
    opticalLayer.addTo(map);
    const frame = L.rectangle(bounds, {
      color: '#e6f2f6',
      dashArray: '4 4',
      fill: false,
      interactive: false,
      opacity: 0.9,
      weight: 1,
    }).addTo(map);
    const divider = L.polyline(dividerLatLngs(bbox, ratioRef.current), {
      className: 'compare-divider-line',
      color: '#ffffff',
      interactive: false,
      opacity: 0.95,
      weight: 2,
    }).addTo(map);
    const handle = L.marker(dividerHandleLatLng(bbox, ratioRef.current), {
      draggable: true,
      icon: L.divIcon({
        className: 'compare-slider-handle',
        html: '<span aria-hidden="true"></span>',
        iconAnchor: [10, 10],
        iconSize: [20, 20],
      }),
      zIndexOffset: 1000,
    }).addTo(map);

    function updateVisuals(): void {
      sarClip.setRange(0, 1);
      opticalClip.setRange(0, ratioRef.current);
      divider.setLatLngs(dividerLatLngs(bbox, ratioRef.current));
      handle.setLatLng(dividerHandleLatLng(bbox, ratioRef.current));
    }

    function onDrag(): void {
      const next = ratioFromLatLng(map, bbox, handle.getLatLng());
      ratioRef.current = next;
      updateVisuals();
    }

    handle.on('drag', onDrag);
    handle.on('dragend', onDrag);
    map.on('move zoom resize', updateVisuals);
    updateVisuals();

    return () => {
      handle.off('drag', onDrag);
      handle.off('dragend', onDrag);
      map.off('move zoom resize', updateVisuals);
      map.removeLayer(handle);
      map.removeLayer(divider);
      map.removeLayer(frame);
      opticalClip.detach();
      sarClip.detach();
      map.removeLayer(opticalLayer);
      map.removeLayer(sarLayer);
      clearClip(sarPane);
      clearClip(opticalPane);
    };
  }, [bboxKey, location, map, offset, opticalItem, sarItem]);

  return null;
}

function buildOpticalTileUrl(item: StacItem): string {
  const params = new URLSearchParams({ collection: OPTICAL_COLLECTION, item: item.id, assets: OPTICAL_ASSETS });
  return `${PLANETARY_COMPUTER_TILES}?${params.toString()}`;
}

function buildSarTileUrl(item: StacItem): string {
  const params = new URLSearchParams({
    collection: SAR_COLLECTION,
    item: item.id,
    assets: SAR_ASSETS.join(','),
    asset_as_band: 'true',
    expression: SAR_FALSE_COLOR_EXPRESSION,
    color_formula: 'gamma RGB 1.6 saturation 1.2',
  });
  params.append('rescale', '0,0.25');
  params.append('rescale', '0,0.08');
  params.append('rescale', '0,4');
  return `${PLANETARY_COMPUTER_TILES}?${params.toString()}`;
}

function bboxToLatLngBounds([west, south, east, north]: Bbox): L.LatLngBounds {
  return new L.LatLngBounds([south, west], [north, east]);
}

function shiftBbox([west, south, east, north]: Bbox, offset: number): Bbox {
  return [west + offset, south, east + offset, north];
}

function dividerLatLngs([west, south, east, north]: Bbox, ratio: number): L.LatLngExpression[] {
  const lon = west + (east - west) * ratio;
  return [[south, lon], [north, lon]];
}

function dividerHandleLatLng([west, south, east, north]: Bbox, ratio: number): L.LatLngExpression {
  const lon = west + (east - west) * ratio;
  return [(south + north) / 2, lon];
}

function ratioFromLatLng(map: L.Map, bbox: Bbox, latLng: L.LatLng): number {
  const [west, south, east, north] = bbox;
  const nw = map.latLngToContainerPoint([north, west]);
  const se = map.latLngToContainerPoint([south, east]);
  const point = map.latLngToContainerPoint(latLng);
  const left = Math.min(nw.x, se.x);
  const right = Math.max(nw.x, se.x);
  if (right === left) return 0.5;
  return clamp((point.x - left) / (right - left), 0, 1);
}

function clearClip(element: HTMLElement | null | undefined): void {
  if (!element) return;
  element.style.clipPath = '';
  element.style.removeProperty('-webkit-clip-path');
}

function ensurePane(map: L.Map, name: string, zIndex: number): HTMLElement {
  const pane = map.getPane(name) ?? map.createPane(name);
  pane.style.zIndex = String(zIndex);
  return pane;
}

function safePaneId(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '_');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
