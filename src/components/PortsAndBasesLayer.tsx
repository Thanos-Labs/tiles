import L from 'leaflet';
import { Fragment, useEffect, useState } from 'react';
import { Marker, Popup, Rectangle } from 'react-leaflet';
import { loadSites } from '../data/imagery';
import type { Site, SiteType } from '../data/imagery';

const markerIcons = {
  port: L.divIcon({ className: '', html: '<span class="site-marker port" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
  naval: L.divIcon({ className: '', html: '<span class="site-marker naval" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
  shipyard: L.divIcon({ className: '', html: '<span class="site-marker shipyard" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
};

const siteColors: Record<SiteType, string> = {
  port: '#48d7ff',
  naval: '#ff6b6b',
  shipyard: '#ffb86b',
};

export function PortsAndBasesLayer({ visible }: { visible: boolean }) {
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    let cancelled = false;

    loadSites()
      .then((loaded) => {
        if (!cancelled) setSites(loaded);
      })
      .catch((error: unknown) => {
        console.error('Ports, bases, and shipyards failed to load', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return sites.flatMap((site) => [-360, 0, 360].map((offset) => {
    const [west, south, east, north] = site.bbox;
    const typeLabel = site.type === 'port' ? 'Port' : site.type === 'shipyard' ? 'Shipyard' : 'Naval base';

    return (
      <Fragment key={`${site.id}:${offset}`}>
        <Rectangle
          bounds={[[south, west + offset], [north, east + offset]]}
          pathOptions={{ color: siteColors[site.type], dashArray: '5 5', fill: false, opacity: 0.95, weight: 2 }}
          interactive={false}
        />
        <Marker position={[site.lat, site.lng + offset]} icon={markerIcons[site.type]} riseOnHover>
          <Popup closeButton={false}>
            <strong>{site.name}</strong>
            <br />
            {typeLabel}
          </Popup>
        </Marker>
      </Fragment>
    );
  }));
}
