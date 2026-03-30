import { useState, useMemo, useRef, useEffect, useId, ReactNode } from 'react';
import { Plus, Trash2, RefreshCw, Upload, X, Check, AlertCircle, FileType, Settings2, Download, FileText, Table as TableIcon, HelpCircle, Sparkles, Info, ChevronDown, FileJson, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fromArrayBuffer } from 'geotiff';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TransferMatrixProps {
  onDataChange: (nodes: any[], links: any[]) => void;
  onFullDataChange?: (matrix: number[][], categories: string[], colors: string[]) => void;
  onSpatialDataChange?: (data: SpatialData | null) => void;
  onShowGuide?: () => void;
}

export interface SpatialData {
  t1: any;
  t2: any;
  width: number;
  height: number;
  mapping: Record<number, string>;
  colors?: Record<number, string>;
  metadata?: {
    origin?: number[];
    resolution?: number[];
    bbox?: number[];
  };
}

const DEFAULT_CATEGORIES = ['耕地', '林地', '草地', '水域', '建设用地', '未利用地'];
const DEFAULT_MAPPING: Record<number, string> = {
  1: '耕地',
  2: '林地',
  3: '草地',
  4: '水域',
  5: '建设用地',
  6: '未利用地'
};

const DEFAULT_COLORS: Record<string, string> = {
  '耕地': '#E6E600',
  '林地': '#00A600',
  '草地': '#A6FF80',
  '水域': '#0070FF',
  '建设用地': '#FF0000',
  '未利用地': '#D3D3D3',
  'default': '#808080'
};

const getInitialColor = (label: string) => {
  if (label === '未分类' || label === '其他') return '#94A3B8';
  const colors: Record<string, string> = {
    '耕地': '#EAB308',
    '林地': '#22C55E',
    '草地': '#84CC16',
    '水域': '#3B82F6',
    '建筑': '#EF4444',
    '未利用': '#94A3B8',
    '建设用地': '#EF4444',
    '水体': '#3B82F6',
    '裸地': '#F59E0B',
    '湿地': '#06B6D4',
  };
  for (const key in colors) {
    if (label.includes(key)) return colors[key];
  }
  // Generate a deterministic random color based on label string
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return "#" + "000000".substring(0, 6 - c.length) + c;
};

const CLASSIFICATION_PRESETS: Record<string, { value: number; label: string; color: string }[]> = {
  'GLC30 (Global Land Cover)': [
    { value: 10, label: '耕地 (Cultivated)', color: '#FFFF00' },
    { value: 20, label: '林地 (Forest)', color: '#008000' },
    { value: 30, label: '草地 (Grassland)', color: '#ADFF2F' },
    { value: 40, label: '灌木 (Shrubland)', color: '#8B4513' },
    { value: 50, label: '湿地 (Wetland)', color: '#00FFFF' },
    { value: 60, label: '水体 (Water)', color: '#0000FF' },
    { value: 70, label: '苔原 (Tundra)', color: '#D2B48C' },
    { value: 80, label: '人造地表 (Artificial)', color: '#FF0000' },
    { value: 90, label: '裸地 (Bare land)', color: '#F4A460' },
    { value: 100, label: '冰雪 (Ice/Snow)', color: '#FFFFFF' },
  ],
  'ESA WorldCover (10m)': [
    { value: 10, label: '林地 (Tree cover)', color: '#006400' },
    { value: 20, label: '灌木 (Shrubland)', color: '#ffbb22' },
    { value: 30, label: '草地 (Grassland)', color: '#ffff4c' },
    { value: 40, label: '耕地 (Cropland)', color: '#f096ff' },
    { value: 50, label: '建筑 (Built-up)', color: '#fa0000' },
    { value: 60, label: '裸地 (Bare)', color: '#b4b4b4' },
    { value: 70, label: '冰雪 (Snow/Ice)', color: '#f0f0f0' },
    { value: 80, label: '水体 (Water)', color: '#0064ff' },
    { value: 90, label: '湿地 (Wetland)', color: '#0096a0' },
    { value: 95, label: '红树林 (Mangroves)', color: '#00cf75' },
    { value: 100, label: '苔藓 (Moss/Lichen)', color: '#fae6a0' },
  ],
  'FROM-GLC (10m)': [
    { value: 10, label: '耕地 (Cropland)', color: '#FFFF00' },
    { value: 20, label: '林地 (Forest)', color: '#008000' },
    { value: 30, label: '草地 (Grassland)', color: '#ADFF2F' },
    { value: 40, label: '灌木 (Shrubland)', color: '#8B4513' },
    { value: 50, label: '湿地 (Wetland)', color: '#00FFFF' },
    { value: 60, label: '水体 (Water)', color: '#0000FF' },
    { value: 70, label: '苔原 (Tundra)', color: '#D2B48C' },
    { value: 80, label: '人造地表 (Impervious)', color: '#FF0000' },
    { value: 90, label: '裸地 (Bareland)', color: '#F4A460' },
    { value: 100, label: '雪/冰 (Snow/Ice)', color: '#FFFFFF' },
  ]
};

export default function TransferMatrix({ onDataChange, onFullDataChange, onSpatialDataChange, onShowGuide }: TransferMatrixProps) {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryColors, setCategoryColors] = useState<string[]>(() => 
    DEFAULT_CATEGORIES.map(c => getInitialColor(c))
  );
  const [matrix, setMatrix] = useState<number[][]>(() => 
    Array(DEFAULT_CATEGORIES.length).fill(0).map(() => Array(DEFAULT_CATEGORIES.length).fill(0))
  );
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    title: '土地利用转移分析报告',
    author: '土地利用分析系统',
    organization: '',
    notes: '',
    includeMatrix: true,
    includeStats: true,
    includeCharts: true,
  });
  const reportRef = useRef<HTMLDivElement>(null);

  const ExportDropdown = ({ 
    label, 
    onExport, 
    icon: Icon, 
    className,
    formats = ['csv', 'json', 'excel']
  }: { 
    label: string, 
    onExport: (format: string) => void, 
    icon: any, 
    className?: string,
    formats?: string[]
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
            className
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
          <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
        </button>
        
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
            {formats.includes('csv') && (
              <button
                onClick={() => { onExport('csv'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <TableIcon className="w-4 h-4 text-emerald-500" />
                导出为 CSV
              </button>
            )}
            {formats.includes('json') && (
              <button
                onClick={() => { onExport('json'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileJson className="w-4 h-4 text-amber-500" />
                导出为 JSON
              </button>
            )}
            {formats.includes('excel') && (
              <button
                onClick={() => { onExport('excel'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                导出为 Excel
              </button>
            )}
            {formats.includes('pdf') && (
              <button
                onClick={() => { onExport('pdf'); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-red-500" />
                导出为 PDF 报告
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const AccessibleTooltip = ({ children, content }: { children: ReactNode, content: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    const id = useId();

    return (
      <div className="relative inline-block">
        <div
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          onFocus={() => setIsVisible(true)}
          onBlur={() => setIsVisible(false)}
          aria-describedby={isVisible ? id : undefined}
        >
          {children}
        </div>
        {isVisible && (
          <div
            id={id}
            role="tooltip"
            className="absolute z-[300] px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md shadow-sm -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap animate-in fade-in zoom-in duration-200"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>
    );
  };

  const ReportModal = () => {
    if (!isReportModalOpen) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">定制导出报告</h3>
            </div>
            <button onClick={() => setIsReportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">报告标题</label>
              <input
                value={reportConfig.title}
                onChange={(e) => setReportConfig({ ...reportConfig, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="输入报告标题..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">作者</label>
                <input
                  value={reportConfig.author}
                  onChange={(e) => setReportConfig({ ...reportConfig, author: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">机构/组织</label>
                <input
                  value={reportConfig.organization}
                  onChange={(e) => setReportConfig({ ...reportConfig, organization: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="可选..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">备注/说明</label>
              <textarea
                value={reportConfig.notes}
                onChange={(e) => setReportConfig({ ...reportConfig, notes: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none h-24 resize-none"
                placeholder="添加报告备注..."
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">包含内容</label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeMatrix}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeMatrix: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">转移矩阵</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeStats}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeStats: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">变化统计</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeCharts}
                    onChange={(e) => setReportConfig({ ...reportConfig, includeCharts: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">分析图表</span>
                </label>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 flex gap-3">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="flex-1 px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                exportReport('pdf');
                setIsReportModalOpen(false);
              }}
              className="flex-1 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              生成 PDF 报告
            </button>
          </div>
        </div>
      </div>
    );
  };
  const [importText, setImportText] = useState('');
  const [importType, setImportType] = useState<'matrix' | 'pairs' | 'triplets' | 'tif'>('matrix');
  
  // TIF Import State
  const [tifFiles, setTifFiles] = useState<{ t1?: File; t2?: File }>({});
  const [resolution, setResolution] = useState(30);
  const [unit, setUnit] = useState<'ha' | 'km2' | 'm2'>('ha');
  const [noDataValue, setNoDataValue] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mapping, setMapping] = useState<Record<number, string>>(DEFAULT_MAPPING);
  const [tempMapping, setTempMapping] = useState<{ value: number; label: string; color: string }[]>(
    Object.entries(DEFAULT_MAPPING).map(([v, l]) => ({ 
      value: parseInt(v), 
      label: l,
      color: getInitialColor(l)
    }))
  );
  const [detectedValues, setDetectedValues] = useState<number[]>([]);
  const [tifThumbnails, setTifThumbnails] = useState<{ t1?: string; t2?: string }>({});
  const [tifMetadata, setTifMetadata] = useState<{ 
    t1?: { width: number; height: number; error?: string; loading?: boolean }; 
    t2?: { width: number; height: number; error?: string; loading?: boolean } 
  }>({});
  const [tifStats, setTifStats] = useState<{ t1?: Record<number, number>; t2?: Record<number, number> }>({});

  const [exportDropdownOpen, setExportDropdownOpen] = useState<string | null>(null);

  const readTifData = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const tiff = await fromArrayBuffer(buffer);
      const image = await tiff.getImage();
      const raster = await image.readRasters();
      
      if (!raster || raster.length === 0) {
        throw new Error('无法读取影像数据（像元数据为空）');
      }

      return {
        raster: raster[0] as any,
        width: image.getWidth(),
        height: image.getHeight(),
        origin: image.getOrigin(),
        resolution: image.getResolution(),
        bbox: image.getBoundingBox()
      };
    } catch (err: any) {
      console.error('TIF Read Error:', err);
      throw new Error(err.message || '影像读取失败，请确保文件是有效的 GeoTIFF 格式');
    }
  };

  const generateThumbnail = (raster: any, width: number, height: number) => {
    const maxDim = 160;
    const scale = Math.min(maxDim / width, maxDim / height);
    const thumbW = Math.floor(width * scale);
    const thumbH = Math.floor(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = thumbW;
    canvas.height = thumbH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.createImageData(thumbW, thumbH);
    const data = imageData.data;

    const colorCache: Record<number, { r: number, g: number, b: number }> = {};
    
    for (let y = 0; y < thumbH; y++) {
      for (let x = 0; x < thumbW; x++) {
        const sourceX = Math.floor(x / scale);
        const sourceY = Math.floor(y / scale);
        const val = raster[sourceY * width + sourceX];
        
        if (val === noDataValue) {
          const idx = (y * thumbW + x) * 4;
          data[idx + 3] = 0;
          continue;
        }

        if (!colorCache[val]) {
          const hex = getInitialColor(`类别 ${val}`);
          colorCache[val] = {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
          };
        }

        const color = colorCache[val];
        const idx = (y * thumbW + x) * 4;
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  };

  useEffect(() => {
    const updateThumbnails = async () => {
      const newThumbs: { t1?: string; t2?: string } = { ...tifThumbnails };
      const newMetadata: { t1?: any; t2?: any } = { ...tifMetadata };
      let changed = false;

      if (tifFiles.t1 && (!tifMetadata.t1 || !tifMetadata.t1.width)) {
        try {
          newMetadata.t1 = { ...newMetadata.t1, loading: true, error: undefined };
          setTifMetadata({ ...newMetadata });
          
          const data = await readTifData(tifFiles.t1);
          newThumbs.t1 = generateThumbnail(data.raster, data.width, data.height) || undefined;
          newMetadata.t1 = { width: data.width, height: data.height, loading: false };
          changed = true;
        } catch (e: any) { 
          console.error(e); 
          newMetadata.t1 = { ...newMetadata.t1, loading: false, error: e.message };
          changed = true;
        }
      } else if (!tifFiles.t1 && tifMetadata.t1) {
        newThumbs.t1 = undefined;
        newMetadata.t1 = undefined;
        changed = true;
      }

      if (tifFiles.t2 && (!tifMetadata.t2 || !tifMetadata.t2.width)) {
        try {
          newMetadata.t2 = { ...newMetadata.t2, loading: true, error: undefined };
          setTifMetadata({ ...newMetadata });

          const data = await readTifData(tifFiles.t2);
          newThumbs.t2 = generateThumbnail(data.raster, data.width, data.height) || undefined;
          newMetadata.t2 = { width: data.width, height: data.height, loading: false };
          changed = true;
        } catch (e: any) { 
          console.error(e); 
          newMetadata.t2 = { ...newMetadata.t2, loading: false, error: e.message };
          changed = true;
        }
      } else if (!tifFiles.t2 && tifMetadata.t2) {
        newThumbs.t2 = undefined;
        newMetadata.t2 = undefined;
        changed = true;
      }

      if (changed) {
        setTifThumbnails(newThumbs);
        setTifMetadata(newMetadata);
      }
    };
    updateThumbnails();
  }, [tifFiles]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetTifSelection = () => {
    setTifFiles({});
    setTifThumbnails({});
    setTifStats({});
    setTifMetadata({});
    setDetectedValues([]);
  };

  const updateSankey = (cats: string[], mat: number[][], colors?: string[]) => {
    const nodeColors = colors || categoryColors;
    
    const nodes = [
      ...cats.map((c, i) => ({ 
        name: `${c} (T1)`, 
        category: c, 
        time: 'T1',
        color: nodeColors[i]
      })),
      ...cats.map((c, i) => ({ 
        name: `${c} (T2)`, 
        category: c, 
        time: 'T2',
        color: nodeColors[i]
      })),
    ];
    const links: any[] = [];
    mat.forEach((row, i) => {
      if (i >= cats.length) return;
      row.forEach((val, j) => {
        if (j >= cats.length) return;
        if (val > 0) {
          links.push({
            source: i,
            target: j + cats.length,
            value: val,
            color: nodes[i].color // Link color matches source node
          });
        }
      });
    });
    onDataChange(nodes, links);
    if (onFullDataChange) {
      onFullDataChange(mat, cats, nodeColors);
    }
  };

  const handleImport = async () => {
    if (importType === 'tif') {
      await handleTifImport();
      return;
    }

    try {
      const lines = importText.trim().split('\n').map(l => l.split(/[\t,]/).map(s => s.trim()));
      
      if (importType === 'matrix') {
        // Assume first row/col might be headers or just numbers
        const hasHeader = isNaN(parseFloat(lines[0][1]));
        let newCats: string[] = [];
        let rawMat: number[][] = [];

        if (hasHeader) {
          newCats = lines[0].slice(1);
          rawMat = lines.slice(1).map(row => row.slice(1).map(v => parseFloat(v) || 0));
        } else {
          newCats = Array(lines[0].length).fill(0).map((_, i) => `类别 ${i + 1}`);
          rawMat = lines.map(row => row.map(v => parseFloat(v) || 0));
        }
        
        // Ensure matrix is square and matches categories length
        const newMat = Array(newCats.length).fill(0).map((_, i) => 
          Array(newCats.length).fill(0).map((_, j) => (rawMat[i]?.[j] || 0))
        );

        setCategories(newCats);
        setMatrix(newMat);
        updateSankey(newCats, newMat);
      } 
      else if (importType === 'pairs') {
        // Two columns: T1_Category, T2_Category
        const counts: Record<string, Record<string, number>> = {};
        const catSet = new Set<string>();
        
        lines.forEach(row => {
          if (row.length < 2) return;
          const [t1, t2] = row;
          catSet.add(t1);
          catSet.add(t2);
          if (!counts[t1]) counts[t1] = {};
          counts[t1][t2] = (counts[t1][t2] || 0) + 1;
        });

        const newCats = Array.from(catSet).sort();
        const newMat = newCats.map(r => newCats.map(c => counts[r]?.[c] || 0));
        
        setCategories(newCats);
        setMatrix(newMat);
        updateSankey(newCats, newMat);
      }
      else if (importType === 'triplets') {
        // Three columns: T1_Category, T2_Category, Area
        const counts: Record<string, Record<string, number>> = {};
        const catSet = new Set<string>();
        
        lines.forEach(row => {
          if (row.length < 3) return;
          const [t1, t2, val] = row;
          const area = parseFloat(val) || 0;
          catSet.add(t1);
          catSet.add(t2);
          if (!counts[t1]) counts[t1] = {};
          counts[t1][t2] = (counts[t1][t2] || 0) + area;
        });

        const newCats = Array.from(catSet).sort();
        const newMat = newCats.map(r => newCats.map(c => counts[r]?.[c] || 0));
        
        setCategories(newCats);
        setMatrix(newMat);
        updateSankey(newCats, newMat);
      }

      setIsImportOpen(false);
      setImportText('');
    } catch (err) {
      alert('数据解析失败，请检查格式是否正确（支持制表符或逗号分隔）');
    }
  };

  const handleTifImport = async () => {
    if (!tifFiles.t1 || !tifFiles.t2) {
      alert('请选择两期 TIF 影像文件');
      return;
    }

    setIsProcessing(true);
    try {
      const t1Data = await readTifData(tifFiles.t1);
      const t2Data = await readTifData(tifFiles.t2);

      const t1Array = t1Data.raster;
      const t2Array = t2Data.raster;

      if (t1Array.length !== t2Array.length) {
        throw new Error(`两期影像像素数量不一致 (T1: ${t1Data.width}x${t1Data.height}, T2: ${t2Data.width}x${t2Data.height})，请确保范围和分辨率完全相同`);
      }

      const counts: Record<number, Record<number, number>> = {};
      const pixelValues = new Set<number>();

      for (let i = 0; i < t1Array.length; i++) {
        const v1 = t1Array[i];
        const v2 = t2Array[i];
        
        // Skip user-specified NoData value
        if (v1 === noDataValue || v2 === noDataValue) continue;

        pixelValues.add(v1);
        pixelValues.add(v2);

        if (!counts[v1]) counts[v1] = {};
        counts[v1][v2] = (counts[v1][v2] || 0) + 1;
      }

      const sortedValues = Array.from(pixelValues).sort((a, b) => a - b);
      
      // Use current tempMapping for the final mapping
      const finalMapping: Record<number, string> = {};
      const finalMappingWithColor: Record<number, { label: string, color: string }> = {};
      tempMapping.forEach(m => {
        finalMapping[m.value] = m.label;
        finalMappingWithColor[m.value] = { label: m.label, color: m.color };
      });
      setMapping(finalMapping);

      // Convert counts to Area based on selected unit
      // Area = (Count * Res * Res) / factor
      const unitFactor = unit === 'ha' ? 10000 : unit === 'km2' ? 1000000 : 1;
      const factor = (resolution * resolution) / unitFactor;
      
      const newCats: string[] = Array.from(new Set(tempMapping.map(m => m.label)));
      const catToIndex = Object.fromEntries(newCats.map((c, i) => [c, i]));
      
      const newMat = Array(newCats.length).fill(0).map(() => Array(newCats.length).fill(0));
      
      Object.entries(counts).forEach(([v1Str, targets]) => {
        const v1 = parseInt(v1Str);
        const cat1 = finalMapping[v1];
        if (cat1 === undefined) return;
        const i = catToIndex[cat1];
        
        Object.entries(targets).forEach(([v2Str, count]) => {
          const v2 = parseInt(v2Str);
          const cat2 = finalMapping[v2];
          if (cat2 === undefined) return;
          const j = catToIndex[cat2];
          
          newMat[i][j] += count * factor;
        });
      });

      const newColors: string[] = newCats.map(c => {
        const m = tempMapping.find(item => item.label === c);
        return m ? m.color : getInitialColor(c);
      });

      setCategories(newCats);
      setCategoryColors(newColors);
      setMatrix(newMat);
      updateSankey(newCats, newMat, newColors);

      // Emit spatial data
      if (onSpatialDataChange) {
        onSpatialDataChange({
          t1: t1Array,
          t2: t2Array,
          width: t1Data.width,
          height: t1Data.height,
          mapping: finalMapping,
          colors: Object.fromEntries(tempMapping.map(m => [m.value, m.color])),
          metadata: {
            origin: t1Data.origin,
            resolution: t1Data.resolution,
            bbox: t1Data.bbox
          }
        });
      }

      setIsImportOpen(false);
    } catch (err: any) {
      alert(`TIF 处理失败: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const scanTifValues = async () => {
    if (!tifFiles.t1 || !tifFiles.t2) return;
    setIsProcessing(true);
    try {
      const t1Data = await readTifData(tifFiles.t1);
      const t2Data = await readTifData(tifFiles.t2);
      const t1Array = t1Data.raster;
      const t2Array = t2Data.raster;
      
      const t1Freq: Record<number, number> = {};
      const t2Freq: Record<number, number> = {};
      const values = new Set<number>();
      
      for (let i = 0; i < t1Array.length; i++) {
        const v1 = t1Array[i];
        const v2 = t2Array[i];
        if (v1 !== noDataValue) {
          values.add(v1);
          t1Freq[v1] = (t1Freq[v1] || 0) + 1;
        }
        if (v2 !== noDataValue) {
          values.add(v2);
          t2Freq[v2] = (t2Freq[v2] || 0) + 1;
        }
      }
      
      const sorted = Array.from(values).sort((a, b) => a - b);
      setDetectedValues(sorted);
      setTifStats({ t1: t1Freq, t2: t2Freq });
      
      // Generate thumbnails
      const thumb1 = generateThumbnail(t1Array, t1Data.width, t1Data.height);
      const thumb2 = generateThumbnail(t2Array, t2Data.width, t2Data.height);
      setTifThumbnails({ t1: thumb1 || undefined, t2: thumb2 || undefined });
      
      // Clear existing mapping and add detected values with smart suggestions
      const newTemp = sorted.map(v => {
        // Try to find match in any preset
        for (const preset of Object.values(CLASSIFICATION_PRESETS)) {
          const match = preset.find(p => p.value === v);
          if (match) return { value: v, label: match.label, color: match.color };
        }
        return { 
          value: v, 
          label: `类别 ${v}`,
          color: getInitialColor(`类别 ${v}`)
        };
      });
      setTempMapping(newTemp);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToCSV = (data: any[][], filename: string) => {
    const csvContent = data.map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const exportToJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const exportToExcel = (data: any[][], filename: string) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename);
  };

  const exportMatrix = (format: 'csv' | 'json' | 'excel' = 'csv') => {
    const unitLabel = unit === 'ha' ? 'ha' : unit === 'km2' ? 'km²' : 'm²';
    const header = [`T1 \\ T2 (${unitLabel})`, ...categories, `T1 总计 (${unitLabel})` ];
    const rows = matrix.map((row, i) => [
      categories[i] || `类别 ${i + 1}`,
      ...row.map(v => (v || 0).toFixed(2)),
      row.reduce((a, b) => a + b, 0).toFixed(2)
    ]);
    const footer = [
      `T2 总计 (${unitLabel})`,
      ...categories.map((_, j) => matrix.reduce((sum, r) => sum + (r[j] || 0), 0).toFixed(2)),
      matrix.flat().reduce((a, b) => a + b, 0).toFixed(2)
    ];

    const allData = [header, ...rows, footer];

    if (format === 'csv') exportToCSV(allData, 'transfer-matrix.csv');
    else if (format === 'excel') exportToExcel(allData, 'transfer-matrix.xlsx');
    else if (format === 'json') {
      const jsonData = {
        unit: unitLabel,
        categories,
        matrix,
        rowTotals: matrix.map(r => r.reduce((a, b) => a + b, 0)),
        colTotals: categories.map((_, j) => matrix.reduce((sum, r) => sum + (r[j] || 0), 0)),
        grandTotal: matrix.flat().reduce((a, b) => a + b, 0)
      };
      exportToJSON(jsonData, 'transfer-matrix.json');
    }
    setExportDropdownOpen(null);
  };

  const exportStats = (format: 'csv' | 'json' | 'excel' = 'csv') => {
    const unitLabel = unit === 'ha' ? 'ha' : unit === 'km2' ? 'km²' : 'm²';
    const header = ['类别', `T1 面积 (${unitLabel})`, `T2 面积 (${unitLabel})`, `未变化 (${unitLabel})`, `转出 (Loss) (${unitLabel})`, `转入 (Gain) (${unitLabel})`, `净变化 (Net) (${unitLabel})`, `交换变化 (Swap) (${unitLabel})` ];
    const rows = stats.map(s => [
      s.name,
      s.t1.toFixed(2),
      s.t2.toFixed(2),
      s.unchanged.toFixed(2),
      s.loss.toFixed(2),
      s.gain.toFixed(2),
      s.net.toFixed(2),
      s.swap.toFixed(2)
    ]);

    if (format === 'csv') exportToCSV([header, ...rows], 'change-statistics.csv');
    else if (format === 'excel') exportToExcel([header, ...rows], 'change-statistics.xlsx');
    else if (format === 'json') exportToJSON(stats, 'change-statistics.json');
    setExportDropdownOpen(null);
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('land-use-report.pdf');
    setExportDropdownOpen(null);
  };

  const exportReport = (format: 'csv' | 'pdf' = 'csv') => {
    if (format === 'pdf') {
      exportToPDF();
      return;
    }

    const unitLabel = unit === 'ha' ? 'ha' : unit === 'km2' ? 'km²' : 'm²';
    const totalArea = matrix.flat().reduce((a, b) => a + b, 0);
    const report = [
      [reportConfig.title],
      ['生成时间', new Date().toLocaleString()],
      ['作者', reportConfig.author || '未指定'],
      ['机构', reportConfig.organization || '未指定'],
      [''],
      [`总面积 (${unitLabel})`, totalArea.toFixed(2)],
      [''],
      [`1. 转移矩阵 (${unitLabel})`],
      ['T1 \\ T2', ...categories],
      ...matrix.map((row, i) => [categories[i], ...row.map(v => v.toFixed(2))]),
      [''],
      [`2. 变化特征统计 (${unitLabel})`],
      ['类别', 'T1 面积', 'T2 面积', '净变化', '交换变化'],
      ...stats.map(s => [s.name, s.t1.toFixed(2), s.t2.toFixed(2), s.net.toFixed(2), s.swap.toFixed(2)]),
      [''],
      ['3. 结论摘要'],
      [`分析显示，研究区内总面积为 ${totalArea.toFixed(2)} ${unitLabel}。`],
      [`净增加最多的类型是: ${[...stats].sort((a, b) => b.net - a.net)[0]?.name || 'N/A'}`],
      [`净减少最多的类型是: ${[...stats].sort((a, b) => a.net - b.net)[0]?.name || 'N/A'}`],
      [''],
      ['4. 备注'],
      [reportConfig.notes]
    ];
    exportToCSV(report, 'analysis-report.csv');
    setExportDropdownOpen(null);
  };


  const loadSampleData = () => {
    const sample = [
      [4500, 200, 150, 50, 300, 100],
      [100, 3800, 100, 20, 50, 30],
      [200, 150, 2900, 30, 120, 100],
      [40, 10, 20, 1200, 80, 20],
      [10, 5, 5, 10, 2100, 0],
      [50, 20, 80, 10, 40, 800],
    ];
    setMatrix(sample);
    updateSankey(categories, sample);
  };

  const handleCellChange = (r: number, c: number, val: string) => {
    const num = parseFloat(val) || 0;
    const newMatrix = [...matrix.map(row => [...row])];
    newMatrix[r][c] = num;
    setMatrix(newMatrix);
    updateSankey(categories, newMatrix);
  };

  const handleColorChange = (index: number, color: string) => {
    const newColors = [...categoryColors];
    newColors[index] = color;
    setCategoryColors(newColors);
    updateSankey(categories, matrix, newColors);
  };

  const addCategory = () => {
    const newName = `新类别 ${categories.length + 1}`;
    const newCats = [...categories, newName];
    const newColors = [...categoryColors, getInitialColor(newName)];
    const newMatrix = [...matrix.map(row => [...row, 0]), Array(newCats.length).fill(0)];
    setCategories(newCats);
    setCategoryColors(newColors);
    setMatrix(newMatrix);
    updateSankey(newCats, newMatrix, newColors);
  };

  const removeCategory = (index: number) => {
    if (categories.length <= 2) return;
    const newCats = categories.filter((_, i) => i !== index);
    const newColors = categoryColors.filter((_, i) => i !== index);
    const newMatrix = matrix
      .filter((_, i) => i !== index)
      .map(row => row.filter((_, j) => j !== index));
    setCategories(newCats);
    setCategoryColors(newColors);
    setMatrix(newMatrix);
    updateSankey(newCats, newMatrix, newColors);
  };

  const handleCategoryRename = (index: number, name: string) => {
    const newCats = [...categories];
    newCats[index] = name;
    setCategories(newCats);
    updateSankey(newCats, matrix, categoryColors);
  };

  const stats = useMemo(() => {
    const rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));
    const colSums = categories.map((_, j) => matrix.reduce((sum, row) => sum + (row[j] || 0), 0));
    
    return categories.map((name, i) => {
      const t1 = rowSums[i] || 0;
      const t2 = colSums[i] || 0;
      const unchanged = (matrix[i] && matrix[i][i]) || 0;
      const loss = t1 - unchanged;
      const gain = t2 - unchanged;
      const net = t2 - t1;
      const swap = 2 * Math.min(loss, gain);
      
      return { name, t1, t2, unchanged, loss, gain, net, swap };
    });
  }, [matrix, categories]);

  const renderTifChart = (stats?: Record<number, number>, title?: string) => {
    if (!stats || Object.keys(stats).length === 0) return null;
    const data = Object.entries(stats).map(([val, count]) => ({
      value: parseInt(val),
      count: count,
      label: tempMapping.find(m => m.value === parseInt(val))?.label || `值 ${val}`
    })).sort((a, b) => a.value - b.value);

    return (
      <div className="h-32 w-full mt-3 bg-white/50 rounded-xl p-2 border border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
          <TableIcon className="w-3 h-3" />
          {title} 像元分布
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="value" hide />
            <YAxis hide />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  const mapItem = tempMapping.find(m => m.value === item.value);
                  return (
                    <div className="bg-white p-2 border border-gray-100 shadow-xl rounded-lg text-[10px] z-50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mapItem?.color || '#8B5CF6' }} />
                        <p className="font-bold text-gray-900">{item.label} (值: {item.value})</p>
                      </div>
                      <p className="text-purple-600 font-mono">频率: {item.count.toLocaleString()}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => {
                const mapItem = tempMapping.find(m => m.value === entry.value);
                return <Cell key={`cell-${index}`} fill={mapItem?.color || "#8B5CF6"} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Matrix Input */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">土地利用转移矩阵 (Area Matrix)</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
                Unit: {unit === 'ha' ? 'ha' : unit === 'km2' ? 'km²' : 'm²'}
              </span>
            </div>
            <p className="text-sm text-gray-500">行: T1 (初始) | 列: T2 (末期)</p>
          </div>
          <div className="flex gap-2">
            <AccessibleTooltip content="生成包含矩阵、统计表和图表的 PDF 报告">
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <FileText className="w-4 h-4" />
                导出报告
              </button>
            </AccessibleTooltip>
            <ExportDropdown
              label="导出矩阵"
              onExport={exportMatrix}
              icon={TableIcon}
              className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
            />
            <AccessibleTooltip content="支持 CSV 批量导入或 GeoTIFF 影像分析">
              <button
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <Upload className="w-4 h-4" />
                批量导入 / TIF
              </button>
            </AccessibleTooltip>
            <button
              onClick={loadSampleData}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              加载示例
            </button>
            <button
              onClick={addCategory}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加类别
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 border-b border-r border-gray-200 font-medium text-gray-400 w-32">T1 \ T2</th>
                {categories.map((cat, i) => (
                  <th key={i} className="p-3 border-b border-gray-200 min-w-[120px]">
                    <div className="flex items-center gap-2 group">
                      <input
                        type="color"
                        value={categoryColors[i]}
                        onChange={(e) => handleColorChange(i, e.target.value)}
                        className="w-4 h-4 rounded-full border-none p-0 cursor-pointer overflow-hidden flex-shrink-0"
                        title="点击修改颜色"
                      />
                      <input
                        value={cat}
                        onChange={(e) => handleCategoryRename(i, e.target.value)}
                        className="bg-transparent border-none focus:ring-0 font-medium text-gray-700 w-full"
                      />
                      <button
                        onClick={() => removeCategory(i)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="p-3 border-b border-l border-gray-200 bg-gray-100/50 font-bold text-gray-900">T1 总计</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, r) => (
                <tr key={r} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-3 border-r border-gray-200 bg-gray-50 font-medium text-gray-700">
                    {categories[r]}
                  </td>
                  {row.map((val, c) => (
                    <td key={c} className={cn(
                      "p-1 border border-gray-100",
                      r === c ? "bg-blue-50/30" : "bg-white"
                    )}>
                      <input
                        type="number"
                        value={val ? Number(val.toFixed(2)) : ''}
                        onChange={(e) => handleCellChange(r, c, e.target.value)}
                        className="w-full p-2 bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded text-right"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  <td className="p-3 border-l border-gray-200 bg-gray-100/30 font-bold text-right text-gray-900">
                    {Number(row.reduce((a, b) => a + b, 0).toFixed(2)).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100/50 font-bold">
                <td className="p-3 border-r border-gray-200">T2 总计</td>
                {categories.map((_, j) => (
                  <td key={j} className="p-3 text-right text-gray-900">
                    {Number(matrix.reduce((sum, row) => sum + row[j], 0).toFixed(2)).toLocaleString()}
                  </td>
                ))}
                <td className="p-3 border-l border-gray-200 bg-gray-200/50 text-right text-blue-600">
                  {Number(matrix.flat().reduce((a, b) => a + b, 0).toFixed(2)).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">转移特征分析 (Change Analysis)</h2>
            <p className="text-sm text-gray-500">
              计算土地利用类型的增减、净变化及交换变化 (单位: {unit === 'ha' ? 'ha' : unit === 'km2' ? 'km²' : 'm²'})
            </p>
          </div>
          <ExportDropdown
            label="导出统计表"
            onExport={exportStats}
            icon={Download}
            className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="p-4 border-b border-gray-200">类别</th>
                <th className="p-4 border-b border-gray-200 text-right">T1 面积</th>
                <th className="p-4 border-b border-gray-200 text-right">T2 面积</th>
                <th className="p-4 border-b border-gray-200 text-right">未变化</th>
                <th className="p-4 border-b border-gray-200 text-right text-red-600">转出 (Loss)</th>
                <th className="p-4 border-b border-gray-200 text-right text-green-600">转入 (Gain)</th>
                <th className="p-4 border-b border-gray-200 text-right">净变化 (Net)</th>
                <th className="p-4 border-b border-gray-200 text-right">交换变化 (Swap)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{s.name}</td>
                  <td className="p-4 text-right text-gray-600 font-mono">{Number(s.t1.toFixed(2)).toLocaleString()}</td>
                  <td className="p-4 text-right text-gray-600 font-mono">{Number(s.t2.toFixed(2)).toLocaleString()}</td>
                  <td className="p-4 text-right text-gray-400 font-mono">{Number(s.unchanged.toFixed(2)).toLocaleString()}</td>
                  <td className="p-4 text-right text-red-500 font-mono">-{Number(s.loss.toFixed(2)).toLocaleString()}</td>
                  <td className="p-4 text-right text-green-500 font-mono">+{Number(s.gain.toFixed(2)).toLocaleString()}</td>
                  <td className={cn(
                    "p-4 text-right font-bold font-mono",
                    s.net > 0 ? "text-green-600" : s.net < 0 ? "text-red-600" : "text-gray-400"
                  )}>
                    {s.net > 0 ? '+' : ''}{Number(s.net.toFixed(2)).toLocaleString()}
                  </td>
                  <td className="p-4 text-right text-gray-500 font-mono">{Number(s.swap.toFixed(2)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ReportModal />

      {/* Hidden Report Content for PDF Generation */}
      <div className="fixed left-[-9999px] top-[-9999px]">
        <div 
          ref={reportRef} 
          className="w-[800px] p-12 bg-white text-gray-900 font-sans"
        >
          <div className="border-b-4 border-blue-600 pb-6 mb-8">
            <h1 className="text-4xl font-black mb-2">{reportConfig.title}</h1>
            <div className="flex justify-between items-end text-sm text-gray-500">
              <div>
                <p>作者: <span className="font-bold text-gray-700">{reportConfig.author}</span></p>
                {reportConfig.organization && <p>机构: <span className="font-bold text-gray-700">{reportConfig.organization}</span></p>}
              </div>
              <p>生成日期: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {reportConfig.notes && (
            <div className="mb-8 p-4 bg-gray-50 rounded-xl border-l-4 border-gray-300 italic text-gray-600">
              {reportConfig.notes}
            </div>
          )}

          {reportConfig.includeMatrix && (
            <div className="mb-10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-600 rounded-full" />
                土地利用转移矩阵
              </h2>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 border-b border-r border-gray-200 text-left">T1 \ T2</th>
                      {categories.map((cat, i) => (
                        <th key={i} className="p-2 border-b border-gray-200 text-right">{cat}</th>
                      ))}
                      <th className="p-2 border-b border-l border-gray-200 text-right font-bold">总计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, r) => (
                      <tr key={r}>
                        <td className="p-2 border-r border-gray-200 bg-gray-50 font-medium">{categories[r]}</td>
                        {row.map((val, c) => (
                          <td key={c} className="p-2 border-b border-gray-100 text-right">{val.toLocaleString()}</td>
                        ))}
                        <td className="p-2 border-l border-gray-200 bg-gray-50 font-bold text-right">{row.reduce((a, b) => a + b, 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportConfig.includeStats && (
            <div className="mb-10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-2 h-6 bg-green-600 rounded-full" />
                转移特征统计
              </h2>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 border-b border-gray-200 text-left">类别</th>
                      <th className="p-2 border-b border-gray-200 text-right">T1 面积</th>
                      <th className="p-2 border-b border-gray-200 text-right">T2 面积</th>
                      <th className="p-2 border-b border-gray-200 text-right">净变化</th>
                      <th className="p-2 border-b border-gray-200 text-right">交换变化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="p-2 font-medium">{s.name}</td>
                        <td className="p-2 text-right">{s.t1.toLocaleString()}</td>
                        <td className="p-2 text-right">{s.t2.toLocaleString()}</td>
                        <td className={cn("p-2 text-right font-bold", s.net > 0 ? "text-green-600" : "text-red-600")}>
                          {s.net > 0 ? '+' : ''}{s.net.toLocaleString()}
                        </td>
                        <td className="p-2 text-right">{s.swap.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportConfig.includeCharts && (
            <div className="mb-10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-2 h-6 bg-amber-600 rounded-full" />
                变化趋势分析图
              </h2>
              <div className="h-[300px] w-full border border-gray-100 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats}>
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="net" name="净变化">
                      {stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.net > 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mt-12 pt-6 border-t border-gray-100 text-[10px] text-gray-400 text-center">
            报告由土地利用转移分析系统自动生成 • © {new Date().getFullYear()}
          </div>
        </div>
      </div>
      {isImportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 p-2 rounded-lg">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">批量导入数据</h3>
              </div>
              <button onClick={() => setIsImportOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-8 space-y-6">
                <div className="flex p-1 bg-gray-100 rounded-xl overflow-x-auto">
                {[
                  { id: 'matrix', label: '粘贴矩阵', icon: RefreshCw },
                  { id: 'pairs', label: '粘贴配对', icon: Plus },
                  { id: 'triplets', label: '粘贴三元组', icon: Check },
                  { id: 'tif', label: '遥感 TIF', icon: FileType }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setImportType(t.id as any)}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                      importType === t.id 
                        ? "bg-white text-purple-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {importType === 'tif' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-gray-700">影像文件选择</h4>
                    {(tifFiles.t1 || tifFiles.t2) && (
                      <button 
                        onClick={resetTifSelection}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        重置选择
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">初期影像 (T1 TIF)</label>
                      <div className="relative group">
                        <input
                          type="file"
                          accept=".tif,.tiff"
                          onChange={(e) => {
                            setTifFiles(prev => ({ ...prev, t1: e.target.files?.[0] }));
                            setTifStats(prev => ({ ...prev, t1: undefined }));
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={cn(
                          "p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden",
                          tifFiles.t1 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200 group-hover:border-purple-300"
                        )}>
                          {tifThumbnails.t1 ? (
                            <img src={tifThumbnails.t1} className="absolute inset-0 w-full h-full object-contain opacity-40" alt="T1 Preview" />
                          ) : (
                            <FileType className={cn("w-8 h-8", tifFiles.t1 ? "text-green-500" : "text-gray-300")} />
                          )}
                          <p className="text-xs font-medium text-gray-600 truncate max-w-full px-2 relative z-10 bg-white/60 backdrop-blur-sm rounded px-1">
                            {tifFiles.t1 ? tifFiles.t1.name : "点击或拖拽上传"}
                          </p>
                        </div>
                      </div>
                      {tifFiles.t1 && (
                        <div className="mt-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <span>尺寸: {tifMetadata.t1?.loading ? "读取中..." : tifMetadata.t1?.width ? `${tifMetadata.t1.width} x ${tifMetadata.t1.height}` : "未知"}</span>
                            <span>大小: {formatFileSize(tifFiles.t1.size)}</span>
                          </div>
                          {tifMetadata.t1?.error && (
                            <div className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span className="truncate">{tifMetadata.t1.error}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {tifStats.t1 && renderTifChart(tifStats.t1, "初期")}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">末期影像 (T2 TIF)</label>
                      <div className="relative group">
                        <input
                          type="file"
                          accept=".tif,.tiff"
                          onChange={(e) => {
                            setTifFiles(prev => ({ ...prev, t2: e.target.files?.[0] }));
                            setTifStats(prev => ({ ...prev, t2: undefined }));
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={cn(
                          "p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden",
                          tifFiles.t2 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200 group-hover:border-purple-300"
                        )}>
                          {tifThumbnails.t2 ? (
                            <img src={tifThumbnails.t2} className="absolute inset-0 w-full h-full object-contain opacity-40" alt="T2 Preview" />
                          ) : (
                            <FileType className={cn("w-8 h-8", tifFiles.t2 ? "text-green-500" : "text-gray-300")} />
                          )}
                          <p className="text-xs font-medium text-gray-600 truncate max-w-full px-2 relative z-10 bg-white/60 backdrop-blur-sm rounded px-1">
                            {tifFiles.t2 ? tifFiles.t2.name : "点击或拖拽上传"}
                          </p>
                        </div>
                      </div>
                      {tifFiles.t2 && (
                        <div className="mt-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <span>尺寸: {tifMetadata.t2?.loading ? "读取中..." : tifMetadata.t2?.width ? `${tifMetadata.t2.width} x ${tifMetadata.t2.height}` : "未知"}</span>
                            <span>大小: {formatFileSize(tifFiles.t2.size)}</span>
                          </div>
                          {tifMetadata.t2?.error && (
                            <div className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span className="truncate">{tifMetadata.t2.error}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {tifStats.t2 && renderTifChart(tifStats.t2, "末期")}
                    </div>
                  </div>

                  {tifStats.t1 && tifStats.t2 && (
                    <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-2 rounded-xl">
                          <Info className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">影像统计摘要</p>
                          <div className="flex items-center gap-4 mt-1">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">有效像元</span>
                              <span className="text-sm font-bold text-gray-900">
                                {(Object.values(tifStats.t1).reduce((a: number, b: number) => a + b, 0) as number).toLocaleString()}
                              </span>
                            </div>
                            <div className="w-px h-6 bg-purple-100" />
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">估算总面积</span>
                              <span className="text-sm font-bold text-gray-900">
                                {((Object.values(tifStats.t1).reduce((a: number, b: number) => a + b, 0) as number) * resolution * resolution / (unit === 'ha' ? 10000 : unit === 'km2' ? 1000000 : 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">分辨率</p>
                        <p className="text-sm font-bold text-gray-900">{resolution}m × {resolution}m</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-gray-700">分析设置</span>
                        <button 
                          onClick={onShowGuide}
                          className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                          title="查看 TIF 处理说明"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={scanTifValues}
                        disabled={isProcessing || !tifFiles.t1 || !tifFiles.t2}
                        className="text-xs font-bold text-purple-600 hover:text-purple-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <RefreshCw className={cn("w-3 h-3", isProcessing && "animate-spin")} />
                        扫描像元值
                      </button>
                      <button
                        onClick={() => {
                          setTifFiles({ t1: undefined, t2: undefined });
                          setTifThumbnails({ t1: undefined, t2: undefined });
                          setTifStats({ t1: undefined, t2: undefined });
                          setDetectedValues([]);
                          setTempMapping([]);
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        重置影像
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">空间分辨率 (米)</label>
                        <input
                          type="number"
                          value={resolution}
                          onChange={(e) => setResolution(parseFloat(e.target.value) || 30)}
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">面积单位</label>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value as any)}
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                          <option value="ha">公顷 (ha)</option>
                          <option value="km2">平方公里 (km²)</option>
                          <option value="m2">平方米 (m²)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">空值 (NoData)</label>
                        <input
                          type="number"
                          value={noDataValue}
                          onChange={(e) => setNoDataValue(parseFloat(e.target.value) || 0)}
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <span>像元值与类别对应 (Mapping)</span>
                            <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {tempMapping.length} 个类别
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative group/presets">
                              <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                                <Sparkles className="w-3 h-3" />
                                应用预设
                              </button>
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 hidden group-hover/presets:block z-50">
                                {Object.keys(CLASSIFICATION_PRESETS).map(presetName => (
                                  <button
                                    key={presetName}
                                    onClick={() => {
                                      const preset = CLASSIFICATION_PRESETS[presetName];
                                      // Merge preset with detected values if any
                                      const newMapping = detectedValues.length > 0 
                                        ? detectedValues.map(v => {
                                            const match = preset.find(p => p.value === v);
                                            return match || { value: v, label: `类别 ${v}`, color: getInitialColor(`类别 ${v}`) };
                                          })
                                        : preset;
                                      setTempMapping(newMapping);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                  >
                                    {presetName}
                                  </button>
                                ))}
                                <div className="h-px bg-gray-100 my-1 mx-2" />
                                <button
                                  onClick={() => {
                                    const newMapping = tempMapping.map(m => {
                                      // Try to find match in any preset
                                      for (const preset of Object.values(CLASSIFICATION_PRESETS)) {
                                        const match = preset.find(p => p.value === m.value);
                                        if (match) return { ...m, label: match.label, color: match.color };
                                      }
                                      return m;
                                    });
                                    setTempMapping(newMapping);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs text-purple-600 font-bold hover:bg-purple-50 transition-colors"
                                >
                                  智能匹配已检测值
                                </button>
                              </div>
                            </div>
                            <button 
                              onClick={() => setTempMapping([...tempMapping, { value: 0, label: '', color: '#94A3B8' }])}
                              className="text-[10px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              + 添加对应
                            </button>
                            <button 
                              onClick={() => setTempMapping([])}
                              className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              清空
                            </button>
                          </div>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {tempMapping.map((m, idx) => (
                            <div key={idx} className="group flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-100 shadow-sm hover:border-purple-200 transition-all">
                              <div className="w-14">
                                <label className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">值</label>
                                <input
                                  type="number"
                                  value={m.value}
                                  onChange={(e) => {
                                    const newM = [...tempMapping];
                                    newM[idx].value = parseInt(e.target.value) || 0;
                                    setTempMapping(newM);
                                  }}
                                  className="w-full bg-transparent border-none p-0 text-xs font-mono focus:ring-0 text-gray-700"
                                  placeholder="值"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">类别名称</label>
                                <input
                                  type="text"
                                  value={m.label}
                                  onChange={(e) => {
                                    const newM = [...tempMapping];
                                    newM[idx].label = e.target.value;
                                    setTempMapping(newM);
                                  }}
                                  className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-gray-700 font-medium"
                                  placeholder="输入类别名称..."
                                />
                              </div>
                              <div className="flex flex-col items-center">
                                <label className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">颜色</label>
                                <div className="relative w-5 h-5 rounded-full overflow-hidden border border-gray-200 shadow-inner">
                                  <input
                                    type="color"
                                    value={m.color}
                                    onChange={(e) => {
                                      const newM = [...tempMapping];
                                      newM[idx].color = e.target.value;
                                      setTempMapping(newM);
                                    }}
                                    className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => setTempMapping(tempMapping.filter((_, i) => i !== idx))}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {tempMapping.length === 0 && (
                            <div className="text-center py-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                              <Sparkles className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                              <p className="text-gray-400 text-xs italic">暂无对应关系，点击“扫描像元值”或“应用预设”</p>
                            </div>
                          )}
                        </div>
                      </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      注意：浏览器处理大型 TIF 影像（超过 50MB）可能会导致卡顿。建议确保两期影像的坐标系、范围和分辨率完全一致。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">数据内容 (从 Excel 复制并粘贴到此处)</label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={
                      importType === 'matrix' ? "耕地\t林地\t草地\n100\t20\t5\n..." :
                      importType === 'pairs' ? "耕地\t林地\n耕地\t耕地\n林地\t草地\n..." :
                      "耕地\t林地\t150.5\n林地\t草地\t20.3\n..."
                    }
                    className="w-full h-64 p-4 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="px-8 pb-8">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  {importType === 'matrix' && "提示：请包含行列标题。如果只有数字，程序将自动命名类别。"}
                  {importType === 'pairs' && "提示：每行应包含两个地类名称（初期、末期），程序将自动统计转移频次。"}
                  {importType === 'triplets' && "提示：每行应包含三个字段：初期地类、末期地类、转移面积。"}
                  {importType === 'tif' && "提示：请确保 TIF 影像为单波段，像素值为地类代码。"}
                </p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsImportOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={isProcessing || (importType === 'tif' ? (!tifFiles.t1 || !tifFiles.t2) : !importText.trim())}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    正在处理像素...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    确认导入并分析
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Report Customization Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">报告定制 (Report Customization)</h3>
                  <p className="text-sm text-gray-500">设置报告的标题、作者及备注信息</p>
                </div>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">报告标题</label>
                  <input
                    type="text"
                    value={reportConfig.title}
                    onChange={(e) => setReportConfig({ ...reportConfig, title: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    placeholder="输入报告标题..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">作者姓名</label>
                  <input
                    type="text"
                    value={reportConfig.author}
                    onChange={(e) => setReportConfig({ ...reportConfig, author: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    placeholder="输入作者姓名..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">所属机构</label>
                <input
                  type="text"
                  value={reportConfig.organization}
                  onChange={(e) => setReportConfig({ ...reportConfig, organization: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  placeholder="输入机构名称..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">备注说明</label>
                <textarea
                  value={reportConfig.notes}
                  onChange={(e) => setReportConfig({ ...reportConfig, notes: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all h-32 resize-none"
                  placeholder="输入报告备注或分析结论..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all">
                  <input
                    type="checkbox"
                    checked={reportConfig.showMatrix}
                    onChange={(e) => setReportConfig({ ...reportConfig, showMatrix: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">包含转移矩阵</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all">
                  <input
                    type="checkbox"
                    checked={reportConfig.showStats}
                    onChange={(e) => setReportConfig({ ...reportConfig, showStats: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">包含统计数据</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all">
                  <input
                    type="checkbox"
                    checked={reportConfig.showCharts}
                    onChange={(e) => setReportConfig({ ...reportConfig, showCharts: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">包含图表预览</span>
                </label>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setIsReportModalOpen(false);
                  exportReport('pdf');
                }}
                className="px-8 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                生成 PDF 报告
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Report Content for PDF Generation */}
      <div className="fixed -left-[9999px] top-0">
        <div ref={reportRef} className="w-[210mm] min-h-[297mm] bg-white p-[20mm] text-gray-900 font-sans">
          <div className="border-b-4 border-amber-600 pb-6 mb-8">
            <h1 className="text-4xl font-black text-gray-900 mb-2">{reportConfig.title}</h1>
            <div className="flex justify-between text-sm text-gray-500 font-medium">
              <div className="space-y-1">
                <p>作者: {reportConfig.author || '未指定'}</p>
                <p>机构: {reportConfig.organization || '未指定'}</p>
              </div>
              <div className="text-right space-y-1">
                <p>生成时间: {new Date().toLocaleString()}</p>
                <p>工具: Land Use Change Analyzer</p>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-bold text-gray-900 border-l-4 border-amber-600 pl-3 mb-4">1. 摘要与基本信息</h2>
              <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">总分析面积</p>
                    <p className="text-2xl font-black text-gray-900">
                      {matrix.flat().reduce((a, b) => a + b, 0).toFixed(2)} <span className="text-sm font-normal text-gray-500">{unit === 'ha' ? 'ha' : unit === 'km2' ? 'km²' : 'm²'}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">分析类别数量</p>
                    <p className="text-2xl font-black text-gray-900">{categories.length}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">备注说明</p>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{reportConfig.notes}</p>
                </div>
              </div>
            </section>

            {reportConfig.showMatrix && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 border-l-4 border-amber-600 pl-3 mb-4">2. 土地利用转移矩阵</h2>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase border-r border-gray-200">T1 \ T2</th>
                        {categories.map(c => (
                          <th key={c} className="p-3 text-[10px] font-bold text-gray-400 uppercase text-center">{c}</th>
                        ))}
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase text-center border-l border-gray-200">总计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="p-3 text-xs font-bold text-gray-700 bg-gray-50 border-r border-gray-200">{categories[i]}</td>
                          {row.map((val, j) => (
                            <td key={j} className={cn("p-3 text-xs text-center font-mono", i === j ? "bg-amber-50 text-amber-700 font-bold" : "text-gray-600")}>
                              {val.toFixed(2)}
                            </td>
                          ))}
                          <td className="p-3 text-xs text-center font-bold text-gray-900 bg-gray-50 border-l border-gray-200">
                            {row.reduce((a, b) => a + b, 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td className="p-3 text-xs text-gray-700 border-r border-gray-200">总计</td>
                        {categories.map((_, j) => (
                          <td key={j} className="p-3 text-xs text-center text-gray-900">
                            {matrix.reduce((sum, row) => sum + (row[j] || 0), 0).toFixed(2)}
                          </td>
                        ))}
                        <td className="p-3 text-xs text-center text-amber-600 border-l border-gray-200">
                          {matrix.flat().reduce((a, b) => a + b, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {reportConfig.showStats && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 border-l-4 border-amber-600 pl-3 mb-4">3. 变化特征统计</h2>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase">类别</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase text-right">T1 面积</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase text-right">T2 面积</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase text-right">净变化</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase text-right">交换变化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="p-3 text-xs font-bold text-gray-700">{s.name}</td>
                          <td className="p-3 text-xs text-right font-mono text-gray-600">{s.t1.toFixed(2)}</td>
                          <td className="p-3 text-xs text-right font-mono text-gray-600">{s.t2.toFixed(2)}</td>
                          <td className={cn("p-3 text-xs text-right font-bold font-mono", s.net > 0 ? "text-emerald-600" : s.net < 0 ? "text-red-600" : "text-gray-400")}>
                            {s.net > 0 ? '+' : ''}{s.net.toFixed(2)}
                          </td>
                          <td className="p-3 text-xs text-right font-mono text-gray-600">{s.swap.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xl font-bold text-gray-900 border-l-4 border-amber-600 pl-3 mb-4">4. 结论分析</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    净增加最多
                  </p>
                  <p className="text-xl font-black text-emerald-900 mb-1">
                    {[...stats].sort((a, b) => b.net - a.net)[0]?.name || 'N/A'}
                  </p>
                  <p className="text-xs text-emerald-700">
                    净增面积: {[...stats].sort((a, b) => b.net - a.net)[0]?.net.toFixed(2) || '0.00'} {unit}
                  </p>
                </div>
                <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                  <p className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    净减少最多
                  </p>
                  <p className="text-xl font-black text-red-900 mb-1">
                    {[...stats].sort((a, b) => a.net - b.net)[0]?.name || 'N/A'}
                  </p>
                  <p className="text-xs text-red-700">
                    净减面积: {Math.abs([...stats].sort((a, b) => a.net - b.net)[0]?.net || 0).toFixed(2)} {unit}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-20 pt-8 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
              End of Report • Generated by Land Use Change Analyzer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
