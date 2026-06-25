import { colors, labels } from "../data/loaders";
import type { DataKind, GeoItem, LayerVisibility } from "../data/types";
import { colorIndicator } from "./ui";

const dataOrder: DataKind[] = ["ports", "naval_bases", "areas_of_interest"];

export function createLayerControls({
  visible,
  items,
  onChange,
}: {
  visible: LayerVisibility;
  items: GeoItem[];
  onChange: (next: LayerVisibility) => void;
}): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "layer-list";

  const counts = getCounts(items);
  controls.replaceChildren(
    ...dataOrder.map((kind) => {
      const label = document.createElement("label");
      label.className = "layer-row";
      label.innerHTML = `
        <span class="layer-label">
          <input type="checkbox" ${visible[kind] ? "checked" : ""} ${counts[kind] === 0 ? "disabled" : ""}>
          ${colorIndicator(colors[kind])}
          <span>${labels[kind]}</span>
        </span>
        <span class="layer-count">${counts[kind]}</span>
      `;

      const input = label.querySelector<HTMLInputElement>("input");
      input?.addEventListener("change", () => {
        onChange({ ...visible, [kind]: Boolean(input.checked) });
      });

      return label;
    }),
  );

  return controls;
}

function getCounts(items: GeoItem[]): Record<DataKind, number> {
  return {
    ports: items.filter((item) => item.kind === "ports").length,
    naval_bases: items.filter((item) => item.kind === "naval_bases").length,
    areas_of_interest: 0,
  };
}
