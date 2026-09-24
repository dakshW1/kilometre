'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Color, Layer, PickingInfo } from '@deck.gl/core';
import { CITY_CENTER, RESTAURANTS, demandPoints, type Conditions, type DemandPoint, type Restaurant, type ZoneState } from '@/lib/geo';

export type CityMapTheme = 'night' | 'day';
export interface CameraState { center: [number, number]; zoom: number; pitch: number; bearing: number }

interface Props {
  theme?: CityMapTheme;
  conditions: Conditions;
  initialCamera?: CameraState;
  interactive?: boolean;
  hexOpacity?: number;
  elevationScale?: number;
  showRestaurants?: boolean;
  arc?: { from: [number, number]; to: [number, number] } | null;
  onHexHover?: (info: { value: number; x: number; y: number } | null) => void;
  onRestaurantClick?: (r: Restaurant) => void;
  zones?: ZoneState[];
  selectedZoneId?: string | null;
  onZoneClick?: (id: string) => void;
  onReady?: (map: maplibregl.Map) => void;
  className?: string;
}

const STYLES: Record<CityMapTheme, string> = {
  night: 'https://tiles.openfreemap.org/styles/dark',
  day: 'https://tiles.openfreemap.org/styles/positron',
};

const HEAT: Record<CityMapTheme, Color[]> = {
  night: [[44, 26, 84], [98, 34, 116], [165, 42, 110], [224, 72, 70], [255, 122, 61], [255, 199, 94]],
  day: [[247, 214, 196], [242, 176, 140], [236, 140, 96], [228, 106, 58], [210, 78, 30], [160, 50, 16]],
};

const waitColor = (m: number): Color => (m < 8 ? [30, 158, 90] : m <= 18 ? [232, 163, 23] : [194, 47, 61]);

let workerConfigured = false;

// Labels and pins always draw on top of the 3D columns instead of hiding behind them.
const ON_TOP = { depthCompare: 'always', depthWriteEnabled: false } as const;

export default function CityMap({
  theme = 'night',
  conditions,
  initialCamera,
  interactive = true,
  hexOpacity = 0.9,
  elevationScale = 1,
  showRestaurants = false,
  arc = null,
  onHexHover,
  onRestaurantClick,
  zones,
  selectedZoneId = null,
  onZoneClick,
  onReady,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [closeUp, setCloseUp] = useState(false);
  const handlers = useRef({ onHexHover, onRestaurantClick, onZoneClick, onReady });
  // Keep the latest callbacks without recreating the map or its layers.
  useEffect(() => { handlers.current = { onHexHover, onRestaurantClick, onZoneClick, onReady }; });

  // Map + deck overlay are created once; later prop changes only swap layers.
  useEffect(() => {
    if (!containerRef.current) return;
    if (!workerConfigured) {
      maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      workerConfigured = true;
    }
    const cam = initialCamera ?? { center: CITY_CENTER, zoom: 11, pitch: 55, bearing: -20 };
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[theme],
      center: cam.center,
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: cam.bearing,
      maxPitch: 75,
      interactive,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const onZoom = () => setCloseUp(map.getZoom() >= 13.2);
    map.on('zoomend', onZoom);
    map.on('load', () => {
      onZoom();
      tuneStyle(map, theme);
      handlers.current.onReady?.(map);
    });

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);
    overlayRef.current = overlay;

    return () => {
      overlayRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = useMemo(
    () => demandPoints(conditions),
    [conditions.hour, conditions.rain, conditions.match], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const layers: Layer[] = [
      new HexagonLayer<DemandPoint>({
        id: 'demand',
        data: points,
        getPosition: (d) => d.position,
        getElevationWeight: (d) => d.weight,
        getColorWeight: (d) => d.weight,
        elevationAggregation: 'SUM',
        colorAggregation: 'SUM',
        radius: 360,
        coverage: 0.84,
        extruded: true,
        elevationDomain: [0, 24],
        elevationRange: [0, 2600],
        colorDomain: [0, 20],
        elevationScale,
        colorRange: HEAT[theme],
        opacity: hexOpacity,
        visible: hexOpacity > 0.01,
        pickable: !!handlers.current.onHexHover,
        material: { ambient: 0.55, diffuse: 0.6, shininess: 48, specularColor: [255, 220, 200] },
        transitions: { elevationScale: { duration: 900 } },
        onHover: (info: PickingInfo) => {
          const obj = info.object as { elevationValue?: number } | undefined;
          handlers.current.onHexHover?.(obj ? { value: obj.elevationValue ?? 0, x: info.x, y: info.y } : null);
          return true;
        },
      }),
    ];

    if (showRestaurants) {
      const rain = conditions.rain ? 4 : 0;
      const data = RESTAURANTS.map((r) => ({ ...r, waitNow: r.avgWait + rain }));
      layers.push(
        new ScatterplotLayer({
          id: 'restaurants',
          parameters: ON_TOP,
          data,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: 70,
          radiusMinPixels: 5,
          radiusMaxPixels: 14,
          getFillColor: (d) => waitColor(d.waitNow),
          stroked: true,
          getLineColor: [255, 255, 255],
          lineWidthMinPixels: 2,
          pickable: true,
          onClick: (info) => info.object && handlers.current.onRestaurantClick?.(info.object as Restaurant),
          updateTriggers: { getFillColor: [rain] },
        }),
        new TextLayer({
          id: 'restaurant-labels',
          visible: closeUp,
          parameters: ON_TOP,
          data,
          getPosition: (d) => [d.lng, d.lat],
          getText: (d) => `${d.waitNow}m`,
          getSize: 12,
          getPixelOffset: [0, -18],
          fontFamily: 'Manrope, system-ui, sans-serif',
          fontWeight: 800,
          getColor: theme === 'night' ? [255, 255, 255] : [21, 23, 27],
          background: true,
          getBackgroundColor: theme === 'night' ? [17, 22, 34, 220] : [255, 255, 255, 235],
          backgroundPadding: [5, 2],
          getBorderColor: (d) => waitColor(d.waitNow),
          getBorderWidth: 1,
          updateTriggers: { getText: [rain], getBorderColor: [rain] },
        }),
      );
    }

    if (arc) {
      layers.push(
        new ArcLayer({
          id: 'route-arc',
          data: [arc],
          getSourcePosition: (d) => d.from,
          getTargetPosition: (d) => d.to,
          getSourceColor: [110, 224, 164],
          getTargetColor: [255, 122, 61],
          getWidth: 5,
          getHeight: 0.8,
        }),
        new ScatterplotLayer({
          id: 'route-ends',
          data: [arc.from, arc.to],
          getPosition: (d) => d,
          getRadius: 90,
          radiusMinPixels: 6,
          getFillColor: (_d, { index }) => (index === 0 ? [110, 224, 164] : [255, 122, 61]),
          stroked: true,
          getLineColor: [255, 255, 255],
          lineWidthMinPixels: 2,
        }),
      );
    }

    if (zones?.length) {
      const sel = selectedZoneId;
      layers.push(
        new ScatterplotLayer<ZoneState>({
          id: 'zone-dots',
          parameters: ON_TOP,
          data: zones,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: 60,
          radiusMinPixels: 5,
          getFillColor: (d) => (d.id === sel ? [21, 23, 27] : [255, 255, 255]),
          stroked: true,
          getLineColor: (d) => (d.id === sel ? [255, 255, 255] : [21, 23, 27]),
          lineWidthMinPixels: 2,
          updateTriggers: { getFillColor: [sel], getLineColor: [sel] },
        }),
        new TextLayer<ZoneState>({
          id: 'zone-pins',
          parameters: ON_TOP,
          data: zones,
          getPosition: (d) => [d.lng, d.lat],
          getText: (d) => `₹${d.rate}/hr`,
          getSize: (d) => (d.id === sel ? 15 : 13),
          getPixelOffset: [0, -24],
          fontFamily: 'Manrope, system-ui, sans-serif',
          fontWeight: 800,
          characterSet: 'auto',
          getColor: (d) => (d.id === sel ? [255, 255, 255] : [21, 23, 27]),
          background: true,
          getBackgroundColor: (d) => (d.id === sel ? [21, 23, 27, 255] : [255, 255, 255, 245]),
          backgroundBorderRadius: 9,
          backgroundPadding: [9, 6],
          getBorderColor: [21, 23, 27, 40],
          getBorderWidth: 1,
          pickable: true,
          onClick: (info) => info.object && handlers.current.onZoneClick?.((info.object as ZoneState).id),
          updateTriggers: { getText: [zones], getColor: [sel], getBackgroundColor: [sel], getSize: [sel] },
        }),
      );
    }

    overlay.setProps({ layers });
  }, [points, theme, hexOpacity, elevationScale, showRestaurants, arc, conditions.rain, zones, selectedZoneId, closeUp]);

  // MapLibre's CSS forces position: relative on its container, so size a wrapper instead.
  return (
    <div className={`isolate ${className ?? 'absolute inset-0'}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

// Recolour the base style and add real 3D buildings from OpenMapTiles.
function tuneStyle(map: maplibregl.Map, theme: CityMapTheme) {
  const style = map.getStyle();
  const firstSymbol = style.layers?.find((l) => l.type === 'symbol')?.id;
  const setPaint = (id: string, prop: string, value: unknown) => {
    if (map.getLayer(id)) (map.setPaintProperty as (l: string, p: string, v: unknown) => void).call(map, id, prop, value);
  };

  if (theme === 'night') {
    setPaint('background', 'background-color', '#090C12');
    setPaint('water', 'fill-color', '#0B1626');
    setPaint('landuse_park', 'fill-color', '#0E1A14');
    setPaint('landcover_wood', 'fill-color', '#0E1A14');
  }
  if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none');
  // Village and hamlet labels clutter the city view; keep suburbs and roads.
  for (const id of ['place_other', 'place_village', 'place_town']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }

  if (!map.getLayer('gb-buildings') && map.getSource('openmaptiles')) {
    map.addLayer(
      {
        id: 'gb-buildings',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 12.5,
        paint: {
          'fill-extrusion-color': theme === 'night' ? '#1B2232' : '#E4E5DD',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': theme === 'night' ? 0.92 : 0.85,
        },
      },
      firstSymbol,
    );
  }
}
