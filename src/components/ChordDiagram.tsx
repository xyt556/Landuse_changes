import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';

interface ChordDiagramProps {
  matrix: number[][];
  categories: string[];
  colors?: string[];
  width?: number;
  height?: number;
}

export default function ChordDiagram({
  matrix,
  categories,
  colors,
  width = 500,
  height = 500,
}: ChordDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleExport = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const svgSize = svgRef.current.getBoundingClientRect();
    canvas.width = svgSize.width * 2;
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
      downloadLink.download = 'chord-diagram.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = url;
  };

  useEffect(() => {
    if (!svgRef.current || !matrix.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const outerRadius = Math.min(width, height) * 0.5 - 60;
    const innerRadius = outerRadius - 20;

    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending);

    const arc = d3.arc<any, d3.ChordGroup>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    const ribbon = d3.ribbon()
      .radius(innerRadius);

    const color = d3.scaleOrdinal<number, string>()
      .domain(d3.range(categories.length))
      .range(colors || d3.schemeTableau10);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const chords = chord(matrix);

    // Groups (Arcs)
    const group = g.append('g')
      .selectAll('g')
      .data(chords.groups)
      .join('g');

    group.append('path')
      .attr('fill', d => color(d.index))
      .attr('stroke', d => d3.rgb(color(d.index)).darker().toString())
      .attr('d', arc as any);

    group.append('title')
      .text(d => `${categories[d.index]}\n总计: ${d.value.toLocaleString()} ha`);

    // Labels
    group.append('text')
      .each(d => { (d as any).angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '.35em')
      .attr('transform', d => `
        rotate(${(d as any).angle * 180 / Math.PI - 90})
        translate(${outerRadius + 10})
        ${(d as any).angle > Math.PI ? 'rotate(180)' : ''}
      `)
      .attr('text-anchor', d => (d as any).angle > Math.PI ? 'end' : 'start')
      .text(d => categories[d.index])
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151');

    // Ribbons (Links)
    g.append('g')
      .attr('fill-opacity', 0.67)
      .selectAll('path')
      .data(chords)
      .join('path')
      .attr('d', ribbon as any)
      .attr('fill', d => color(d.target.index))
      .attr('stroke', d => d3.rgb(color(d.target.index)).darker().toString())
      .append('title')
      .text(d => `${categories[d.source.index]} → ${categories[d.target.index]}: ${d.source.value.toLocaleString()} ha`);

  }, [matrix, categories, colors, width, height]);

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
