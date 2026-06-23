import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';

type SiteType = 'port' | 'naval';
type Site = [SiteType, string, number, number];

const sites: Site[] = [
  ['port', 'Shanghai', 31.23, 121.49],
  ['port', 'Singapore', 1.26, 103.82],
  ['port', 'Ningbo-Zhoushan', 29.88, 121.55],
  ['port', 'Shenzhen', 22.55, 114.06],
  ['port', 'Busan', 35.1, 129.04],
  ['port', 'Rotterdam', 51.95, 4.14],
  ['port', 'Antwerp-Bruges', 51.28, 4.27],
  ['port', 'Hamburg', 53.54, 9.97],
  ['port', 'Los Angeles / Long Beach', 33.75, -118.22],
  ['port', 'New York / New Jersey', 40.67, -74.04],
  ['port', 'Houston', 29.73, -95.26],
  ['port', 'Santos', -23.96, -46.3],
  ['port', 'Durban', -29.88, 31.05],
  ['port', 'Jebel Ali', 25.01, 55.06],
  ['port', 'Port Klang', 3, 101.39],
  ['port', 'Tanjung Pelepas', 1.36, 103.55],
  ['port', 'Piraeus', 37.94, 23.63],
  ['port', 'Algeciras', 36.13, -5.44],
  ['port', 'Colombo', 6.94, 79.84],
  ['port', 'Sydney', -33.85, 151.2],
  ['naval', 'Norfolk Naval Station', 36.95, -76.31],
  ['naval', 'San Diego Naval Base', 32.68, -117.16],
  ['naval', 'Pearl Harbor', 21.35, -157.95],
  ['naval', 'Portsmouth Naval Base', 50.81, -1.1],
  ['naval', 'Toulon Naval Base', 43.11, 5.93],
  ['naval', 'Rota Naval Base', 36.64, -6.35],
  ['naval', 'Yokosuka Naval Base', 35.29, 139.67],
  ['naval', 'Sasebo Naval Base', 33.16, 129.72],
  ['naval', 'Changi Naval Base', 1.31, 104.04],
  ['naval', 'Visakhapatnam Naval Base', 17.69, 83.28],
  ['naval', 'Garden Island Naval Base', -33.86, 151.23],
  ['naval', 'Severomorsk', 69.07, 33.42],
];

const markerIcons = {
  port: L.divIcon({ className: '', html: '<span class="site-marker port" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
  naval: L.divIcon({ className: '', html: '<span class="site-marker naval" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
};

export function PortsAndBasesLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return sites.flatMap(([type, name, lat, lng]) => [-360, 0, 360].map((offset) => (
    <Marker key={`${type}:${name}:${offset}`} position={[lat, lng + offset]} icon={markerIcons[type]} riseOnHover>
      <Popup closeButton={false}>
        <strong>{name}</strong>
        <br />
        {type === 'port' ? 'Major port' : 'Major naval base'}
      </Popup>
    </Marker>
  )));
}
