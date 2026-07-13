import type { Dispatch, SetStateAction } from 'react';
import type { LayerVisibility } from '../App';
import { IMAGERY_MIN_ZOOM } from '../data/imagery';

export function LayerControls({
  visible,
  satelliteStatus,
  sarStatus,
  compareStatus,
  onChange,
}: {
  visible: LayerVisibility;
  satelliteStatus: string;
  sarStatus: string;
  compareStatus: string;
  onChange: Dispatch<SetStateAction<LayerVisibility>>;
}) {
  const toggleImagery = (layer: 'satellite' | 'sar' | 'compare', checked: boolean) => onChange((current) => ({
    ...current,
    satellite: checked && layer === 'satellite',
    sar: checked && layer === 'sar',
    compare: checked && layer === 'compare',
  }));

  return (
    <section className="panel" aria-label="Map controls">
      <div className="layers" aria-label="Layers">
        <LayerOption
          checked={visible.satellite}
          label="Satellite imagery"
          onChange={(checked) => toggleImagery('satellite', checked)}
        />
        <LayerOption
          checked={visible.sar}
          label="SAR imagery"
          onChange={(checked) => toggleImagery('sar', checked)}
        />
        <LayerOption
          checked={visible.compare}
          label="Compare mode"
          onChange={(checked) => toggleImagery('compare', checked)}
        />
        <LayerOption
          checked={visible.sites}
          label="Ports, bases, and shipyards"
          onChange={(checked) => onChange((current) => ({ ...current, sites: checked }))}
        />
      </div>
      <p>Satellite imagery uses the best available Sentinel-2 visual asset from Microsoft Planetary Computer for each location bounding box.</p>
      <p>SAR imagery uses the best available Sentinel-1 VV/VH assets from Microsoft Planetary Computer for each location bounding box.</p>
      <p>Imagery tiles and compare sliders display at zoom {IMAGERY_MIN_ZOOM}+.</p>
      <p className="status">{satelliteStatus}</p>
      <p className="status">{sarStatus}</p>
      <p className="status">{compareStatus}</p>
    </section>
  );
}

function LayerOption({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}
