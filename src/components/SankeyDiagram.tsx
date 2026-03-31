import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyCenter,
  SankeyNode,
  SankeyLink,
} from 'd3-sankey';

interface NodeData {
  name: string;
  category: string;
  time: string;
  color?: string;
}

interface LinkData {
  source: number;
  target: number;
  value: number;
  color?: string;
}

interface SankeyData {
  nodes: NodeData[];
  links: LinkData[];
}

interface SankeyDiagramProps {
  data: SankeyData;
  width?: number;
  height?: number;
}

export default function SankeyDiagram({
  data,
  width = 800,
  height = 500,
}: SankeyDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; visible: boolean }>({
    x: 0,
    y: 0,
    content: '',
    visible: false,
  });

  const handleExport = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const svgSize = svgRef.current.getBoundingClientRect();
    canvas.width = svgSize.width * 2; // High res
    canvas.height = svgSize.height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = 'sankey-diagram.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = url;
  };

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 160, bottom: 40, left: 160 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create a main group for zoom/pan
    const mainG = svg.append('g').attr('class', 'main-g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        mainG.attr('transform', event.transform);
      });

    svg.call(zoom);

    const g = mainG
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const sankeyGenerator = sankey<NodeData, LinkData>()
      .nodeWidth(24)
      .nodePadding(15)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .nodeAlign(sankeyCenter);

    const { nodes, links } = sankeyGenerator({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });

    const defaultColor = d3.scaleOrdinal(d3.schemeTableau10);

    // Links
    const link = g.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.4)
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'sankey-link')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d) => d.color || defaultColor((d.source as any).category))
      .attr('stroke-width', (d) => Math.max(1, d.width || 0))
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.8);

        const source = d.source as any;
        const target = d.target as any;
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: `
            <div class="font-bold text-purple-700 mb-1">转移详情</div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span class="text-gray-500">源类别:</span>
              <span class="font-medium">${source.category} (T1)</span>
              <span class="text-gray-500">目标类别:</span>
              <span class="font-medium">${target.category} (T2)</span>
              <span class="text-gray-500">转移面积:</span>
              <span class="font-bold text-indigo-600">${d.value.toLocaleString()} ha</span>
            </div>
          `,
        });
      })
      .on('mousemove', (event) => {
        setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }));
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.4);
        setTooltip(prev => ({ ...prev, visible: false }));
      });

    // Nodes
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'sankey-node')
      .on('mouseenter', (event, d) => {
        // Highlight connected links
        link.filter(l => l.source === d || l.target === d)
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.8)
          .attr('stroke-width', l => (l.width || 0) + 2);
        
        // Dim other links
        link.filter(l => l.source !== d && l.target !== d)
          .transition()
          .duration(200)
          .attr('stroke-opacity', 0.1);
      })
      .on('mouseleave', (event, d) => {
        link.transition()
          .duration(200)
          .attr('stroke-opacity', 0.4)
          .attr('stroke-width', l => Math.max(1, l.width || 0));
      });

    node
      .append('rect')
      .attr('x', (d) => d.x0 || 0)
      .attr('y', (d) => d.y0 || 0)
      .attr('height', (d) => (d.y1 || 0) - (d.y0 || 0))
      .attr('width', (d) => (d.x1 || 0) - (d.x0 || 0))
      .attr('fill', (d) => d.color || defaultColor(d.category))
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5)
      .attr('rx', 2);

    node
      .append('text')
      .attr('x', (d) => (d.x0 || 0) < innerWidth / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', (d) => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => (d.x0 || 0) < innerWidth / 2 ? 'start' : 'end')
      .text((d) => d.name)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#1a1a1a');

    node
      .append('text')
      .attr('x', (d) => (d.x0 || 0) < innerWidth / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', (d) => ((d.y1 || 0) + (d.y0 || 0)) / 2 + 14)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => (d.x0 || 0) < innerWidth / 2 ? 'start' : 'end')
      .text((d) => `${d.value?.toLocaleString()} ha`)
      .attr('font-size', '10px')
      .attr('fill', '#666');

    // Add Zoom Controls
    const resetZoom = () => {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    };

    d3.select('#reset-zoom').on('click', resetZoom);

  }, [data, width, height]);

  // Extract unique categories for legend
  const categories = Array.from(new Set(data.nodes.map(n => n.category))).map(cat => {
    const node = data.nodes.find(n => n.category === cat);
    return {
      name: cat,
      color: node?.color || d3.scaleOrdinal(d3.schemeTableau10)(cat)
    };
  });

  return (
    <div ref={containerRef} className="relative bg-white p-6 rounded-2xl border border-gray-100 shadow-sm group overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="w-2 h-6 bg-purple-600 rounded-full"></span>
          土地利用转移桑基图
        </h3>
        <div className="flex items-center gap-2">
          <button
            id="reset-zoom"
            className="p-2 bg-gray-50 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
            title="重置视图"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 bg-gray-50 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
            title="保存为图片"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative cursor-move">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="mx-auto"
        />
        
        {/* Zoom Instructions Overlay */}
        <div className="absolute bottom-4 left-4 text-[10px] text-gray-400 pointer-events-none bg-white/50 backdrop-blur-sm px-2 py-1 rounded border border-gray-100">
          滚轮缩放 • 拖拽平移
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-gray-50">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
          {categories.map((cat, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm shadow-sm" 
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-xs font-medium text-gray-600">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-[9999] pointer-events-none bg-white/95 backdrop-blur-md border border-purple-100 shadow-xl rounded-lg p-3 text-sm min-w-[180px] animate-in fade-in zoom-in duration-150"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y + 15,
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
}
