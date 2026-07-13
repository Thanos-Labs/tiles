import { useState } from 'react';
import { LayerControls } from './components/LayerControls';
import { MapView } from './components/MapView';

export type LayerVisibility = {
  satellite: boolean;
  sar: boolean;
  compare: boolean;
  sites: boolean;
};

const initialVisibility: LayerVisibility = {
  satellite: true,
  sar: false,
  compare: false,
  sites: true,
};

export function App() {
  const [visible, setVisible] = useState(initialVisibility);
  const [satelliteStatus, setSatelliteStatus] = useState('Loading satellite imagery...');
  const [sarStatus, setSarStatus] = useState('Loading SAR imagery...');
  const [compareStatus, setCompareStatus] = useState('Compare mode is off.');

  return (
    <main className="app-shell" aria-label="Satellite map">
      <MapView
        showSatellite={visible.satellite}
        showSar={visible.sar}
        showCompare={visible.compare}
        showSites={visible.sites}
        onSatelliteStatus={setSatelliteStatus}
        onSarStatus={setSarStatus}
        onCompareStatus={setCompareStatus}
      />
      <div className="controls-region">
        <LayerControls
          visible={visible}
          satelliteStatus={satelliteStatus}
          sarStatus={sarStatus}
          compareStatus={compareStatus}
          onChange={setVisible}
        />
      </div>
    </main>
  );
}
