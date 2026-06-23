import { MapContainer, Pane, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { PortsAndBasesLayer } from './PortsAndBasesLayer';
import { SarImageryLayer } from './SarImageryLayer';
import { SatelliteImageryLayer } from './SatelliteImageryLayer';

export function MapView({
  showSatellite,
  showSar,
  showSites,
  onSatelliteStatus,
  onSarStatus,
}: {
  showSatellite: boolean;
  showSar: boolean;
  showSites: boolean;
  onSatelliteStatus: (status: string) => void;
  onSarStatus: (status: string) => void;
}) {
  const center: LatLngExpression = [16, -155];

  return (
    <MapContainer center={center} zoom={3} minZoom={2} maxZoom={18} zoomControl className="z-0" worldCopyJump preferCanvas>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={18}
        updateWhenIdle
        updateWhenZooming={false}
        keepBuffer={2}
      />
      <Pane name="satellitePane" style={{ zIndex: 250 }}>
        <SatelliteImageryLayer visible={showSatellite} onStatus={onSatelliteStatus} />
      </Pane>
      <Pane name="sarPane" style={{ zIndex: 260 }}>
        <SarImageryLayer visible={showSar} onStatus={onSarStatus} />
      </Pane>
      <PortsAndBasesLayer visible={showSites} />
    </MapContainer>
  );
}
