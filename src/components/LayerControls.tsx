import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export type ImageryLayer = 'optical' | 'sar' | 'both' | 'none';

export function LayerControls({
  layer,
  sitesVisible,
  onLayerChange,
  onSitesChange,
}: {
  layer: ImageryLayer;
  sitesVisible: boolean;
  onLayerChange: (layer: ImageryLayer) => void;
  onSitesChange: (visible: boolean) => void;
}) {
  const toggleImagery = (next: Exclude<ImageryLayer, 'none'>, checked: boolean) => {
    onLayerChange(checked ? next : 'none');
  };

  return (
    <Card size="sm" role="region" aria-label="Map controls">
      <CardHeader>
        <CardTitle>Layers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-3" aria-label="Imagery">
          <Label>
            <Checkbox checked={layer === 'optical'} onCheckedChange={(checked) => toggleImagery('optical', checked)} />
            Optical
          </Label>
          <Label>
            <Checkbox checked={layer === 'sar'} onCheckedChange={(checked) => toggleImagery('sar', checked)} />
            SAR
          </Label>
          <Label>
            <Checkbox checked={layer === 'both'} onCheckedChange={(checked) => toggleImagery('both', checked)} />
            Optical - SAR
          </Label>
        </fieldset>
        <Label>
          <Checkbox
            checked={sitesVisible}
            onCheckedChange={onSitesChange}
          />
          AOIs and POIs
        </Label>
      </CardContent>
    </Card>
  );
}
