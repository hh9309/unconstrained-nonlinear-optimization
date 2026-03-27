import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Play, 
  RotateCcw, 
  ChevronRight, 
  ChevronDown, 
  Table as TableIcon, 
  LineChart, 
  Info,
  Zap,
  Target,
  BookOpen
} from 'lucide-react';
import { 
  steepestDescent, 
  newtonMethod, 
  conjugateGradient,
  bfgsMethod,
  steepestDescentStep,
  newtonStep,
  conjugateGradientStep,
  bfgsStep,
  Point, 
  Iteration, 
  OptimizationResult 
} from './lib/optimization';
import ContourPlot from './components/ContourPlot';
import SurfacePlot from './components/SurfacePlot';
import AIAssistant from './components/AIAssistant';
import { cn } from './lib/utils';
import { type ClassValue } from 'clsx';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

const ALGORITHMS = [
  { id: 'steepest', name: '最速下降法', desc: '沿着负梯度方向搜索，简单但收敛慢。' },
  { id: 'newton', name: '牛顿法', desc: '利用二阶导数信息，具有二阶收敛速度。' },
  { id: 'cg', name: '共轭梯度法 (PR)', desc: '结合前一步搜索方向，对二次函数具有有限步收敛性。' },
  { id: 'bfgs', name: '拟牛顿法 (BFGS)', desc: '通过近似 Hessian 矩阵，平衡了收敛速度和计算量。' },
];

const EXAMPLES = [
  { name: 'Rosenbrock 函数', expr: '100 * (y - x^2)^2 + (1 - x)^2', start: { x: -1.2, y: 1 } },
  { name: '二次型函数', expr: 'x^2 + 2*y^2', start: { x: 2, y: 2 } },
  { name: 'Beale 函数', expr: '(1.5 - x + x*y)^2 + (2.25 - x + x*y^2)^2 + (2.625 - x + x*y^3)^2', start: { x: 1, y: 1 } },
];

export default function App() {
  const [expr, setExpr] = useState('x^2 + 2*y^2');
  const [algorithm, setAlgorithm] = useState('steepest');
  const [startX, setStartX] = useState(-2);
  const [startY, setStartY] = useState(-2);
  const [tol, setTol] = useState(1e-4);
  const [maxIter, setMaxIter] = useState(50);
  
  const [plotExpr, setPlotExpr] = useState('x^2 + 2*y^2');
  const [plotStart, setPlotStart] = useState<Point>({ x: -2, y: -2 });
  const [stage, setStage] = useState<'modeling' | 'ready' | 'finished'>('modeling');
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [bfgsH_inv, setBfgsH_inv] = useState<number[][]>([[1, 0], [0, 1]]);

  const runOptimization = () => {
    const start: Point = { x: startX, y: startY };
    let res: OptimizationResult;
    
    switch (algorithm) {
      case 'steepest': res = steepestDescent(expr, start, tol, maxIter); break;
      case 'newton': res = newtonMethod(expr, start, tol, maxIter); break;
      case 'cg': res = conjugateGradient(expr, start, tol, maxIter); break;
      case 'bfgs': res = bfgsMethod(expr, start, tol, maxIter); break;
      default: res = steepestDescent(expr, start, tol, maxIter);
    }
    
    setResult(res);
    setStage('finished');
  };

  const runSingleStep = () => {
    const currentIterations = result?.iterations || [];
    const k = currentIterations.length;
    
    if (k >= maxIter) {
      setResult(prev => prev ? { ...prev, converged: false, message: '达到最大迭代次数' } : null);
      setStage('finished');
      return;
    }

    const currentPoint = k === 0 ? { x: startX, y: startY } : currentIterations[k - 1].point;
    const nextPoint = k === 0 ? currentPoint : {
      x: currentPoint.x + currentIterations[k - 1].stepSize * currentIterations[k - 1].direction.x,
      y: currentPoint.y + currentIterations[k - 1].stepSize * currentIterations[k - 1].direction.y,
    };

    let stepResult: any;
    switch (algorithm) {
      case 'steepest':
        stepResult = steepestDescentStep(expr, nextPoint, k, tol);
        break;
      case 'newton':
        stepResult = newtonStep(expr, nextPoint, k, tol);
        break;
      case 'cg':
        const prevGrad = k > 0 ? currentIterations[k-1].gradient : null;
        const prevDir = k > 0 ? currentIterations[k-1].direction : { x: 0, y: 0 };
        stepResult = conjugateGradientStep(expr, nextPoint, k, prevGrad, prevDir, tol);
        break;
      case 'bfgs':
        stepResult = bfgsStep(expr, nextPoint, k, bfgsH_inv, tol);
        if ('nextB_inv' in stepResult) {
          setBfgsH_inv(stepResult.nextB_inv);
        }
        break;
    }

    if (stepResult.error) {
      setResult({ iterations: currentIterations, converged: false, message: stepResult.error });
      setStage('finished');
      return;
    }

    if (stepResult.converged) {
      setResult({ iterations: [...currentIterations, stepResult.iteration], converged: true, message: '收敛成功' });
      setStage('finished');
      return;
    }

    const newIteration: Iteration = {
      k: stepResult.k,
      point: stepResult.point,
      value: stepResult.value,
      gradient: stepResult.gradient,
      direction: stepResult.direction,
      stepSize: stepResult.stepSize
    };

    setResult({
      iterations: [...currentIterations, newIteration],
      converged: false,
      message: '正在迭代...'
    });
    setStage('finished'); // Keep it in finished state to show results, but we can continue stepping
  };

  useEffect(() => {
    // Initial run removed to respect the new workflow
    // runOptimization();
  }, []);

  const range = useMemo(() => {
    if (!result || result.iterations.length === 0) {
      // If not finished, center around plotStart
      const minX = plotStart.x - 3;
      const maxX = plotStart.x + 3;
      const minY = plotStart.y - 3;
      const maxY = plotStart.y + 3;
      return { x: [minX, maxX] as [number, number], y: [minY, maxY] as [number, number] };
    }
    const points = result.iterations.map(i => i.point);
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    
    const minX = Math.min(...xs, -2);
    const maxX = Math.max(...xs, 2);
    const minY = Math.min(...ys, -2);
    const maxY = Math.max(...ys, 2);
    
    const paddingX = Math.max(0.5, (maxX - minX) * 0.2);
    const paddingY = Math.max(0.5, (maxY - minY) * 0.2);
    
    return {
      x: [minX - paddingX, maxX + paddingX] as [number, number],
      y: [minY - paddingY, maxY + paddingY] as [number, number]
    };
  }, [result, plotStart]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Zap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">无约束最优化可视化平台</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Interactive Optimization Lab</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500",
              stage === 'modeling' 
                ? "bg-slate-50 border-slate-200 text-slate-400" 
                : "bg-green-50 border-green-100 text-green-600"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                stage === 'modeling' ? "bg-slate-300" : "bg-green-500 animate-pulse"
              )} />
              <span className="text-xs font-bold">系统就绪</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Function Input */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-slate-800">参数设置</h2>
                </div>
                <div className="flex gap-1">
                  {[
                    { id: 'modeling', label: '建模' },
                    { id: 'ready', label: '就绪' },
                    { id: 'finished', label: '完成' }
                  ].map((s, idx) => (
                    <div key={s.id} className="flex items-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                        stage === s.id 
                          ? "bg-blue-600 text-white ring-4 ring-blue-100" 
                          : idx < ['modeling', 'ready', 'finished'].indexOf(stage)
                            ? "bg-green-500 text-white"
                            : "bg-slate-100 text-slate-400"
                      )}>
                        {idx + 1}
                      </div>
                      {idx < 2 && <div className={cn("w-4 h-0.5 mx-1", idx < ['modeling', 'ready', 'finished'].indexOf(stage) ? "bg-green-500" : "bg-slate-100")} />}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">目标函数 f(x, y)</label>
                  <input 
                    type="text" 
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                    disabled={stage !== 'modeling'}
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm",
                      stage === 'modeling' ? "bg-slate-50 border-slate-200" : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    )}
                    placeholder="e.g. x^2 + y^2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.name}
                      disabled={stage !== 'modeling'}
                      onClick={() => {
                        setExpr(ex.expr);
                        setStartX(ex.start.x);
                        setStartY(ex.start.y);
                      }}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded-md transition-colors text-left border",
                        stage === 'modeling' 
                          ? "bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200" 
                          : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                      )}
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">选择算法</label>
                  <div className="grid grid-cols-1 gap-2">
                    {ALGORITHMS.map((alg) => (
                      <button
                        key={alg.id}
                        disabled={stage !== 'modeling'}
                        onClick={() => setAlgorithm(alg.id)}
                        className={cn(
                          "w-full p-3 rounded-xl border text-left transition-all group",
                          algorithm === alg.id 
                            ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200" 
                            : stage === 'modeling' 
                              ? "bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                              : "bg-slate-50 border-slate-100 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "font-bold text-sm", 
                            algorithm === alg.id 
                              ? "text-blue-700" 
                              : stage === 'modeling' ? "text-slate-700" : "text-slate-300"
                          )}>
                            {alg.name}
                          </span>
                          {algorithm === alg.id && <ChevronRight className="w-4 h-4 text-blue-500" />}
                        </div>
                        <p className={cn("text-[10px] mt-1 leading-relaxed", stage === 'modeling' ? "text-slate-500" : "text-slate-300")}>
                          {alg.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">起始点 X₀</label>
                    <input 
                      type="number" 
                      value={startX}
                      onChange={(e) => setStartX(parseFloat(e.target.value))}
                      disabled={stage !== 'modeling'}
                      className={cn(
                        "w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm",
                        stage === 'modeling' ? "bg-slate-50 border-slate-200" : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">起始点 Y₀</label>
                    <input 
                      type="number" 
                      value={startY}
                      onChange={(e) => setStartY(parseFloat(e.target.value))}
                      disabled={stage !== 'modeling'}
                      className={cn(
                        "w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm",
                        stage === 'modeling' ? "bg-slate-50 border-slate-200" : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => {
                        setPlotExpr(expr);
                        setPlotStart({ x: startX, y: startY });
                        setStage('ready');
                      }}
                      disabled={stage !== 'modeling'}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                        stage === 'modeling' 
                          ? "bg-slate-800 text-white hover:bg-slate-900 shadow-md" 
                          : "bg-slate-100 text-slate-300 cursor-not-allowed"
                      )}
                    >
                      <Settings className="w-4 h-4" />
                      建模完毕
                    </button>
                    
                    <button 
                      onClick={runOptimization}
                      disabled={stage !== 'ready'}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                        stage === 'ready' 
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200" 
                          : "bg-slate-100 text-slate-300 cursor-not-allowed"
                      )}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      启动计算
                    </button>

                    <button 
                      onClick={runSingleStep}
                      disabled={stage !== 'ready' && !(stage === 'finished' && result && !result.converged)}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                        (stage === 'ready' || (stage === 'finished' && result && !result.converged))
                          ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md" 
                          : "bg-slate-100 text-slate-300 cursor-not-allowed"
                      )}
                    >
                      <ChevronRight className="w-4 h-4" />
                      单步迭代
                    </button>

                    <button 
                      onClick={() => {
                        setResult(null);
                        setStage('modeling');
                        setBfgsH_inv([[1, 0], [0, 1]]);
                      }}
                      disabled={stage !== 'finished'}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                        stage === 'finished' 
                          ? "bg-orange-500 text-white hover:bg-orange-600 shadow-md" 
                          : "bg-slate-100 text-slate-300 cursor-not-allowed"
                      )}
                    >
                      <RotateCcw className="w-4 h-4" />
                      模型重置
                    </button>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Right Panel: Visualization & Results */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Visualization Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* 3D Surface Plot */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-5 h-5 text-blue-600" />
                    <h2 className="font-bold text-slate-800">三维表面图</h2>
                  </div>
                </div>
                <div className="p-4 flex justify-center bg-white">
                  <SurfacePlot 
                    expr={plotExpr} 
                    iterations={result?.iterations || []} 
                    range={range} 
                    startPoint={plotStart}
                  />
                </div>
              </div>

              {/* Contour Plot */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <h2 className="font-bold text-slate-800">等高线图</h2>
                  </div>
                </div>
                <div className="p-4 flex justify-center bg-white">
                  <ContourPlot 
                    expr={plotExpr} 
                    iterations={result?.iterations || []} 
                    range={range} 
                    startPoint={plotStart}
                  />
                </div>
              </div>
            </div>

            {/* Iteration Summary & Table */}
            {stage === 'finished' && result && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">迭代次数</p>
                    <p className="text-2xl font-bold text-slate-800">{result.iterations.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">最终函数值</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {result.iterations[result.iterations.length - 1]?.value.toFixed(6) || '-'}
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">状态</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={cn("w-2 h-2 rounded-full", result.converged ? "bg-green-500" : "bg-amber-500")} />
                      <p className="text-sm font-bold text-slate-700">{result.message || '计算完成'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <button 
                    onClick={() => setShowTable(!showTable)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <TableIcon className="w-5 h-5 text-blue-600" />
                      <h2 className="font-bold text-slate-800">详细迭代数据</h2>
                    </div>
                    {showTable ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  
                  {showTable && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-y border-slate-100">
                          <tr>
                            <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px]">k</th>
                            <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px]">点 (x, y)</th>
                            <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px]">函数值 f(x, y)</th>
                            <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px]">梯度范数 ||g||</th>
                            <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px]">步长 α</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {result.iterations.map((iter) => (
                            <tr key={iter.k} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-6 py-4 font-mono text-slate-400">{iter.k}</td>
                              <td className="px-6 py-4">
                                <span className="font-medium text-slate-700">
                                  ({iter.point.x.toFixed(4)}, {iter.point.y.toFixed(4)})
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-blue-600">{iter.value.toFixed(6)}</td>
                              <td className="px-6 py-4 text-slate-500">
                                {Math.sqrt(iter.gradient.x ** 2 + iter.gradient.y ** 2).toExponential(2)}
                              </td>
                              <td className="px-6 py-4 text-slate-500">{iter.stepSize.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Bottom Modules: AI Insight & Knowledge Guide */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* AI Assistant */}
              <AIAssistant 
                algorithm={ALGORITHMS.find(a => a.id === algorithm)?.name || ''} 
                expr={expr} 
                iterations={result?.iterations || []} 
              />

              {/* Knowledge Guide */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-slate-800">知识导引</h2>
                </div>
                
                <div className="space-y-4">
                  <section>
                    <h3 className="text-sm font-bold text-slate-700 mb-1">无约束最优化标准型</h3>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      无约束最优化问题的标准形式通常为：
                      <BlockMath math="\min f(x), \quad x \in \mathbb{R}^n" />
                      其中 <InlineMath math="f(x)" /> 是目标函数。我们的目标是找到一个点 <InlineMath math="x^*" />，使得对于所有 <InlineMath math="x" />，<InlineMath math="f(x^*) \le f(x)" />。
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-slate-700 mb-1">算法分类</h3>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                      <li><span className="font-bold">一阶方法：</span>仅利用梯度信息（如最速下降法）。</li>
                      <li><span className="font-bold">二阶方法：</span>利用 Hessian 矩阵信息（如牛顿法）。</li>
                      <li><span className="font-bold">拟牛顿法：</span>利用梯度近似 Hessian 矩阵（如 BFGS）。</li>
                      <li><span className="font-bold">共轭方向法：</span>介于一阶和二阶之间（如共轭梯度法）。</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-slate-700 mb-1">非线性规划核心概念</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      非线性规划研究目标函数或约束条件中包含非线性项的优化问题。核心关注点包括：
                      <span className="italic"> 局部最优与全局最优、凸性、收敛速度、数值稳定性等。</span>
                    </p>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-slate-700 mb-1">最优性条件</h3>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      对于无约束问题，一阶必要条件是梯度为零：
                      <BlockMath math="\nabla f(x^*) = 0" />
                      二阶充分条件是 Hessian 矩阵正定：
                      <BlockMath math="\nabla^2 f(x^*) \succ 0" />
                    </div>
                  </section>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-slate-400" />
            <p className="text-sm text-slate-500">© 2026 无约束最优化可视化平台</p>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">算法支持</p>
              <p className="text-sm text-slate-600 font-medium">梯度下降 / 牛顿法 / 共轭梯度 / BFGS</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">技术栈</p>
              <p className="text-sm text-slate-600 font-medium">React / D3.js / Math.js</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
