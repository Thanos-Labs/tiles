import L from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Bbox } from '../data/imagery';
import { attachTileClip } from '../lib/tileClip';

export function ClippedTileLayer({
  attribution,
  bbox,
  className,
  opacity,
  pane,
  url,
  minZoom,
}: {
  attribution: string;
  bbox: Bbox;
  className?: string;
  minZoom?: number;
  opacity: number;
  pane?: string;
  url: string;
}) {
  const map = useMap();
  const bboxKey = bbox.join(',');

  useEffect(() => {
    const [west, south, east, north] = bbox;
    const options: L.TileLayerOptions = {
      attribution,
      bounds: new L.LatLngBounds([south, west], [north, east]),
      maxNativeZoom: 18,
      maxZoom: 18,
      minZoom,
      opacity,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
    };
    if (className) options.className = className;
    if (pane) options.pane = pane;

    const layer = L.tileLayer(url, options);
    const clip = attachTileClip({ layer, map, bbox });
    layer.addTo(map);
    clip.setRange(0, 1);

    return () => {
      clip.detach();
      map.removeLayer(layer);
    };
  }, [attribution, bboxKey, className, map, opacity, pane, url]);

  return null;
}
