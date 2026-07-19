import { useEffect, useState } from 'react';
import { Pane, TileLayer } from 'react-leaflet';
import type { DateRange } from '../data/imagery';
import type { ImageryLayer } from './LayerControls';

const MOSAIC_API = 'https://planetarycomputer.microsoft.com/api/data/v1/mosaic';
const OPTICAL_COLLECTION = 'sentinel-2-l2a';
const SAR_COLLECTION = 'sentinel-1-rtc';

export type TimelineRequest = {
  id: number;
  layer: Exclude<ImageryLayer, 'none'>;
  dateRange: DateRange;
};

type MosaicLayer = {
  kind: 'optical' | 'sar';
  url: string;
};

export function TimelineImageryLayer({ request }: { request: TimelineRequest | null }) {
  const [layers, setLayers] = useState<MosaicLayer[]>([]);

  useEffect(() => {
    if (!request) {
      setLayers([]);
      return;
    }

    let cancelled = false;
    setLayers([]);

    const kinds: MosaicLayer['kind'][] = request.layer === 'both' ? ['sar', 'optical'] : [request.layer];
    Promise.all(kinds.map(async (kind) => ({ kind, url: await createMosaic(kind, request.dateRange) })))
      .then((loaded) => {
        if (!cancelled) setLayers(loaded);
      })
      .catch((error: unknown) => {
        console.error('Timeline mosaic failed to load', error);
        if (!cancelled) setLayers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [request]);

  return (['sar', 'optical'] as const).map((kind) => {
    const mosaic = layers.find((layer) => layer.kind === kind);
    const attribution = `${kind === 'optical' ? 'Sentinel-2' : 'Sentinel-1 SAR'} imagery &copy; ESA, rendered by Microsoft Planetary Computer`;

    return (
      <Pane key={kind} name={`timeline-${kind}`} style={{ zIndex: kind === 'optical' ? 260 : 250 }}>
        {mosaic && (
          <TileLayer
            key={request?.id}
            attribution={attribution}
            url={mosaic.url}
            minZoom={9}
            maxZoom={18}
            opacity={request?.layer === 'both' ? 0.55 : 0.78}
            updateWhenIdle
            updateWhenZooming={false}
            keepBuffer={1}
          />
        )}
      </Pane>
    );
  });
}

async function createMosaic(kind: MosaicLayer['kind'], dateRange: DateRange): Promise<string> {
  const collection = kind === 'optical' ? OPTICAL_COLLECTION : SAR_COLLECTION;
  const registration = await fetch(`${MOSAIC_API}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      collections: [collection],
      datetime: `${dateRange.start}T00:00:00Z/${dateRange.end}T23:59:59Z`,
    }),
  });
  if (!registration.ok) throw new Error(`Mosaic registration failed: ${registration.status}`);

  const registered: unknown = await registration.json();
  if (!isRecord(registered) || typeof registered.id !== 'string') throw new Error('Mosaic registration returned no id.');

  const params = kind === 'optical' ? opticalParams() : sarParams();
  const response = await fetch(`${MOSAIC_API}/${registered.id}/WebMercatorQuad/tilejson.json?${params.toString()}`);
  if (!response.ok) throw new Error(`Mosaic TileJSON failed: ${response.status}`);

  const tileJson: unknown = await response.json();
  if (!isRecord(tileJson) || !Array.isArray(tileJson.tiles) || typeof tileJson.tiles[0] !== 'string') {
    throw new Error('Mosaic TileJSON returned no tile URL.');
  }
  return tileJson.tiles[0];
}

function opticalParams(): URLSearchParams {
  return new URLSearchParams({
    assets: 'visual',
    asset_bidx: 'visual|1,2,3',
    nodata: '0',
    tile_format: 'png',
    collection: OPTICAL_COLLECTION,
    pixel_selection: 'first',
  });
}

function sarParams(): URLSearchParams {
  const params = new URLSearchParams({
    collection: SAR_COLLECTION,
    asset_as_band: 'true',
    expression: 'vv;vh;vv/vh',
    color_formula: 'gamma RGB 1.6 saturation 1.2',
    tile_format: 'png',
    pixel_selection: 'first',
  });
  params.append('assets', 'vv');
  params.append('assets', 'vh');
  params.append('rescale', '0,0.25');
  params.append('rescale', '0,0.08');
  params.append('rescale', '0,4');
  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
