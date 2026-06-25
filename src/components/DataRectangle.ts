import L from "leaflet";
import { colors } from "../data/loaders";
import type { GeoItem } from "../data/types";
import { dataPopupHtml } from "./DataPopup";

export function createDataRectangle({
  item,
  bounds,
  selected,
  onSelect,
}: {
  item: GeoItem;
  bounds: L.LatLngBounds;
  selected: boolean;
  onSelect: (item: GeoItem, layer: L.Path) => void;
}): L.Rectangle {
  const color = colors[item.kind];
  const rectangle = L.rectangle(bounds, {
    color,
    fillColor: color,
    fillOpacity: selected ? 0.28 : 0.16,
    weight: selected ? 4 : 2,
  });

  rectangle.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
    onSelect(item, rectangle);
  });

  rectangle.bindPopup(dataPopupHtml(item), { closeButton: false });
  return rectangle;
}
