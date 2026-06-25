export type DataKind = "ports" | "naval_bases" | "areas_of_interest";

export type Point = {
  lat: number;
  lon: number;
};

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type CollectionMeta = {
  _file?: string;
};

export type Port = CollectionMeta & {
  name: string;
  country: string | null;
  type: string | null;
  bounds: Bounds;
  location?: Point;
  operator: string | null;
  notes: string | null;
  wikipedia_url: string | null;
};

export type NavalBase = CollectionMeta & {
  name: string;
  country: string | null;
  operator: string | null;
  bounds: Bounds;
  location?: Point;
  notes: string | null;
  wikipedia_url: string | null;
};

export type GeoItem =
  | { kind: "ports"; data: Port }
  | { kind: "naval_bases"; data: NavalBase };

export type LayerVisibility = Record<DataKind, boolean>;
