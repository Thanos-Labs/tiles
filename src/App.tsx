import { useRef, useState } from 'react';
import { MapPinnedIcon, SatelliteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LayerControls } from './components/LayerControls';
import type { ImageryLayer } from './components/LayerControls';
import { DateRangeControls } from './components/DateRangeControls';
import { MapView } from './components/MapView';
import type { TimelineRequest } from './components/TimelineImageryLayer';
import { INITIAL_TIMELINE_RANGE, timelineDateRange } from './lib/timeline';
import type { DayRange } from './lib/timeline';

type MapViewMode = 'locations' | 'timeline';

export function App() {
  const [view, setView] = useState<MapViewMode>('locations');
  const [locationLayer, setLocationLayer] = useState<ImageryLayer>('optical');
  const [timelineLayer, setTimelineLayer] = useState<ImageryLayer>('optical');
  const [sitesVisible, setSitesVisible] = useState(true);
  const [timelineRange, setTimelineRange] = useState<DayRange>(INITIAL_TIMELINE_RANGE);
  const [timelineRequest, setTimelineRequest] = useState<TimelineRequest | null>(null);
  const nextTimelineRequestId = useRef(0);

  const updateTimelineLayer = (layer: ImageryLayer) => {
    setTimelineLayer(layer);
    setTimelineRequest(null);
  };

  const updateTimelineRange = (range: DayRange) => {
    setTimelineRange(range);
    setTimelineRequest(null);
  };

  const loadTimelineImagery = () => {
    if (timelineLayer === 'none') return;
    setTimelineRequest({
      id: ++nextTimelineRequestId.current,
      layer: timelineLayer,
      dateRange: timelineDateRange(timelineRange),
    });
  };

  return (
    <main className="dark relative size-full bg-background" aria-label="Satellite map">
      <MapView
        view={view}
        layer={locationLayer}
        sitesVisible={sitesVisible}
        timelineRequest={timelineRequest}
      />
      <div className="fixed top-4 left-4 z-[1000] flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2">
        <Card size="sm" className="self-start [--card-spacing:--spacing(1)]" role="navigation" aria-label="Map views">
          <CardContent className="flex gap-1">
            <Button
              size="icon-xs"
              variant={view === 'locations' ? 'default' : 'ghost'}
              aria-label="Locations view"
              aria-pressed={view === 'locations'}
              title="Locations view"
              onClick={() => setView('locations')}
            >
              <MapPinnedIcon />
            </Button>
            <Button
              size="icon-xs"
              variant={view === 'timeline' ? 'default' : 'ghost'}
              aria-label="Imagery timeline view"
              aria-pressed={view === 'timeline'}
              title="Imagery timeline view"
              onClick={() => setView('timeline')}
            >
              <SatelliteIcon />
            </Button>
          </CardContent>
        </Card>
        <LayerControls
          layer={view === 'locations' ? locationLayer : timelineLayer}
          sitesVisible={sitesVisible}
          onLayerChange={view === 'locations' ? setLocationLayer : updateTimelineLayer}
          onSitesChange={setSitesVisible}
        />
      </div>
      {view === 'timeline' && (
        <div className="fixed bottom-4 left-1/2 z-[1000] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <DateRangeControls
            range={timelineRange}
            disabled={timelineLayer === 'none'}
            onApply={loadTimelineImagery}
            onRangeChange={updateTimelineRange}
          />
        </div>
      )}
    </main>
  );
}
