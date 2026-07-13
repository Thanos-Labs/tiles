import L from 'leaflet';
import type { Bbox } from '../data/imagery';

type ClipTileElement = HTMLImageElement & {
  _bboxClipCoords?: L.Coords;
};

export function attachTileClip({
  layer,
  map,
  bbox,
  leftRatio = 0,
  rightRatio = 1,
}: {
  layer: L.TileLayer;
  map: L.Map;
  bbox: Bbox;
  leftRatio?: number;
  rightRatio?: number;
}) {
  let range = { leftRatio, rightRatio };

  function applyTile(tile: ClipTileElement, coords: L.Coords): void {
    clipTileToRange(layer, map, tile, coords, bbox, range.leftRatio, range.rightRatio);
  }

  function onTile(event: L.TileEvent): void {
    const tile = event.tile as ClipTileElement;
    tile._bboxClipCoords = event.coords;
    applyTile(tile, event.coords);
  }

  layer.on('tileloadstart', onTile);
  layer.on('tileload', onTile);

  return {
    detach() {
      layer.off('tileloadstart', onTile);
      layer.off('tileload', onTile);
    },
    setRange(nextLeftRatio: number, nextRightRatio: number) {
      range = { leftRatio: nextLeftRatio, rightRatio: nextRightRatio };
      layer.getContainer()?.querySelectorAll('img').forEach((tile) => {
        const clipTile = tile as ClipTileElement;
        if (clipTile._bboxClipCoords) applyTile(clipTile, clipTile._bboxClipCoords);
      });
    },
  };
}

function clipTileToRange(
  layer: L.TileLayer,
  map: L.Map,
  tile: ClipTileElement,
  coords: L.Coords,
  bbox: Bbox,
  leftRatio: number,
  rightRatio: number,
): void {
  const [west, south, east, north] = bbox;
  const tileSize = layer.getTileSize();
  const nw = map.project([north, west], coords.z);
  const se = map.project([south, east], coords.z);
  const bboxLeft = Math.min(nw.x, se.x);
  const bboxRight = Math.max(nw.x, se.x);
  const width = bboxRight - bboxLeft;
  const left = bboxLeft + width * leftRatio;
  const right = bboxLeft + width * rightRatio;
  const top = Math.min(nw.y, se.y);
  const bottom = Math.max(nw.y, se.y);
  const tileLeft = coords.x * tileSize.x;
  const tileTop = coords.y * tileSize.y;
  const localTop = top - tileTop;
  const localRight = tileLeft + tileSize.x - right;
  const localBottom = tileTop + tileSize.y - bottom;
  const localLeft = left - tileLeft;

  if (
    localLeft >= tileSize.x ||
    localRight >= tileSize.x ||
    localTop >= tileSize.y ||
    localBottom >= tileSize.y ||
    right <= left ||
    bottom <= top
  ) {
    tile.style.visibility = 'hidden';
    return;
  }

  tile.style.visibility = '';
  const clip = `inset(${clamp(localTop, 0, tileSize.y)}px ${clamp(localRight, 0, tileSize.x)}px ${clamp(localBottom, 0, tileSize.y)}px ${clamp(localLeft, 0, tileSize.x)}px)`;
  tile.style.clipPath = clip;
  tile.style.setProperty('-webkit-clip-path', clip);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
