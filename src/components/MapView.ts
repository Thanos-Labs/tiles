import L from "leaflet";
import type { GeoItem, LayerVisibility, Point } from "../data/types";
import { boundsArea, centerFromBounds, leafletBounds, shiftBounds } from "../lib/bounds";
import { createDataIndicator } from "./DataIndicator";
import { createDataRectangle } from "./DataRectangle";

function itemKey(item: GeoItem): string {
  return `${item.kind}:${item.data.name}`;
}

function itemCenter(item: GeoItem): Point {
  return item.data.location ?? centerFromBounds(item.data.bounds);
}

export class MapView {
  private readonly map: L.Map;
  private readonly dataLayer = L.layerGroup();
  private selectedKey: string | null = null;
  private items: GeoItem[] = [];
  private visible: LayerVisibility = {
    ports: true,
    naval_bases: true,
    areas_of_interest: true,
  };

  constructor(containerId: string) {
    this.map = L.map(containerId, {
      center: [20, 0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
      zoomControl: false,
    });

    L.control.zoom({ position: "topleft" }).addTo(this.map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri - Source: Esri, Maxar, Earthstar Geographics, GIS User Community",
      maxZoom: 18,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
    }).addTo(this.map);

    this.dataLayer.addTo(this.map);
    this.map.on("moveend zoomend", () => this.render());
    this.map.on("click", () => {
      this.selectedKey = null;
      this.render();
    });
  }

  setItems(items: GeoItem[]): void {
    this.items = items;
    this.render();
  }

  setVisible(visible: LayerVisibility): void {
    this.visible = visible;
    this.render();
  }

  render(): void {
    const bounds = this.map.getBounds().pad(0.08);
    const sortedItems = [...this.items]
      .filter((item) => this.visible[item.kind])
      .sort((a, b) => boundsArea(b.data.bounds) - boundsArea(a.data.bounds));

    this.dataLayer.clearLayers();

    for (const item of sortedItems) {
      const key = itemKey(item);
      const west = bounds.getWest();
      const east = bounds.getEast();
      const center = itemCenter(item);
      const centerLng = center.lon;
      const minWorld = Math.floor((west - centerLng) / 360);
      const maxWorld = Math.ceil((east - centerLng) / 360);

      for (let world = minWorld; world <= maxWorld; world += 1) {
        const shiftedBounds = shiftBounds(item.data.bounds, world * 360);
        const rectangleBounds = leafletBounds(shiftedBounds);
        const displayCenter = { lat: center.lat, lon: center.lon + world * 360 };
        const centerIsVisible = bounds.contains([displayCenter.lat, displayCenter.lon]);
        const rectangleIsVisible = bounds.intersects(rectangleBounds);
        if (!centerIsVisible && !rectangleIsVisible) continue;

        if (rectangleIsVisible) {
          createDataRectangle({
            item,
            bounds: rectangleBounds,
            selected: this.selectedKey === key,
            onSelect: (selectedItem, layer) => this.selectItem(selectedItem, layer),
          }).addTo(this.dataLayer);
        }

        if (centerIsVisible) {
          createDataIndicator({
            item,
            point: displayCenter,
            selected: this.selectedKey === key,
            onSelect: (selectedItem, layer) => this.selectItem(selectedItem, layer),
          }).addTo(this.dataLayer);
        }
      }
    }
  }

  private selectItem(item: GeoItem, layer: L.Path): void {
    this.selectedKey = itemKey(item);
    if (layer instanceof L.CircleMarker) {
      layer.setStyle({ fillOpacity: 1, radius: 8, weight: 3 });
    } else {
      layer.setStyle({ fillOpacity: 0.28, weight: 4 });
    }
    layer.bringToFront();
    layer.openPopup();
  }
}
