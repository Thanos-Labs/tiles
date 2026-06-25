import L from "leaflet";
import { colors } from "../data/loaders";
import type { GeoItem, Point } from "../data/types";
import { dataPopupHtml } from "./DataPopup";

export function createDataIndicator({
  item,
  point,
  selected,
  onSelect,
}: {
  item: GeoItem;
  point: Point;
  selected: boolean;
  onSelect: (item: GeoItem, layer: L.Path) => void;
}): L.CircleMarker {
  const color = colors[item.kind];
  const indicator = L.circleMarker([point.lat, point.lon], {
    className: "data-indicator",
    color: "#ffffff",
    fillColor: color,
    fillOpacity: selected ? 1 : 0.86,
    opacity: 1,
    radius: selected ? 8 : 6,
    weight: selected ? 3 : 2,
  });

  indicator.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
    onSelect(item, indicator);
  });

  indicator.bindPopup(dataPopupHtml(item), { closeButton: false });
  return indicator;
}
