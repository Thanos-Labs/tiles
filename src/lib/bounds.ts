import L from "leaflet";
import type { Bounds, Point } from "../data/types";

export function centerFromBounds(bounds: Bounds): Point {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lon: (bounds.east + bounds.west) / 2,
  };
}

export function leafletBounds(bounds: Bounds): L.LatLngBounds {
  return L.latLngBounds(
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  );
}

export function shiftBounds(bounds: Bounds, offset: number): Bounds {
  return {
    north: bounds.north,
    south: bounds.south,
    east: bounds.east + offset,
    west: bounds.west + offset,
  };
}

export function boundsArea(bounds: Bounds): number {
  return Math.abs((bounds.north - bounds.south) * (bounds.east - bounds.west));
}
