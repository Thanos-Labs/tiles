import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  formatTimelineDay,
  formatTimelineDuration,
  timelineDuration,
  timelineDurationForSlider,
  timelineMaxStart,
  timelineRangeFromStart,
  timelineSliderForDuration,
  TIMELINE_DURATION_SLIDER_MAX,
} from '../lib/timeline';
import type { DayRange } from '../lib/timeline';

export function DateRangeControls({
  range,
  disabled,
  onApply,
  onRangeChange,
}: {
  range: DayRange;
  disabled: boolean;
  onApply: () => void;
  onRangeChange: (range: DayRange) => void;
}) {
  const [draftRange, setDraftRange] = useState<DayRange>(range);

  useEffect(() => setDraftRange(range), [range]);

  const duration = timelineDuration(draftRange);

  const updateDuration = (value: number | readonly number[]): DayRange => {
    return timelineRangeFromStart(draftRange[0], timelineDurationForSlider(sliderValue(value)));
  };

  const updateStart = (value: number | readonly number[]): DayRange => {
    return timelineRangeFromStart(sliderValue(value), duration);
  };

  const commitRange = (next: DayRange) => {
    setDraftRange(next);
    onRangeChange(next);
  };

  return (
    <Card size="sm" role="region" aria-label="Date range controls">
      <CardHeader>
        <CardTitle>Date range</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>Range</span>
            <output>{formatTimelineDuration(duration)}</output>
          </div>
          <Slider
            value={[timelineSliderForDuration(duration)]}
            min={0}
            max={TIMELINE_DURATION_SLIDER_MAX}
            step={1}
            largeStep={100}
            thumbLabels={['Range']}
            getAriaValueText={(_, value) => formatTimelineDuration(timelineDurationForSlider(value))}
            onValueChange={(value) => setDraftRange(updateDuration(value))}
            onValueCommitted={(value) => commitRange(updateDuration(value))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>Start date</span>
            <time>{formatTimelineDay(draftRange[0])}</time>
          </div>
          <Slider
            value={[draftRange[0]]}
            min={0}
            max={timelineMaxStart(duration)}
            step={1}
            largeStep={365}
            thumbLabels={['Start date']}
            getAriaValueText={(_, value) => formatTimelineDay(value)}
            onValueChange={(value) => setDraftRange(updateStart(value))}
            onValueCommitted={(value) => commitRange(updateStart(value))}
          />
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>End date</span>
            <time>{formatTimelineDay(draftRange[1])}</time>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" disabled={disabled} onClick={onApply}>Load imagery</Button>
      </CardFooter>
    </Card>
  );
}

function sliderValue(value: number | readonly number[]): number {
  return typeof value === 'number' ? value : value[0] ?? 0;
}
