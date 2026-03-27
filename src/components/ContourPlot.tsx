import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Point, Iteration, evaluate } from '../lib/optimization';
import { cn } from '../lib/utils';

interface ContourPlotProps {
  expr: string;
  iterations: Iteration[];
  range: { x: [number, number]; y: [number, number] };
  startPoint?: Point;
}

const ContourPlot: React.FC<ContourPlotProps> = ({ expr, iterations, range, startPoint }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;

    setLoading(true);

    const timer = setTimeout(() => {
      const width = 600;
      const height = 600;
      const margin = { top: 20, right: 20, bottom: 40, left: 40 };

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const x = d3.scaleLinear().domain(range.x).range([margin.left, width - margin.right]);
      const y = d3.scaleLinear().domain(range.y).range([height - margin.bottom, margin.top]);

      // Generate grid for contours
      const n = 100;
      const m = 100;
      const values = new Array(n * m);
      for (let j = 0; j < m; ++j) {
        for (let i = 0; i < n; ++i) {
          const px = x.invert(margin.left + (i / (n - 1)) * (width - margin.left - margin.right));
          const py = y.invert(height - margin.bottom - (j / (m - 1)) * (height - margin.top - margin.bottom));
          values[j * n + i] = evaluate(expr, { x: px, y: py });
        }
      }

      const thresholds = d3.quantize(d3.interpolate(d3.min(values), d3.max(values)), 20);
      const contours = d3.contours().size([n, m]).thresholds(thresholds)(values);

      const color = d3.scaleSequential(d3.interpolateViridis).domain(d3.extent(values) as [number, number]);

      // Draw contours
      svg.append('g')
        .attr('fill', 'none')
        .attr('stroke', '#fff')
        .attr('stroke-opacity', 0.5)
        .selectAll('path')
        .data(contours)
        .join('path')
        .attr('fill', (d) => color(d.value))
        .attr('d', d3.geoPath().projection(d3.geoTransform({
          point: function(i, j) {
            this.stream.point(
              margin.left + (i / (n - 1)) * (width - margin.left - margin.right),
              height - margin.bottom - (j / (m - 1)) * (height - margin.top - margin.bottom)
            );
          }
        })));

      // Draw axes
      svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));

      svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

      // Draw optimization path
      if (iterations.length > 0) {
        const line = d3.line<Iteration>()
          .x((d) => x(d.point.x))
          .y((d) => y(d.point.y));

        svg.append('path')
          .datum(iterations)
          .attr('fill', 'none')
          .attr('stroke', 'red')
          .attr('stroke-width', 2)
          .attr('d', line);

        // Draw points
        svg.selectAll('.dot')
          .data(iterations)
          .join('circle')
          .attr('cx', (d) => x(d.point.x))
          .attr('cy', (d) => y(d.point.y))
          .attr('r', 3)
          .attr('fill', 'red');

        // Draw start point
        svg.append('circle')
          .attr('cx', x(iterations[0].point.x))
          .attr('cy', y(iterations[0].point.y))
          .attr('r', 5)
          .attr('fill', 'green');

        // Draw end point
        const last = iterations[iterations.length - 1];
        svg.append('circle')
          .attr('cx', x(last.point.x))
          .attr('cy', y(last.point.y))
          .attr('r', 5)
          .attr('fill', 'blue');
      } else if (startPoint) {
        // Draw only the start point if no iterations yet
        svg.append('circle')
          .attr('cx', x(startPoint.x))
          .attr('cy', y(startPoint.y))
          .attr('r', 5)
          .attr('fill', 'green');
      }
      
      setLoading(false);
    }, 10);

    return () => clearTimeout(timer);
  }, [expr, iterations, range, startPoint]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 relative">
      <svg 
        ref={svgRef} 
        width="600" 
        height="600" 
        className={cn("max-w-full h-auto transition-opacity duration-300", loading ? "opacity-20" : "opacity-100")} 
      />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
          <span>起点</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <span>终点</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <span>搜索路径</span>
        </div>
      </div>
    </div>
  );
};

export default ContourPlot;
