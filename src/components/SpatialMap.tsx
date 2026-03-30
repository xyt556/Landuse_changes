import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Map as MapIcon, Split, Info, ChevronRight, ChevronDown, Filter, Download } from 'lucide-react';
import { SpatialData } from './TransferMatrix';

interface SpatialMapProps {
  data: SpatialData;
}

// Predefined colors for common land use types
const CATEGORY_COLORS: Record<string, string> = {
  '耕地': '#E6E600',
  '林地': '#00A600',
  '草地': '#A6FF80',
  '水域': '#0070FF',
  '建设用地': '#FF0000',
  '未利用地': '#D3D3D3',
  'default': '#808080'
};

const getCategoryColor = (label?: string) => {
  if (!label) return CATEGORY_COLORS.default;
  for (const key in CATEGORY_COLORS) {
    if (label.includes(key)) return CATEGORY_COLORS[key];
  }
  return CATEGORY_COLORS.default;
};

// Canvas Overlay Component for Leaflet
function CanvasLayer({ 
  raster, 
  width, 
  height, 
  mapping, 
  colors,
  opacity = 1,
  clipX = null 
}: { 
  raster: any; 
  width: number; 
  height: number; 
  mapping: Record<number, string>;
  colors?: Record<number, string>;
  opacity?: number;
  clipX?: number | null;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create an offscreen canvas for the full raster
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const imageData = offCtx.createImageData(width, height);
    const data = imageData.data;

    // Cache colors
    const colorCache: Record<number, { r: number, g: number, b: number }> = {};
    Object.keys(mapping).forEach(val => {
      const v = parseInt(val);
      const hex = (colors && colors[v]) || getCategoryColor(mapping[v]);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      colorCache[v] = { r, g, b };
    });

    for (let i = 0; i < raster.length; i++) {
      const val = raster[i];
      const color = colorCache[val] || { r: 0, g: 0, b: 0 };
      const idx = i * 4;
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = val === 0 ? 0 : 255; // Assuming 0 is NoData
    }

    offCtx.putImageData(imageData, 0, 0);

    const render = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const scale = Math.min(size.x / width, size.y / height) * 0.8;
      const drawW = width * scale;
      const drawH = height * scale;
      const x = (size.x - drawW) / 2;
      const y = (size.y - drawH) / 2;

      ctx.globalAlpha = opacity;
      
      if (clipX !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, clipX, size.y);
        ctx.clip();
        ctx.drawImage(offscreen, x, y, drawW, drawH);
        ctx.restore();
      } else {
        ctx.drawImage(offscreen, x, y, drawW, drawH);
      }
    };

    map.on('move zoom viewreset', render);
    render();

    return () => {
      map.off('move zoom viewreset', render);
    };
  }, [raster, width, height, mapping, colors, map, opacity, clipX]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        pointerEvents: 'none',
        zIndex: 400 
      }} 
    />
  );
}

// Change Map Layer
function ChangeLayer({ 
  t1, t2, width, height, mapping, colors,
  filterFrom = null, 
  filterTo = null 
}: { 
  t1: any; t2: any; width: number; height: number; mapping: Record<number, string>;
  colors?: Record<number, string>;
  filterFrom?: number | null;
  filterTo?: number | null;
}) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const imageData = offCtx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < t1.length; i++) {
      const v1 = t1[i];
      const v2 = t2[i];
      const idx = i * 4;

      if (v1 === 0 || v2 === 0) {
        data[idx + 3] = 0;
        continue;
      }

      if (v1 === v2) {
        // No change - subtle gray
        data[idx] = 200;
        data[idx + 1] = 200;
        data[idx + 2] = 200;
        data[idx + 3] = 50;
      } else {
        // Change - highlight
        if ((filterFrom === null || v1 === filterFrom) && (filterTo === null || v2 === filterTo)) {
          // Highlight color based on the target category
          const hex = (colors && colors[v2]) || getCategoryColor(mapping[v2]);
          data[idx] = parseInt(hex.slice(1, 3), 16);
          data[idx + 1] = parseInt(hex.slice(3, 5), 16);
          data[idx + 2] = parseInt(hex.slice(5, 7), 16);
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }

    offCtx.putImageData(imageData, 0, 0);

    const render = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(size.x / width, size.y / height) * 0.8;
      const drawW = width * scale;
      const drawH = height * scale;
      const x = (size.x - drawW) / 2;
      const y = (size.y - drawH) / 2;
      ctx.drawImage(offscreen, x, y, drawW, drawH);
    };

    map.on('move zoom viewreset', render);
    render();
    return () => map.off('move zoom viewreset', render);
  }, [t1, t2, width, height, mapping, colors, map, filterFrom, filterTo]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        pointerEvents: 'none',
        zIndex: 400 
      }} 
    />
  );
}

// Zoom to extent component
function ZoomToExtent({ bbox }: { bbox?: number[] }) {
  const map = useMap();
  useEffect(() => {
    if (bbox && bbox.length === 4) {
      // bbox is [minX, minY, maxX, maxY]
      // Leaflet uses [[minLat, minLon], [maxLat, maxLon]]
      // For GeoTIFF, it's usually [minLon, minLat, maxLon, maxLat]
      const bounds = L.latLngBounds(
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]]
      );
      map.fitBounds(bounds);
    }
  }, [bbox, map]);
  return null;
}

export default function SpatialMap({ data }: SpatialMapProps) {
  const [viewMode, setViewMode] = useState<'t1' | 't2' | 'change' | 'swipe'>('change');
  const [swipePos, setSwipePos] = useState(50);
  const [filterFrom, setFilterFrom] = useState<number | null>(null);
  const [filterTo, setFilterTo] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const downloadChangeMap = () => {
    if (!data.t1 || !data.t2) return;

    const width = data.width;
    const height = data.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;

    // Cache colors
    const colorCache: Record<number, { r: number, g: number, b: number }> = {};
    Object.keys(data.mapping).forEach(val => {
      const v = parseInt(val);
      const hex = (data.colors && data.colors[v]) || getCategoryColor(data.mapping[v]);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      colorCache[v] = { r, g, b };
    });

    for (let i = 0; i < data.t1.length; i++) {
      const v1 = data.t1[i];
      const v2 = data.t2[i];
      const idx = i * 4;

      if (v1 === 0 || v2 === 0) {
        pixels[idx + 3] = 0;
        continue;
      }

      if (v1 === v2) {
        pixels[idx] = 200;
        pixels[idx + 1] = 200;
        pixels[idx + 2] = 200;
        pixels[idx + 3] = 50;
      } else {
        if ((filterFrom === null || v1 === filterFrom) && (filterTo === null || v2 === filterTo)) {
          const color = colorCache[v2] || { r: 0, g: 0, b: 0 };
          pixels[idx] = color.r;
          pixels[idx + 1] = color.g;
          pixels[idx + 2] = color.b;
          pixels[idx + 3] = 255;
        } else {
          pixels[idx + 3] = 0;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    
    const link = document.createElement('a');
    link.download = `land_use_change_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const categories = useMemo(() => {
    return Object.entries(data.mapping).map(([val, label]) => {
      const v = parseInt(val);
      return {
        value: v,
        label,
        color: (data.colors && data.colors[v]) || getCategoryColor(label)
      };
    });
  }, [data.mapping, data.colors]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">空间分布分析 (Spatial Analysis)</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('t1')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 't1' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              T1 影像
            </button>
            <button 
              onClick={() => setViewMode('t2')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 't2' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              T2 影像
            </button>
            <button 
              onClick={() => setViewMode('change')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'change' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              变化图
            </button>
            <button 
              onClick={() => setViewMode('swipe')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'swipe' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              卷帘对比
            </button>
          </div>

          <button 
            onClick={downloadChangeMap}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            title="下载当前视图为高清图片"
          >
            <Download className="w-4 h-4" />
            下载变化图
          </button>
        </div>
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        <MapContainer 
          center={[0, 0]} 
          zoom={2} 
          style={{ height: '100%', width: '100%', background: '#f8f9fa' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          
          <ZoomToExtent bbox={data.metadata?.bbox} />
          
          {viewMode === 't1' && (
            <CanvasLayer raster={data.t1} width={data.width} height={data.height} mapping={data.mapping} colors={data.colors} />
          )}
          {viewMode === 't2' && (
            <CanvasLayer raster={data.t2} width={data.width} height={data.height} mapping={data.mapping} colors={data.colors} />
          )}
          {viewMode === 'change' && (
            <ChangeLayer 
              t1={data.t1} 
              t2={data.t2} 
              width={data.width} 
              height={data.height} 
              mapping={data.mapping}
              colors={data.colors}
              filterFrom={filterFrom}
              filterTo={filterTo}
            />
          )}
          {viewMode === 'swipe' && (
            <>
              <CanvasLayer raster={data.t2} width={data.width} height={data.height} mapping={data.mapping} colors={data.colors} />
              <CanvasLayer 
                raster={data.t1} 
                width={data.width} 
                height={data.height} 
                mapping={data.mapping} 
                colors={data.colors}
                clipX={containerRef.current ? (containerRef.current.clientWidth * swipePos) / 100 : null}
              />
            </>
          )}
        </MapContainer>

        {/* Swipe Slider Overlay */}
        {viewMode === 'swipe' && (
          <div className="absolute inset-0 pointer-events-none z-[500] flex items-center">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={swipePos} 
              onChange={(e) => setSwipePos(parseInt(e.target.value))}
              className="w-full pointer-events-auto appearance-none bg-transparent cursor-ew-resize [&::-webkit-slider-thumb]:w-1 [&::-webkit-slider-thumb]:h-screen [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:appearance-none"
            />
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none" 
              style={{ left: `${swipePos}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-xl border border-gray-200">
                <Split className="w-4 h-4 text-blue-600" />
              </div>
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">T1 (Left)</div>
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">T2 (Right)</div>
            </div>
          </div>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 z-[500] bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-xl max-w-[240px]">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">图例 (Legend)</span>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
            {categories.map(cat => (
              <div key={cat.value} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-xs text-gray-600 truncate">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Change Filter Overlay */}
        {viewMode === 'change' && (
          <div className="absolute top-6 right-6 z-[500] bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-xl w-64">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">变化筛选 (Filter)</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">从 (From T1)</label>
                <select 
                  value={filterFrom === null ? '' : filterFrom} 
                  onChange={(e) => setFilterFrom(e.target.value === '' ? null : parseInt(e.target.value))}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                >
                  <option value="">全部类型</option>
                  {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">到 (To T2)</label>
                <select 
                  value={filterTo === null ? '' : filterTo} 
                  onChange={(e) => setFilterTo(e.target.value === '' ? null : parseInt(e.target.value))}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                >
                  <option value="">全部类型</option>
                  {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
              </div>
              {(filterFrom !== null || filterTo !== null) && (
                <button 
                  onClick={() => { setFilterFrom(null); setFilterTo(null); }}
                  className="w-full py-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  重置筛选
                </button>
              )}
            </div>
          </div>
        )}

        {/* Info Overlay */}
        <div className="absolute top-6 left-20 z-[500] bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2">
          <Info className="w-3 h-3 text-white/70" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">
            {viewMode === 't1' ? 'T1 初始状态' : viewMode === 't2' ? 'T2 末期状态' : viewMode === 'change' ? '变化空间分布' : '卷帘对比模式'}
          </span>
        </div>
      </div>
    </div>
  );
}
