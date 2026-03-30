import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';
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

    const margin = { top: 20, right: 160, bottom: 20, left: 160 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
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
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.4)
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d) => d.color || defaultColor((d.source as SankeyNode<NodeData, LinkData>).category))
      .attr('stroke-width', (d) => Math.max(1, d.width || 0))
      .append('title')
      .text((d) => `${(d.source as SankeyNode<NodeData, LinkData>).name} → ${(d.target as SankeyNode<NodeData, LinkData>).name}\n${d.value.toLocaleString()} ha`);

    // Nodes
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g');

    node
      .append('rect')
      .attr('x', (d) => d.x0 || 0)
      .attr('y', (d) => d.y0 || 0)
      .attr('height', (d) => (d.y1 || 0) - (d.y0 || 0))
      .attr('width', (d) => (d.x1 || 0) - (d.x0 || 0))
      .attr('fill', (d) => d.color || defaultColor(d.category))
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5);

    node
      .append('text')
      .attr('x', (d) => (d.x0 || 0) < innerWidth / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', (d) => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => (d.x0 || 0) < innerWidth / 2 ? 'start' : 'end')
      .text((d) => d.name)
      .attr('font-size', '12px')
      .attr('font-weight', '500')
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

  }, [data, width, height]);

  return (
    <div className="relative overflow-x-auto bg-white p-4 rounded-xl border border-gray-100 shadow-sm group">
      <button
        onClick={handleExport}
        className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur border border-gray-200 rounded-lg text-gray-500 hover:text-purple-600 hover:border-purple-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm z-10"
        title="保存为图片"
      >
        <Download className="w-4 h-4" />
      </button>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="mx-auto"
      />
    </div>
  );
}
