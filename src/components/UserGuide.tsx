import React from 'react';
import { X, BookOpen, MousePointer2, FileType, BarChart3, Download, Info, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuide({ isOpen, onClose }: UserGuideProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">使用说明与算法指南</h2>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">User Guide & Methodology</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
              
              {/* Section 1: Data Input */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <MousePointer2 className="w-5 h-5" />
                  <h3 className="text-lg font-bold">1. 数据导入方式</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <FileType className="w-4 h-4 text-purple-500" />
                      手动输入 (Matrix/List)
                    </h4>
                    <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                      <li><span className="font-medium text-gray-900">转移矩阵:</span> 直接填入地类间的转移面积。</li>
                      <li><span className="font-medium text-gray-900">二元组/三元组:</span> 适合从表格粘贴数据。</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <FileType className="w-4 h-4 text-emerald-500" />
                      遥感影像 (GeoTIFF)
                    </h4>
                    <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                      <li>支持上传两期同范围、同分辨率的 <span className="font-mono">.tif</span> 文件。</li>
                      <li>需指定像元分辨率（如 30m）并选择面积单位（ha, km², m²）。</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 2: TIF Processing */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <Info className="w-5 h-5" />
                  <h3 className="text-lg font-bold">2. TIF 处理关键设置</h3>
                </div>
                <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase mb-1">分辨率与单位 (Res & Unit)</p>
                      <p className="text-sm text-blue-700">像元的边长（米）以及期望的统计单位。系统将自动完成像元到面积的换算。</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase mb-1">空值 (NoData)</p>
                      <p className="text-sm text-blue-700">指定不参与计算的像元值（如 0 或 -9999）。</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase mb-1">类别映射 (Mapping)</p>
                      <p className="text-sm text-blue-700">将影像中的数字（如 10）映射为人类可读的名称（如 林地）。</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Metrics */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <BarChart3 className="w-5 h-5" />
                  <h3 className="text-lg font-bold">3. 核心指标定义</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    <div className="w-1 bg-emerald-500 rounded-full" />
                    <div>
                      <h4 className="font-bold text-gray-900">净变化 (Net Change)</h4>
                      <p className="text-sm text-gray-600">末期面积与初期面积的绝对差值。反映了该地类总量的增减趋势。</p>
                      <p className="text-xs font-mono text-gray-400 mt-1">Formula: Net = T2_Area - T1_Area</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    <div className="w-1 bg-amber-500 rounded-full" />
                    <div>
                      <h4 className="font-bold text-gray-900">交换变化 (Swap Change)</h4>
                      <p className="text-sm text-gray-600">反映了地类在空间位置上的双向转移。即某地类在 A 处转出，同时在 B 处等量转入，总量未变但位置发生了更替。</p>
                      <p className="text-xs font-mono text-gray-400 mt-1">Formula: Swap = 2 * min(Gain, Loss)</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    <div className="w-1 bg-blue-500 rounded-full" />
                    <div>
                      <h4 className="font-bold text-gray-900">总变化 (Total Change)</h4>
                      <p className="text-sm text-gray-600">该地类发生的全部动态变化总量。</p>
                      <p className="text-xs font-mono text-gray-400 mt-1">Formula: Total = Gain + Loss</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Export */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <Download className="w-5 h-5" />
                  <h3 className="text-lg font-bold">4. 结果导出</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <FileType className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">CSV 数据表格</p>
                      <p className="text-xs text-gray-500">导出转移矩阵、统计表或综合分析报告，支持 Excel 打开。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">PNG 桑基图</p>
                      <p className="text-xs text-gray-500">悬停在桑基图上点击下载图标，可保存为高清图片。</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Tips */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex gap-4">
                <HelpCircle className="w-6 h-6 text-amber-600 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-900">小贴士</h4>
                  <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                    <li>处理大型 TIF 文件时，浏览器可能会有短暂卡顿，请耐心等待。</li>
                    <li>确保两期影像的坐标系和范围完全一致，否则计算结果将不准确。</li>
                    <li>桑基图的宽度代表了转移量的大小，越宽表示转移面积越大。</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
              >
                我知道了
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
