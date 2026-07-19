import type { DateRange } from '../data/imagery';

export type DayRange = [number, number];

const DAY_MS = 86_400_000;
const SENTINEL_START_MS = Date.UTC(2014, 3, 3);
const DURATION_SLIDER_STEPS = 1000;
const MAX_DURATION_DAYS = 365;
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });

export const TIMELINE_MAX_DAY = Math.floor((Date.now() - SENTINEL_START_MS) / DAY_MS);
export const INITIAL_TIMELINE_RANGE: DayRange = [Math.max(0, TIMELINE_MAX_DAY - 29), TIMELINE_MAX_DAY];
export const TIMELINE_DURATION_SLIDER_MAX = DURATION_SLIDER_STEPS;

export function formatTimelineDay(day: number): string {
  return dateFormatter.format(SENTINEL_START_MS + day * DAY_MS);
}

export function timelineDateRange([start, end]: DayRange): DateRange {
  return {
    start: new Date(SENTINEL_START_MS + start * DAY_MS).toISOString().slice(0, 10),
    end: new Date(SENTINEL_START_MS + end * DAY_MS).toISOString().slice(0, 10),
  };
}

export function timelineDuration([start, end]: DayRange): number {
  return clamp(end - start + 1, 1, MAX_DURATION_DAYS);
}

export function timelineDurationForSlider(value: number): number {
  return clamp(Math.round(Math.exp(clamp(value, 0, DURATION_SLIDER_STEPS) / DURATION_SLIDER_STEPS * Math.log(MAX_DURATION_DAYS))), 1, MAX_DURATION_DAYS);
}

export function timelineSliderForDuration(days: number): number {
  return Math.round(Math.log(clamp(days, 1, MAX_DURATION_DAYS)) / Math.log(MAX_DURATION_DAYS) * DURATION_SLIDER_STEPS);
}

export function timelineMaxStart(duration: number): number {
  return TIMELINE_MAX_DAY - clamp(duration, 1, MAX_DURATION_DAYS) + 1;
}

export function timelineRangeFromStart(start: number, duration: number): DayRange {
  const days = clamp(duration, 1, MAX_DURATION_DAYS);
  const clampedStart = clamp(start, 0, timelineMaxStart(days));
  return [clampedStart, clampedStart + days - 1];
}

export function formatTimelineDuration(days: number): string {
  if (days === 1) return '1 day';
  if (days === MAX_DURATION_DAYS) return '1 year';
  return `${days} days`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
