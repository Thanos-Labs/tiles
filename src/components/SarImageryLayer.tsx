import { LatLngBounds } from 'leaflet';
import { Fragment, useEffect, useState } from 'react';
import { Popup, Rectangle, TileLayer } from 'react-leaflet';
import { loadImageryLocations, PLANETARY_COMPUTER_TILES, stacSearchLatestByBbox } from '../data/imagery';
import type { SatelliteLocation, StacItem } from '../data/imagery';

const COLLECTION = 'sentinel-1-rtc';
const ASSET = 'vh';

type ImageryTile = {
  location: SatelliteLocation;
  item: StacItem;
};

export function SarImageryLayer({ visible, onStatus }: { visible: boolean; onStatus: (status: string) => void }) {
  const [tiles, setTiles] = useState<ImageryTile[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      onStatus('Loading satellite locations...');
      const locations = await loadImageryLocations();
      if (cancelled) return;

      if (locations.length === 0) {
        onStatus('No satellite locations found.');
        return;
      }

      onStatus(`Finding Sentinel-1 SAR imagery for ${locations.length} locations...`);
      let missing = 0;
      const results = await Promise.allSettled(locations.map(async (location) => {
        const item = await stacSearchLatestByBbox(COLLECTION, location.bbox);
        if (!item) {
          missing += 1;
          return null;
        }
        return { location, item };
      }));
      if (cancelled) return;

      const loaded = results.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
      missing += results.filter((result) => result.status === 'rejected').length;
      setTiles(loaded);
      onStatus(
        loaded.length > 0
          ? `SAR imagery loaded for ${loaded.length} locations${missing > 0 ? `; ${missing} unavailable.` : '.'}`
          : 'No SAR imagery found.',
      );
    }

    load().catch((error: unknown) => {
      console.error('SAR imagery failed', error);
      if (!cancelled) onStatus('SAR imagery failed to load.');
    });

    return () => {
      cancelled = true;
    };
  }, [onStatus]);

  if (!visible) return null;

  return tiles.map(({ location, item }) => {
    const params = new URLSearchParams({ collection: COLLECTION, item: item.id, assets: ASSET });
    const [west, south, east, north] = location.bbox;
    const bounds = new LatLngBounds([south, west], [north, east]);

    return (
      <Fragment key={`${location.id}:${item.id}`}>
        <TileLayer
          attribution="Sentinel-1 SAR imagery &copy; ESA, rendered by Microsoft Planetary Computer"
          url={`${PLANETARY_COMPUTER_TILES}?${params.toString()}`}
          bounds={bounds}
          maxNativeZoom={18}
          maxZoom={18}
          opacity={0.78}
          updateWhenIdle
          updateWhenZooming={false}
          keepBuffer={1}
        />
        <Rectangle bounds={bounds} pathOptions={{ color: '#ffec99', dashArray: '5 5', fill: false, opacity: 0.95, weight: 2 }}>
          <Popup closeButton={false}>
            <strong>{location.name}</strong>
            <br />
            Sentinel-1 {item.properties?.datetime?.slice(0, 10) ?? item.id}
          </Popup>
        </Rectangle>
      </Fragment>
    );
  });
}
