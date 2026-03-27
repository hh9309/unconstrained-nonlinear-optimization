import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Point, Iteration, evaluate } from '../lib/optimization';
import { RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

interface SurfacePlotProps {
  expr: string;
  iterations: Iteration[];
  range: { x: [number, number]; y: [number, number] };
  startPoint?: Point;
}

const SurfacePlot: React.FC<SurfacePlotProps> = ({ expr, iterations, range, startPoint }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [angles, setAngles] = useState({ x: 60, z: 45 });
  const [scale, setScale] = useState(240);
  const [loading, setLoading] = useState(false);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!svgRef.current) return;
    
    setLoading(true);

    // Use a small timeout to allow the loading spinner to render
    const timer = setTimeout(() => {
      const width = 600;
      const height = 600;
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      // ... existing D3 logic ...
      // (I'll include the full logic in the ReplacementContent to ensure it works)
      
      // 3D Projection parameters
      const rotateX = angles.x * Math.PI / 180;
      const rotateZ = angles.z * Math.PI / 180;

      const project = (px: number, py: number, pz: number) => {
        const nx = (px - (range.x[0] + range.x[1]) / 2) / ((range.x[1] - range.x[0]) / 2 || 1);
        const ny = (py - (range.y[0] + range.y[1]) / 2) / ((range.y[1] - range.y[0]) / 2 || 1);
        const x1 = nx * Math.cos(rotateZ) - ny * Math.sin(rotateZ);
        const y1 = nx * Math.sin(rotateZ) + ny * Math.cos(rotateZ);
        const x2 = x1;
        const y2 = y1 * Math.cos(rotateX) - pz * Math.sin(rotateX);
        const z2 = y1 * Math.sin(rotateX) + pz * Math.cos(rotateX);
        return { x: width / 2 + x2 * scale, y: height / 2 - y2 * scale, z: z2 };
      };

      const n = 30;
      const m = 30;
      let minZ = Infinity;
      let maxZ = -Infinity;
      const rawValues: number[][] = [];

      for (let j = 0; j < m; j++) {
        rawValues[j] = [];
        for (let i = 0; i < n; i++) {
          const px = range.x[0] + (i / (n - 1)) * (range.x[1] - range.x[0]);
          const py = range.y[0] + (j / (m - 1)) * (range.y[1] - range.y[0]);
          const pz = evaluate(expr, { x: px, y: py });
          rawValues[j][i] = pz;
          if (pz < minZ) minZ = pz;
          if (pz > maxZ) maxZ = pz;
        }
      }

      const zScale = (z: number) => (z - minZ) / (maxZ - minZ || 1) * 2 - 1;
      const polygons: any[] = [];
      for (let j = 0; j < m - 1; j++) {
        for (let i = 0; i < n - 1; i++) {
          const p1 = project(range.x[0] + (i / (n - 1)) * (range.x[1] - range.x[0]), range.y[0] + (j / (m - 1)) * (range.y[1] - range.y[0]), zScale(rawValues[j][i]));
          const p2 = project(range.x[0] + ((i + 1) / (n - 1)) * (range.x[1] - range.x[0]), range.y[0] + (j / (m - 1)) * (range.y[1] - range.y[0]), zScale(rawValues[j][i + 1]));
          const p3 = project(range.x[0] + ((i + 1) / (n - 1)) * (range.x[1] - range.x[0]), range.y[0] + ((j + 1) / (m - 1)) * (range.y[1] - range.y[0]), zScale(rawValues[j + 1][i + 1]));
          const p4 = project(range.x[0] + (i / (n - 1)) * (range.x[1] - range.x[0]), range.y[0] + ((j + 1) / (m - 1)) * (range.y[1] - range.y[0]), zScale(rawValues[j + 1][i]));
          const avgZ = (p1.z + p2.z + p3.z + p4.z) / 4;
          const avgVal = (rawValues[j][i] + rawValues[j][i+1] + rawValues[j+1][i+1] + rawValues[j+1][i]) / 4;
          polygons.push({ points: [p1, p2, p3, p4], z: avgZ, val: avgVal });
        }
      }

      polygons.sort((a, b) => a.z - b.z);
      const color = d3.scaleSequential(d3.interpolateViridis).domain([minZ, maxZ]);

      const axes = [
        { p1: { x: range.x[0], y: (range.y[0]+range.y[1])/2, z: 0 }, p2: { x: range.x[1], y: (range.y[0]+range.y[1])/2, z: 0 }, color: '#ef4444' },
        { p1: { x: (range.x[0]+range.x[1])/2, y: range.y[0], z: 0 }, p2: { x: (range.x[0]+range.x[1])/2, y: range.y[1], z: 0 }, color: '#22c55e' },
        { p1: { x: (range.x[0]+range.x[1])/2, y: (range.y[0]+range.y[1])/2, z: -1 }, p2: { x: (range.x[0]+range.x[1])/2, y: (range.y[0]+range.y[1])/2, z: 1 }, color: '#3b82f6' }
      ];

      axes.forEach(axis => {
        const pt1 = project(axis.p1.x, axis.p1.y, axis.p1.z);
        const pt2 = project(axis.p2.x, axis.p2.y, axis.p2.z);
        svg.append('line').attr('x1', pt1.x).attr('y1', pt1.y).attr('x2', pt2.x).attr('y2', pt2.y).attr('stroke', axis.color).attr('stroke-width', 1).attr('stroke-dasharray', '4,4').attr('opacity', 0.4);
      });

      svg.selectAll('path').data(polygons).join('path').attr('d', d => `M${d.points[0].x},${d.points[0].y} L${d.points[1].x},${d.points[1].y} L${d.points[2].x},${d.points[2].y} L${d.points[3].x},${d.points[3].y} Z`).attr('fill', d => color(d.val)).attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 0.5);

      if (iterations.length > 1) {
        const pathPoints = iterations.map(it => project(it.point.x, it.point.y, zScale(it.value)));
        const line = d3.line<any>().x(d => d.x).y(d => d.y);
        svg.append('path').datum(pathPoints).attr('fill', 'none').attr('stroke', 'red').attr('stroke-width', 3).attr('d', line);
        const start = pathPoints[0];
        const end = pathPoints[pathPoints.length - 1];
        svg.append('circle').attr('cx', start.x).attr('cy', start.y).attr('r', 5).attr('fill', 'green');
        svg.append('circle').attr('cx', end.x).attr('cy', end.y).attr('r', 5).attr('fill', 'blue');
      } else if (startPoint) {
        const start = project(startPoint.x, startPoint.y, zScale(evaluate(expr, startPoint)));
        svg.append('circle').attr('cx', start.x).attr('cy', start.y).attr('r', 5).attr('fill', 'green');
      }
      
      setLoading(false);
    }, 10);

    return () => clearTimeout(timer);
  }, [expr, iterations, range, angles, scale, startPoint]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setAngles(prev => ({
      x: Math.max(0, Math.min(90, prev.x + dy * 0.5)),
      z: prev.z + dx * 0.5
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(50, Math.min(500, prev - e.deltaY * 0.5)));
  };

  return (
    <div 
      className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 cursor-move overflow-hidden flex flex-col items-center justify-center w-full aspect-square"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg 
        ref={svgRef} 
        viewBox="0 0 600 600" 
        className={cn("w-full h-full pointer-events-none transition-opacity duration-300", loading ? "opacity-20" : "opacity-100")}
      />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); setAngles({ x: 60, z: 45 }); setScale(240); }}
          className="p-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
          title="重置视角"
        >
          <RotateCcw className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <p className="text-center text-xs text-slate-400 mt-2">拖拽旋转，滚轮缩放</p>
    </div>
  );
};

export default SurfacePlot;
