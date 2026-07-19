import { MapContainer, Pane, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { CompareImageryLayer } from './CompareImageryLayer';
import { PortsAndBasesLayer } from './PortsAndBasesLayer';
import { SarImageryLayer } from './SarImageryLayer';
import { SatelliteImageryLayer } from './SatelliteImageryLayer';
import { TimelineImageryLayer } from './TimelineImageryLayer';
import type { TimelineRequest } from './TimelineImageryLayer';
import type { ImageryLayer } from './LayerControls';

const ignoreStatus = () => {};

export function MapView({
  view,
  layer,
  sitesVisible,
  timelineRequest,
}: {
  view: 'locations' | 'timeline';
  layer: ImageryLayer;
  sitesVisible: boolean;
  timelineRequest: TimelineRequest | null;
}) {
  const center: LatLngExpression = [16, -155];

  return (
    <MapContainer center={center} zoom={3} minZoom={2} maxZoom={18} zoomControl={false} className="z-0" worldCopyJump preferCanvas>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={18}
        updateWhenIdle
        updateWhenZooming={false}
        keepBuffer={2}
      />
      {view === 'locations' ? (
        <>
          <Pane name="satellitePane" style={{ zIndex: 250 }}>
            <SatelliteImageryLayer visible={layer === 'optical'} onStatus={ignoreStatus} />
          </Pane>
          <Pane name="sarPane" style={{ zIndex: 260 }}>
            <SarImageryLayer visible={layer === 'sar'} onStatus={ignoreStatus} />
          </Pane>
          <CompareImageryLayer visible={layer === 'both'} onStatus={ignoreStatus} />
        </>
      ) : (
        <TimelineImageryLayer request={timelineRequest} />
      )}
      <PortsAndBasesLayer visible={sitesVisible} />
    </MapContainer>
  );
}
