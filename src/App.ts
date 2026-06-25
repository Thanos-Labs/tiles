import { createLayerControls } from "./components/LayerControls";
import { MapView } from "./components/MapView";
import { loadData } from "./data/loaders";
import type { GeoItem, LayerVisibility } from "./data/types";

const initialVisibility: LayerVisibility = {
  ports: true,
  naval_bases: true,
  areas_of_interest: true,
};

export class App {
  private readonly mapView: MapView;
  private readonly layerControlsElement: HTMLElement;
  private readonly errorPanelElement: HTMLElement;
  private readonly statusPanelElement: HTMLElement;
  private items: GeoItem[] = [];
  private visible: LayerVisibility = initialVisibility;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <main class="app-shell">
        <section id="map" aria-label="Read-only naval data map"></section>
        <aside class="controls-stack" aria-label="Map controls">
          <section id="errorPanel" class="message-panel" hidden></section>
          <section class="panel" aria-label="Layers">
            <header class="panel-header">
              <span>Layers</span>
            </header>
            <div id="layerControls" class="panel-body"></div>
          </section>
          <section id="statusPanel" class="message-panel subtle">Loading naval data...</section>
        </aside>
      </main>
    `;

    const layerControls = root.querySelector<HTMLElement>("#layerControls");
    const errorPanel = root.querySelector<HTMLElement>("#errorPanel");
    const statusPanel = root.querySelector<HTMLElement>("#statusPanel");
    if (!layerControls || !errorPanel || !statusPanel) throw new Error("Missing app controls");

    this.layerControlsElement = layerControls;
    this.errorPanelElement = errorPanel;
    this.statusPanelElement = statusPanel;
    this.mapView = new MapView("map");
  }

  async start(): Promise<void> {
    this.renderControls();
    this.installLegacyServiceWorkerCleanup();

    try {
      this.items = await loadData();
      this.setStatus(`${this.items.length} locations loaded.`, false);
      this.mapView.setItems(this.items);
      this.renderControls();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(`Unable to load naval data. ${message}`);
      this.setStatus("Data failed to load.", false);
    }
  }

  private renderControls(): void {
    this.layerControlsElement.replaceChildren(
      createLayerControls({
        visible: this.visible,
        items: this.items,
        onChange: (next) => {
          this.visible = next;
          this.mapView.setVisible(next);
          this.renderControls();
        },
      }),
    );
  }

  private setError(message: string): void {
    this.errorPanelElement.textContent = message;
    this.errorPanelElement.hidden = false;
  }

  private setStatus(message: string, loading: boolean): void {
    this.statusPanelElement.textContent = message;
    this.statusPanelElement.classList.toggle("loading", loading);
  }

  private installLegacyServiceWorkerCleanup(): void {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      cleanupServiceWorkers().catch(() => undefined);
    });
  }
}

async function cleanupServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("satellite-locations-map-")).map((key) => caches.delete(key)));
  }
}
