import { escapeHtml } from "../../lib/utils";

export function tag(label: string): string {
  return `<div class="tag">${escapeHtml(label)}</div>`;
}
