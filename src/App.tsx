/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { LayoutDashboard, BarChart3, Info, Github, Download, Share2, HelpCircle, Map as MapIcon, Table as TableIcon, GitBranch, CircleDot, BarChart as BarChartIcon } from 'lucide-react';
import TransferMatrix, { SpatialData } from './components/TransferMatrix';
import SankeyDiagram from './components/SankeyDiagram';
import ChordDiagram from './components/ChordDiagram';
import StackedBarChart from './components/StackedBarChart';
import UserGuide from './components/UserGuide';
import SpatialMap from './components/SpatialMap';

export default function App() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'spatial'>('stats');
  const [activeViz, setActiveViz] = useState<'sankey' | 'chord' | 'stacked'>('sankey');
  const [sankeyData, setSankeyData] = useState<{ nodes: any[]; links: any[] }>({
    nodes: [],
    links: [],
  });
  const [fullData, setFullData] = useState<{ matrix: number[][]; categories: string[]; colors: string[] } | null>(null);
  const [spatialData, setSpatialData] = useState<SpatialData | null>(null);

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
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-all shadow-sm">
                <Download className="w-4 h-4" />
                导出报告
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    </div>
  );
}

