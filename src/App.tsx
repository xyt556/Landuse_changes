/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutDashboard, BarChart3, Info, Github, Download, Share2, HelpCircle, Map as MapIcon, Table as TableIcon, GitBranch, CircleDot, BarChart as BarChartIcon, ChevronDown, FileText, FileSpreadsheet, FileJson, X } from 'lucide-react';
import TransferMatrix, { SpatialData } from './components/TransferMatrix';
import SankeyDiagram from './components/SankeyDiagram';
import ChordDiagram from './components/ChordDiagram';
import StackedBarChart from './components/StackedBarChart';
import UserGuide from './components/UserGuide';
import SpatialMap from './components/SpatialMap';
import { exportToCSV, exportToExcel, exportToPDF, calculateStats } from './lib/exportUtils';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    title: '土地利用转移分析报告',
    author: 'GIS 分析员',
    organization: '',
    notes: '',
    includeMatrix: true,
    includeStats: true,
    includeCharts: true,
  });

  const [activeTab, setActiveTab] = useState<'stats' | 'spatial'>('stats');
  const [activeViz, setActiveViz] = useState<'sankey' | 'chord' | 'stacked'>('sankey');
  const [sankeyData, setSankeyData] = useState<{ nodes: any[]; links: any[] }>({
    nodes: [],
    links: [],
  });
  const [fullData, setFullData] = useState<{ matrix: number[][]; categories: string[]; colors: string[] } | null>(null);
  const [spatialData, setSpatialData] = useState<SpatialData | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mergedSpatialData = useMemo(() => {
    if (!spatialData) return null;
    if (!fullData) return spatialData;

    // Create a map from label to color
    const labelToColor: Record<string, string> = {};
    fullData.categories.forEach((cat, i) => {
      labelToColor[cat] = fullData.colors[i];
    });

    // Update spatialData colors based on label mapping
    const newColors: Record<number, string> = {};
    Object.entries(spatialData.mapping).forEach(([val, label]) => {
      const labelStr = label as string;
      newColors[parseInt(val)] = labelToColor[labelStr] || '#808080';
    });

    return {
      ...spatialData,
      colors: newColors
    };
  }, [spatialData, fullData]);

  const handleDataChange = (nodes: any[], links: any[]) => {
    setSankeyData({ nodes, links });
  };

  const handleFullDataChange = (matrix: number[][], categories: string[], colors: string[]) => {
    setFullData({ matrix, categories, colors });
  };

  const handleSpatialDataChange = (data: SpatialData | null) => {
    setSpatialData(data);
    if (data) setActiveTab('spatial');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-gray-900">土地利用转移分析系统</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Land Use Change Analyzer v1.0</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsGuideOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                使用说明
              </button>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
              
              <div className="relative" ref={exportMenuRef}>
                <button 
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  disabled={!fullData}
                  className={`flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-all shadow-sm ${!fullData ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Download className="w-4 h-4" />
                  导出报告
                  <ChevronDown className={`w-3 h-3 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isExportMenuOpen && fullData && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-2 space-y-1">
                        <button 
                          onClick={() => {
                            exportToCSV(fullData);
                            setIsExportMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <FileText className="w-4 h-4 text-blue-500" />
                          导出 CSV 数据
                        </button>
                        <button 
                          onClick={() => {
                            exportToExcel(fullData);
                            setIsExportMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-green-500" />
                          导出 Excel 报告
                        </button>
                        <button 
                          onClick={async () => {
                            setIsExportMenuOpen(false);
                            setIsReportModalOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <FileText className="w-4 h-4 text-red-500" />
                          生成 PDF 报告
                        </button>
                        <button 
                          onClick={() => {
                            const json = JSON.stringify(fullData, null, 2);
                            const blob = new Blob([json], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = 'land_use_data.json';
                            link.click();
                            setIsExportMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <FileJson className="w-4 h-4 text-orange-500" />
                          导出 JSON 数据
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="report-content">
        {/* Tab Navigation */}
        <div className="flex items-center gap-4 mb-8 bg-white p-1.5 rounded-2xl border border-gray-200 w-fit shadow-sm">
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <TableIcon className="w-4 h-4" />
            统计报表 (Statistical)
          </button>
          <button 
            onClick={() => setActiveTab('spatial')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'spatial' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <MapIcon className="w-4 h-4" />
            空间分布 (Spatial)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input & Stats */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-8">
            <section id="matrix-section">
              <TransferMatrix 
                onDataChange={handleDataChange} 
                onFullDataChange={handleFullDataChange}
                onSpatialDataChange={handleSpatialDataChange}
                onShowGuide={() => setIsGuideOpen(true)} 
              />
            </section>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4">
              <div className="bg-blue-100 p-2 rounded-full h-fit">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-blue-900">计算说明</h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  转移矩阵反映了不同地类在两个时期之间的相互转化情况。
                  <span className="font-bold">净变化 (Net)</span> 为末期与初期面积之差；
                  <span className="font-bold">交换变化 (Swap)</span> 反映了地类在空间位置上的双向转移，其值为转入与转出面积中较小值的两倍。
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Visualization */}
          <div className="lg:col-span-12 xl:col-span-5 space-y-8">
            {activeTab === 'stats' ? (
              <div className="sticky top-24 space-y-8">
                <section id="viz-section" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">动态交互图表 (Interactive Charts)</h2>
                    </div>
                    
                    {/* Sub-tabs for Visualizations */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button 
                        onClick={() => setActiveViz('sankey')}
                        className={`p-1.5 rounded-md transition-all ${activeViz === 'sankey' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="桑基图"
                      >
                        <GitBranch className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setActiveViz('chord')}
                        className={`p-1.5 rounded-md transition-all ${activeViz === 'chord' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="弦图"
                      >
                        <CircleDot className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setActiveViz('stacked')}
                        className={`p-1.5 rounded-md transition-all ${activeViz === 'stacked' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="堆叠柱状图"
                      >
                        <BarChartIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {sankeyData.links.length > 0 ? (
                      <>
                        {activeViz === 'sankey' && <SankeyDiagram data={sankeyData} height={500} />}
                        {activeViz === 'chord' && fullData && (
                          <ChordDiagram 
                            matrix={fullData.matrix} 
                            categories={fullData.categories} 
                            colors={fullData.colors} 
                            width={450} 
                            height={450} 
                          />
                        )}
                        {activeViz === 'stacked' && fullData && (
                          <StackedBarChart 
                            matrix={fullData.matrix} 
                            categories={fullData.categories} 
                            colors={fullData.colors} 
                          />
                        )}
                      </>
                    ) : (
                      <div className="h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                        <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">请输入数据或加载示例以生成图表</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 flex justify-between italic">
                    {activeViz === 'sankey' ? (
                      <>
                        <span>左侧: T1 初始状态</span>
                        <span>右侧: T2 末期状态</span>
                      </>
                    ) : activeViz === 'chord' ? (
                      <span>圆周: 各地类总量 | 弦: 转移流量</span>
                    ) : (
                      <span>对比 T1 与 T2 各地类面积总量变化</span>
                    )}
                  </div>
                </section>

                {/* Quick Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">总转移量</p>
                    <p className="text-2xl font-mono font-bold text-gray-900">
                      {sankeyData.links.reduce((sum, l) => sum + l.value, 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">Hectares (ha)</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">活跃类别</p>
                    <p className="text-2xl font-mono font-bold text-gray-900">
                      {new Set(sankeyData.links.map(l => l.source)).size}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">Categories with change</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="sticky top-24 space-y-8">
                {mergedSpatialData ? (
                  <SpatialMap data={mergedSpatialData} />
                ) : (
                  <div className="h-[600px] bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                    <MapIcon className="w-16 h-16 mb-6 opacity-10" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">未检测到空间数据</h3>
                    <p className="text-sm max-w-xs">请先在左侧上传 TIF 影像文件进行分析，系统将自动生成空间分布图。</p>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-gray-400">
            <Github className="w-5 h-5" />
            <span className="text-sm font-medium">Open Source Land Analysis Tool</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <button onClick={() => setIsGuideOpen(true)} className="hover:text-blue-600 transition-colors">文档</button>
            <button onClick={() => setIsGuideOpen(true)} className="hover:text-blue-600 transition-colors">算法说明</button>
            <a href="#" className="hover:text-blue-600 transition-colors">隐私政策</a>
          </div>
          <p className="text-sm text-gray-400">© 2026 Land Use Analyzer. All rights reserved.</p>
        </div>
      </footer>
      <UserGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Report Customization Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
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
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">机构</label>
                    <input
                      value={reportConfig.organization}
                      onChange={(e) => setReportConfig({ ...reportConfig, organization: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">备注</label>
                  <textarea
                    value={reportConfig.notes}
                    onChange={(e) => setReportConfig({ ...reportConfig, notes: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none h-20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={reportConfig.includeMatrix} onChange={e => setReportConfig({...reportConfig, includeMatrix: e.target.checked})} />
                    <span className="text-xs font-medium">包含转移矩阵</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={reportConfig.includeStats} onChange={e => setReportConfig({...reportConfig, includeStats: e.target.checked})} />
                    <span className="text-xs font-medium">包含统计表格</span>
                  </label>
                </div>
              </div>

              <div className="p-6 bg-gray-50 flex gap-3">
                <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-2 text-sm font-bold text-gray-500">取消</button>
                <button 
                  onClick={async () => {
                    setIsReportModalOpen(false);
                    setTimeout(() => exportToPDF('hidden-report-container', reportConfig.title), 300);
                  }}
                  className="flex-1 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
                >
                  生成 PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Report Container for PDF Generation */}
      <div className="fixed left-[-9999px] top-[-9999px]">
        <div id="hidden-report-container" ref={reportRef} className="w-[800px] p-12 bg-white text-gray-900 font-sans">
          <div className="border-b-4 border-blue-600 pb-6 mb-8">
            <h1 className="text-4xl font-black mb-2">{reportConfig.title}</h1>
            <div className="flex justify-between items-end text-sm text-gray-500">
              <div>
                <p>作者: <span className="font-bold text-gray-700">{reportConfig.author}</span></p>
                {reportConfig.organization && <p>机构: <span className="font-bold text-gray-700">{reportConfig.organization}</span></p>}
              </div>
              <p>日期: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {reportConfig.notes && (
            <div className="mb-8 p-4 bg-gray-50 rounded-xl border-l-4 border-gray-300 italic text-gray-600">
              {reportConfig.notes}
            </div>
          )}

          {fullData && reportConfig.includeMatrix && (
            <div className="mb-10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-600 rounded-full" />
                土地利用转移矩阵
              </h2>
              <table className="w-full text-[10px] border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 border border-gray-200">T1 \ T2</th>
                    {fullData.categories.map(c => <th key={c} className="p-2 border border-gray-200">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {fullData.matrix.map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 border border-gray-200 font-bold bg-gray-50">{fullData.categories[i]}</td>
                      {row.map((val, j) => <td key={j} className="p-2 border border-gray-200 text-right">{val.toLocaleString()}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fullData && reportConfig.includeStats && (
            <div className="mb-10">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-2 h-6 bg-green-600 rounded-full" />
                变化特征统计
              </h2>
              <table className="w-full text-[10px] border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 border border-gray-200">类别</th>
                    <th className="p-2 border border-gray-200">T1 面积</th>
                    <th className="p-2 border border-gray-200">T2 面积</th>
                    <th className="p-2 border border-gray-200">净变化</th>
                    <th className="p-2 border border-gray-200">交换变化</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateStats(fullData.matrix, fullData.categories).map(s => (
                    <tr key={s.name}>
                      <td className="p-2 border border-gray-200 font-bold">{s.name}</td>
                      <td className="p-2 border border-gray-200 text-right">{s.t1.toLocaleString()}</td>
                      <td className="p-2 border border-gray-200 text-right">{s.t2.toLocaleString()}</td>
                      <td className={`p-2 border border-gray-200 text-right font-bold ${s.net > 0 ? 'text-green-600' : 'text-red-600'}`}>{s.net.toLocaleString()}</td>
                      <td className="p-2 border border-gray-200 text-right">{s.swap.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-20 pt-6 border-t border-gray-100 text-[10px] text-gray-400 text-center italic">
            报告由土地利用转移分析系统自动生成 • © 2026 Land Use Analyzer
          </div>
        </div>
      </div>
    </div>
  );
}

