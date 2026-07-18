import type { Dispatch, SetStateAction } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { LayerVisibility } from '../App';

export function LayerControls({
  visible,
  onChange,
}: {
  visible: LayerVisibility;
  onChange: Dispatch<SetStateAction<LayerVisibility>>;
}) {
  const toggleImagery = (layer: 'satellite' | 'sar' | 'compare', checked: boolean) => onChange((current) => ({
    ...current,
    satellite: checked && layer === 'satellite',
    sar: checked && layer === 'sar',
    compare: checked && layer === 'compare',
  }));

  return (
    <Card size="sm" role="region" aria-label="Map controls">
      <CardHeader>
        <CardTitle>Layers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-3" aria-label="Imagery">
          <Label>
            <Checkbox checked={visible.satellite} onCheckedChange={(checked) => toggleImagery('satellite', checked)} />
            Optical
          </Label>
          <Label>
            <Checkbox checked={visible.sar} onCheckedChange={(checked) => toggleImagery('sar', checked)} />
            SAR
          </Label>
          <Label>
            <Checkbox checked={visible.compare} onCheckedChange={(checked) => toggleImagery('compare', checked)} />
            Optical - SAR
          </Label>
        </fieldset>
        <Label>
          <Checkbox
            checked={visible.sites}
            onCheckedChange={(checked) => onChange((current) => ({ ...current, sites: checked }))}
          />
          AOIs and POIs
        </Label>
      </CardContent>
    </Card>
  );
}
