import { useState } from 'react';
import { LayerControls } from './components/LayerControls';
import { MapView } from './components/MapView';

export type LayerVisibility = {
  satellite: boolean;
  sar: boolean;
  sites: boolean;
};

const initialVisibility: LayerVisibility = {
  satellite: true,
  sar: true,
  sites: true,
};

export function App() {
  const [visible, setVisible] = useState(initialVisibility);
  const [satelliteStatus, setSatelliteStatus] = useState('Loading satellite imagery...');
  const [sarStatus, setSarStatus] = useState('Loading SAR imagery...');

  return (
    <main className="app-shell" aria-label="Satellite map">
      <MapView
        showSatellite={visible.satellite}
        showSar={visible.sar}
        showSites={visible.sites}
        onSatelliteStatus={setSatelliteStatus}
        onSarStatus={setSarStatus}
      />
      <div className="controls-region">
        <LayerControls
          visible={visible}
          satelliteStatus={satelliteStatus}
          sarStatus={sarStatus}
          onChange={setVisible}
        />
      </div>
    </main>
  );
}
