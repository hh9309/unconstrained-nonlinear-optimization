import * as math from 'mathjs';

export type Point = { x: number; y: number };
export type Iteration = {
  k: number;
  point: Point;
  value: number;
  gradient: Point;
  direction: Point;
  stepSize: number;
};

export interface OptimizationResult {
  iterations: Iteration[];
  converged: boolean;
  message: string;
}

/**
 * Evaluates a function f(x, y) at a given point.
 * Uses a cache for compiled expressions to improve performance.
 */
const compileCache = new Map<string, math.EvalFunction>();

export function evaluate(expr: string, point: Point): number {
  try {
    let compiled = compileCache.get(expr);
    if (!compiled) {
      compiled = math.compile(expr);
      compileCache.set(expr, compiled);
    }
    const scope = { x: point.x, y: point.y };
    return compiled.evaluate(scope);
  } catch (e) {
    // Don't log every error to avoid console flooding during typing
    return NaN;
  }
}

/**
 * Calculates the gradient of f(x, y) at a given point using numerical differentiation.
 */
export function gradient(expr: string, point: Point, h = 1e-7): Point {
  const f = (p: Point) => evaluate(expr, p);
  const dfdx = (f({ x: point.x + h, y: point.y }) - f({ x: point.x - h, y: point.y })) / (2 * h);
  const dfdy = (f({ x: point.x, y: point.y + h }) - f({ x: point.x, y: point.y - h })) / (2 * h);
  return { x: dfdx, y: dfdy };
}

/**
 * Calculates the Hessian matrix of f(x, y) at a given point.
 */
export function hessian(expr: string, point: Point, h = 1e-4): [[number, number], [number, number]] {
  const f = (p: Point) => evaluate(expr, p);
  
  // fxx
  const fxx = (f({ x: point.x + h, y: point.y }) - 2 * f(point) + f({ x: point.x - h, y: point.y })) / (h * h);
  // fyy
  const fyy = (f({ x: point.x, y: point.y + h }) - 2 * f(point) + f({ x: point.x, y: point.y - h })) / (h * h);
  // fxy
  const fxy = (f({ x: point.x + h, y: point.y + h }) - f({ x: point.x + h, y: point.y - h }) - f({ x: point.x - h, y: point.y + h }) + f({ x: point.x - h, y: point.y - h })) / (4 * h * h);
  
  return [[fxx, fxy], [fxy, fyy]];
}

/**
 * Line search using backtracking (Armijo condition).
 */
export function lineSearch(
  expr: string,
  point: Point,
  direction: Point,
  grad: Point,
  alpha = 1.0,
  beta = 0.5,
  c = 1e-4
): number {
  const f = (p: Point) => evaluate(expr, p);
  const currentVal = f(point);
  const dotGradDir = grad.x * direction.x + grad.y * direction.y;

  let step = alpha;
  for (let i = 0; i < 20; i++) {
    const nextPoint = {
      x: point.x + step * direction.x,
      y: point.y + step * direction.y,
    };
    if (f(nextPoint) <= currentVal + c * step * dotGradDir) {
      return step;
    }
    step *= beta;
  }
  return step;
}

/**
 * Performs a single step of Steepest Descent.
 */
export function steepestDescentStep(
  expr: string,
  current: Point,
  k: number,
  tol = 1e-6
): Iteration | { converged: true; iteration: Iteration } | { error: string } {
  const val = evaluate(expr, current);
  const grad = gradient(expr, current);
  
  if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
    return { error: '数值计算错误 (NaN)' };
  }

  const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);
  if (gradNorm < tol) {
    return {
      converged: true,
      iteration: { k, point: { ...current }, value: val, gradient: grad, direction: { x: 0, y: 0 }, stepSize: 0 }
    };
  }

  const direction = { x: -grad.x, y: -grad.y };
  const stepSize = lineSearch(expr, current, direction, grad);

  return { k, point: { ...current }, value: val, gradient: grad, direction, stepSize };
}

/**
 * Performs a single step of Newton's Method.
 */
export function newtonStep(
  expr: string,
  current: Point,
  k: number,
  tol = 1e-6
): Iteration | { converged: true; iteration: Iteration } | { error: string } {
  const val = evaluate(expr, current);
  const grad = gradient(expr, current);

  if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
    return { error: '数值计算错误 (NaN)' };
  }

  const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);
  if (gradNorm < tol) {
    return {
      converged: true,
      iteration: { k, point: { ...current }, value: val, gradient: grad, direction: { x: 0, y: 0 }, stepSize: 0 }
    };
  }

  const H = hessian(expr, current);
  const det = H[0][0] * H[1][1] - H[0][1] * H[1][0];
  
  let direction: Point;
  if (Math.abs(det) < 1e-10 || isNaN(det)) {
    direction = { x: -grad.x, y: -grad.y };
  } else {
    const invH = [
      [H[1][1] / det, -H[0][1] / det],
      [-H[1][0] / det, H[0][0] / det]
    ];
    direction = {
      x: -(invH[0][0] * grad.x + invH[0][1] * grad.y),
      y: -(invH[1][0] * grad.x + invH[1][1] * grad.y)
    };
  }

  const dotGradDir = grad.x * direction.x + grad.y * direction.y;
  if (dotGradDir > 0 || isNaN(dotGradDir)) {
    direction = { x: -grad.x, y: -grad.y };
  }

  const stepSize = lineSearch(expr, current, direction, grad);
  return { k, point: { ...current }, value: val, gradient: grad, direction, stepSize };
}

/**
 * Performs a single step of Conjugate Gradient.
 */
export function conjugateGradientStep(
  expr: string,
  current: Point,
  k: number,
  prevGrad: Point | null,
  prevDir: Point,
  tol = 1e-6
): Iteration | { converged: true; iteration: Iteration } | { error: string } {
  const val = evaluate(expr, current);
  const grad = gradient(expr, current);

  if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
    return { error: '数值计算错误 (NaN)' };
  }

  const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);
  if (gradNorm < tol) {
    return {
      converged: true,
      iteration: { k, point: { ...current }, value: val, gradient: grad, direction: { x: 0, y: 0 }, stepSize: 0 }
    };
  }

  let d: Point;
  if (k === 0 || !prevGrad) {
    d = { x: -grad.x, y: -grad.y };
  } else {
    const num = grad.x * (grad.x - prevGrad.x) + grad.y * (grad.y - prevGrad.y);
    const den = prevGrad.x ** 2 + prevGrad.y ** 2;
    const beta = Math.max(0, num / (den || 1e-10));
    d = {
      x: -grad.x + beta * prevDir.x,
      y: -grad.y + beta * prevDir.y,
    };
    if (grad.x * d.x + grad.y * d.y > 0) {
      d = { x: -grad.x, y: -grad.y };
    }
  }

  const stepSize = lineSearch(expr, current, d, grad);
  return { k, point: { ...current }, value: val, gradient: grad, direction: d, stepSize };
}

/**
 * Performs a single step of BFGS.
 */
export function bfgsStep(
  expr: string,
  current: Point,
  k: number,
  B_inv: number[][],
  tol = 1e-6
): (Iteration & { nextB_inv: number[][] }) | { converged: true; iteration: Iteration } | { error: string } {
  const val = evaluate(expr, current);
  const grad = gradient(expr, current);

  if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
    return { error: '数值计算错误 (NaN)' };
  }

  const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);
  if (gradNorm < tol) {
    return {
      converged: true,
      iteration: { k, point: { ...current }, value: val, gradient: grad, direction: { x: 0, y: 0 }, stepSize: 0 }
    };
  }

  const d: Point = {
    x: -(B_inv[0][0] * grad.x + B_inv[0][1] * grad.y),
    y: -(B_inv[1][0] * grad.x + B_inv[1][1] * grad.y)
  };

  let finalD = d;
  let currentB_inv = B_inv;
  if (grad.x * d.x + grad.y * d.y > 0 || isNaN(d.x) || isNaN(d.y)) {
    finalD = { x: -grad.x, y: -grad.y };
    currentB_inv = [[1, 0], [0, 1]];
  }

  const stepSize = lineSearch(expr, current, finalD, grad);
  const nextPoint = {
    x: current.x + stepSize * finalD.x,
    y: current.y + stepSize * finalD.y,
  };
  const nextGrad = gradient(expr, nextPoint);

  const s = { x: nextPoint.x - current.x, y: nextPoint.y - current.y };
  const y = { x: nextGrad.x - grad.x, y: nextGrad.y - grad.y };
  const sy = s.x * y.x + s.y * y.y;

  let nextB_inv = currentB_inv;
  if (sy > 1e-10) {
    const rho = 1 / sy;
    const V = [
      [1 - rho * s.x * y.x, -rho * s.x * y.y],
      [-rho * s.y * y.x, 1 - rho * s.y * y.y]
    ];
    const C = [
      [V[0][0] * currentB_inv[0][0] + V[0][1] * currentB_inv[1][0], V[0][0] * currentB_inv[0][1] + V[0][1] * currentB_inv[1][1]],
      [V[1][0] * currentB_inv[0][0] + V[1][1] * currentB_inv[1][0], V[1][0] * currentB_inv[0][1] + V[1][1] * currentB_inv[1][1]]
    ];
    const D = [
      [C[0][0] * V[0][0] + C[0][1] * V[0][1], C[0][0] * V[1][0] + C[0][1] * V[1][1]],
      [C[1][0] * V[0][0] + C[1][1] * V[0][1], C[1][0] * V[1][0] + C[1][1] * V[1][1]]
    ];
    nextB_inv = [
      [D[0][0] + rho * s.x * s.x, D[0][1] + rho * s.x * s.y],
      [D[1][0] + rho * s.y * s.x, D[1][1] + rho * s.y * s.y]
    ];
  }

  return { k, point: { ...current }, value: val, gradient: grad, direction: finalD, stepSize, nextB_inv };
}

/**
 * Steepest Descent (Gradient Descent)
 */
export function steepestDescent(
  expr: string,
  start: Point,
  tol = 1e-6,
  maxIter = 100
): OptimizationResult {
  const iterations: Iteration[] = [];
  let current = { ...start };

  for (let k = 0; k < maxIter; k++) {
    const val = evaluate(expr, current);
    const grad = gradient(expr, current);
    
    if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
      return { iterations, converged: false, message: '数值计算错误 (NaN)' };
    }

    const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);

    if (gradNorm < tol) {
      iterations.push({
        k,
        point: { ...current },
        value: val,
        gradient: grad,
        direction: { x: 0, y: 0 },
        stepSize: 0,
      });
      return { iterations, converged: true, message: '收敛成功' };
    }

    const direction = { x: -grad.x, y: -grad.y };
    const stepSize = lineSearch(expr, current, direction, grad);

    iterations.push({
      k,
      point: { ...current },
      value: val,
      gradient: grad,
      direction,
      stepSize,
    });

    current.x += stepSize * direction.x;
    current.y += stepSize * direction.y;
  }

  return { iterations, converged: false, message: '达到最大迭代次数' };
}

/**
 * Newton's Method
 */
export function newtonMethod(
  expr: string,
  start: Point,
  tol = 1e-6,
  maxIter = 100
): OptimizationResult {
  const iterations: Iteration[] = [];
  let current = { ...start };

  for (let k = 0; k < maxIter; k++) {
    const val = evaluate(expr, current);
    const grad = gradient(expr, current);

    if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
      return { iterations, converged: false, message: '数值计算错误 (NaN)' };
    }

    const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);

    if (gradNorm < tol) {
      iterations.push({
        k,
        point: { ...current },
        value: val,
        gradient: grad,
        direction: { x: 0, y: 0 },
        stepSize: 0,
      });
      return { iterations, converged: true, message: '收敛成功' };
    }

    const H = hessian(expr, current);
    const det = H[0][0] * H[1][1] - H[0][1] * H[1][0];
    
    let direction: Point;
    if (Math.abs(det) < 1e-10 || isNaN(det)) {
      // Fallback to gradient descent if Hessian is singular
      direction = { x: -grad.x, y: -grad.y };
    } else {
      // Solve H * d = -grad => d = -H^-1 * grad
      // Inverse of 2x2: [[d, -b], [-c, a]] / det
      const invH = [
        [H[1][1] / det, -H[0][1] / det],
        [-H[1][0] / det, H[0][0] / det]
      ];
      direction = {
        x: -(invH[0][0] * grad.x + invH[0][1] * grad.y),
        y: -(invH[1][0] * grad.x + invH[1][1] * grad.y)
      };
    }

    // Check if direction is a descent direction
    const dotGradDir = grad.x * direction.x + grad.y * direction.y;
    if (dotGradDir > 0 || isNaN(dotGradDir)) {
      direction = { x: -grad.x, y: -grad.y };
    }

    const stepSize = lineSearch(expr, current, direction, grad);

    iterations.push({
      k,
      point: { ...current },
      value: val,
      gradient: grad,
      direction,
      stepSize,
    });

    current.x += stepSize * direction.x;
    current.y += stepSize * direction.y;
  }

  return { iterations, converged: false, message: '达到最大迭代次数' };
}

/**
 * Conjugate Gradient Method (Polak-Ribiere)
 */
export function conjugateGradient(
  expr: string,
  start: Point,
  tol = 1e-6,
  maxIter = 100
): OptimizationResult {
  const iterations: Iteration[] = [];
  let current = { ...start };
  let prevGrad: Point | null = null;
  let d: Point = { x: 0, y: 0 };

  for (let k = 0; k < maxIter; k++) {
    const val = evaluate(expr, current);
    const grad = gradient(expr, current);

    if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
      return { iterations, converged: false, message: '数值计算错误 (NaN)' };
    }

    const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);

    if (gradNorm < tol) {
      iterations.push({
        k,
        point: { ...current },
        value: val,
        gradient: grad,
        direction: { x: 0, y: 0 },
        stepSize: 0,
      });
      return { iterations, converged: true, message: '收敛成功' };
    }

    if (k === 0) {
      d = { x: -grad.x, y: -grad.y };
    } else if (prevGrad) {
      // Polak-Ribiere beta
      const num = grad.x * (grad.x - prevGrad.x) + grad.y * (grad.y - prevGrad.y);
      const den = prevGrad.x ** 2 + prevGrad.y ** 2;
      const beta = Math.max(0, num / (den || 1e-10));
      d = {
        x: -grad.x + beta * d.x,
        y: -grad.y + beta * d.y,
      };
      
      // Reset if not a descent direction
      if (grad.x * d.x + grad.y * d.y > 0) {
        d = { x: -grad.x, y: -grad.y };
      }
    }

    const stepSize = lineSearch(expr, current, d, grad);

    iterations.push({
      k,
      point: { ...current },
      value: val,
      gradient: grad,
      direction: d,
      stepSize,
    });

    current.x += stepSize * d.x;
    current.y += stepSize * d.y;
    prevGrad = grad;
  }

  return { iterations, converged: false, message: '达到最大迭代次数' };
}

/**
 * Quasi-Newton Method (BFGS)
 */
export function bfgsMethod(
  expr: string,
  start: Point,
  tol = 1e-6,
  maxIter = 100
): OptimizationResult {
  const iterations: Iteration[] = [];
  let current = { ...start };
  
  // Initial Hessian approximation: Identity matrix
  let B_inv = [[1, 0], [0, 1]];

  for (let k = 0; k < maxIter; k++) {
    const val = evaluate(expr, current);
    const grad = gradient(expr, current);

    if (isNaN(val) || isNaN(grad.x) || isNaN(grad.y)) {
      return { iterations, converged: false, message: '数值计算错误 (NaN)' };
    }

    const gradNorm = Math.sqrt(grad.x ** 2 + grad.y ** 2);

    if (gradNorm < tol) {
      iterations.push({
        k,
        point: { ...current },
        value: val,
        gradient: grad,
        direction: { x: 0, y: 0 },
        stepSize: 0,
      });
      return { iterations, converged: true, message: '收敛成功' };
    }

    // Search direction: d = -B_inv * grad
    const d: Point = {
      x: -(B_inv[0][0] * grad.x + B_inv[0][1] * grad.y),
      y: -(B_inv[1][0] * grad.x + B_inv[1][1] * grad.y)
    };

    // Ensure descent direction
    let finalD = d;
    if (grad.x * d.x + grad.y * d.y > 0 || isNaN(d.x) || isNaN(d.y)) {
      finalD = { x: -grad.x, y: -grad.y };
      B_inv = [[1, 0], [0, 1]]; // Reset Hessian
    }

    const stepSize = lineSearch(expr, current, finalD, grad);
    const nextPoint = {
      x: current.x + stepSize * finalD.x,
      y: current.y + stepSize * finalD.y,
    };
    const nextGrad = gradient(expr, nextPoint);

    iterations.push({
      k,
      point: { ...current },
      value: val,
      gradient: grad,
      direction: finalD,
      stepSize,
    });

    // BFGS Update
    const s = { x: nextPoint.x - current.x, y: nextPoint.y - current.y };
    const y = { x: nextGrad.x - grad.x, y: nextGrad.y - grad.y };
    const sy = s.x * y.x + s.y * y.y;

    if (sy > 1e-10) {
      const rho = 1 / sy;
      
      const V = [
        [1 - rho * s.x * y.x, -rho * s.x * y.y],
        [-rho * s.y * y.x, 1 - rho * s.y * y.y]
      ];

      const C = [
        [V[0][0] * B_inv[0][0] + V[0][1] * B_inv[1][0], V[0][0] * B_inv[0][1] + V[0][1] * B_inv[1][1]],
        [V[1][0] * B_inv[0][0] + V[1][1] * B_inv[1][0], V[1][0] * B_inv[0][1] + V[1][1] * B_inv[1][1]]
      ];
      
      const D = [
        [C[0][0] * V[0][0] + C[0][1] * V[0][1], C[0][0] * V[1][0] + C[0][1] * V[1][1]],
        [C[1][0] * V[0][0] + C[1][1] * V[0][1], C[1][0] * V[1][0] + C[1][1] * V[1][1]]
      ];

      B_inv = [
        [D[0][0] + rho * s.x * s.x, D[0][1] + rho * s.x * s.y],
        [D[1][0] + rho * s.y * s.x, D[1][1] + rho * s.y * s.y]
      ];
    }

    current = nextPoint;
  }

  return { iterations, converged: false, message: '达到最大迭代次数' };
}
