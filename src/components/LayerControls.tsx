import type { Dispatch, SetStateAction } from 'react';
import type { LayerVisibility } from '../App';

export function LayerControls({
  visible,
  satelliteStatus,
  sarStatus,
  onChange,
}: {
  visible: LayerVisibility;
  satelliteStatus: string;
  sarStatus: string;
  onChange: Dispatch<SetStateAction<LayerVisibility>>;
}) {
  return (
    <section className="panel" aria-label="Map controls">
      <div className="layers" aria-label="Layers">
        <Toggle
          checked={visible.satellite}
          label="Satellite imagery"
          onChange={(checked) => onChange((current) => ({ ...current, satellite: checked }))}
        />
        <Toggle
          checked={visible.sar}
          label="SAR imagery"
          onChange={(checked) => onChange((current) => ({ ...current, sar: checked }))}
        />
        <Toggle
          checked={visible.sites}
          label="Ports, bases, and shipyards"
          onChange={(checked) => onChange((current) => ({ ...current, sites: checked }))}
        />
      </div>
      <p>Satellite imagery uses the latest Sentinel-2 visual asset available from Microsoft Planetary Computer for each location bounding box.</p>
      <p>SAR imagery uses the latest Sentinel-1 VH asset available from Microsoft Planetary Computer for each location bounding box.</p>
      <p className="status">{satelliteStatus}</p>
      <p className="status">{sarStatus}</p>
    </section>
  );
}

function Toggle({
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
