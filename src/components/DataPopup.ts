import { labels } from "../data/loaders";
import type { GeoItem } from "../data/types";
import { centerFromBounds } from "../lib/bounds";
import { escapeHtml, formatValue, safeUrl } from "../lib/utils";
import { tag } from "./ui";

export function dataPopupHtml(item: GeoItem): string {
  const note = item.data.notes ? `<p>${escapeHtml(item.data.notes)}</p>` : "";
  const wikiUrl = safeUrl(item.data.wikipedia_url);
  const wiki = wikiUrl ? `<a href="${escapeHtml(wikiUrl)}" target="_blank" rel="noreferrer">Wikipedia</a>` : "";
  const mapsUrl = googleMapsUrl(item);

  return `
    <div class="popup-content">
      ${tag(labels[item.kind])}
      <div>
        <div class="popup-title">${escapeHtml(item.data.name)}</div>
        <div class="popup-subtitle">${escapeHtml(subtitle(item))}</div>
      </div>
      ${note}
      <div class="popup-links">
        <a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Google Maps</a>
        ${wiki}
      </div>
    </div>
  `;
}

function subtitle(item: GeoItem): string {
  if (item.kind === "ports") {
    return [item.data.country, formatValue(item.data.type)].filter(Boolean).join(" - ");
  }

  return [item.data.country, item.data.operator].filter(Boolean).join(" - ");
}

function googleMapsUrl(item: GeoItem): string {
  const point = item.data.location ?? centerFromBounds(item.data.bounds);
  const lat = point.lat.toFixed(6);
  const lon = point.lon.toFixed(6);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
