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

const ignoreStatus = () => {};

export function App() {
  const [visible, setVisible] = useState(initialVisibility);

  return (
    <main className="dark relative size-full bg-background" aria-label="Satellite map">
      <MapView
        showSatellite={visible.satellite}
        showSar={visible.sar}
        showCompare={visible.compare}
        showSites={visible.sites}
        onSatelliteStatus={ignoreStatus}
        onSarStatus={ignoreStatus}
        onCompareStatus={ignoreStatus}
      />
      <div className="fixed top-4 left-4 z-[1000] w-[calc(100%-2rem)] max-w-xs">
        <LayerControls visible={visible} onChange={setVisible} />
      </div>
    </main>
  );
}
