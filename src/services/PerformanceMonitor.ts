/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * PerformanceMonitor.ts
 *
 * Comprehensive performance monitoring for React Native app.
 * Tracks startup time, render performance, memory usage, and custom metrics.
 */

export interface PerformanceMark {
  name: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  appStartTime: number;
  appReadyTime?: number;
  firstRenderTime?: number;
  initialDataLoadTime?: number;
  totalStartupTime?: number;
  renderMetrics: RenderMetrics;
  customMarks: PerformanceMark[];
  memoryMetrics?: MemoryMetrics;
}

export interface RenderMetrics {
  totalRenders: number;
  slowRenders: number; // > 16ms (60fps)
  averageRenderTime: number;
  maxRenderTime: number;
  renderHistory: number[]; // Last 100 render times
}

export interface MemoryMetrics {
  jsHeapSizeLimit?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
  timestamp: number;
}

export interface PerformanceReport {
  summary: {
    startupTime: number;
    averageRenderTime: number;
    slowRenderPercentage: number;
    totalMarks: number;
  };
  details: PerformanceMetrics;
  recommendations: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private marks: Map<string, number> = new Map();
  private renderStartTime: number = 0;
  private readonly SLOW_RENDER_THRESHOLD = 16; // ms (60fps)
  private readonly MAX_RENDER_HISTORY = 100;
  private enabled: boolean = true;

  constructor() {
    this.metrics = {
      appStartTime: Date.now(),
      renderMetrics: {
        totalRenders: 0,
        slowRenders: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        renderHistory: [],
      },
      customMarks: [],
    };
  }

  /**
   * Mark the start of a performance measurement
   */
  markStart(name: string): void {
    if (!this.enabled) return;
    this.marks.set(name, Date.now());
  }

  /**
   * Mark the end of a performance measurement and record duration
   */
  markEnd(name: string, metadata?: Record<string, any>): number | null {
    if (!this.enabled) return null;

    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`PerformanceMonitor: No start mark found for "${name}"`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.metrics.customMarks.push({
      name,
      timestamp: startTime,
      duration,
      metadata,
    });

    this.marks.delete(name);
    return duration;
  }

  /**
   * Record a performance mark without duration
   */
  mark(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    this.metrics.customMarks.push({
      name,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * Mark app as ready (fully loaded)
   */
  markAppReady(): void {
    if (!this.enabled || this.metrics.appReadyTime) return;

    this.metrics.appReadyTime = Date.now();
    this.metrics.totalStartupTime =
      this.metrics.appReadyTime - this.metrics.appStartTime;

    console.log(`✅ App ready in ${this.metrics.totalStartupTime}ms`);
  }

  /**
   * Mark first render complete
   */
  markFirstRender(): void {
    if (!this.enabled || this.metrics.firstRenderTime) return;

    this.metrics.firstRenderTime = Date.now();
    const timeToFirstRender =
      this.metrics.firstRenderTime - this.metrics.appStartTime;

    console.log(`🎨 First render in ${timeToFirstRender}ms`);
  }

  /**
   * Mark initial data load complete
   */
  markInitialDataLoaded(): void {
    if (!this.enabled || this.metrics.initialDataLoadTime) return;

    this.metrics.initialDataLoadTime = Date.now();
    const dataLoadTime =
      this.metrics.initialDataLoadTime - this.metrics.appStartTime;

    console.log(`📊 Initial data loaded in ${dataLoadTime}ms`);
  }

  /**
   * Start tracking a render
   */
  startRender(): void {
    if (!this.enabled) return;
    this.renderStartTime = Date.now();
  }

  /**
   * End tracking a render and record metrics
   */
  endRender(): void {
    if (!this.enabled || !this.renderStartTime) return;

    const renderTime = Date.now() - this.renderStartTime;
    this.renderStartTime = 0;

    const { renderMetrics } = this.metrics;
    renderMetrics.totalRenders++;

    // Update render history
    renderMetrics.renderHistory.push(renderTime);
    if (renderMetrics.renderHistory.length > this.MAX_RENDER_HISTORY) {
      renderMetrics.renderHistory.shift();
    }

    // Update metrics
    if (renderTime > this.SLOW_RENDER_THRESHOLD) {
      renderMetrics.slowRenders++;
    }

    if (renderTime > renderMetrics.maxRenderTime) {
      renderMetrics.maxRenderTime = renderTime;
    }

    // Recalculate average
    const sum = renderMetrics.renderHistory.reduce((a, b) => a + b, 0);
    renderMetrics.averageRenderTime = sum / renderMetrics.renderHistory.length;

    // Warn about slow renders
    if (renderTime > this.SLOW_RENDER_THRESHOLD * 2) {
      console.warn(`⚠️ Slow render detected: ${renderTime}ms`);
    }
  }

  /**
   * Measure memory usage (if available)
   */
  measureMemory(): void {
    if (!this.enabled) return;

    // @ts-ignore - performance.memory may not be available in all environments
    if (typeof performance !== 'undefined' && performance.memory) {
      // @ts-ignore
      const memory = performance.memory;
      this.metrics.memoryMetrics = {
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get a performance report with recommendations
   */
  getReport(): PerformanceReport {
    const recommendations: string[] = [];

    // Startup time recommendations
    if (this.metrics.totalStartupTime && this.metrics.totalStartupTime > 3000) {
      recommendations.push(
        'App startup time > 3s. Consider lazy loading or code splitting.',
      );
    }

    // Render performance recommendations
    const slowRenderPercentage =
      (this.metrics.renderMetrics.slowRenders /
        Math.max(1, this.metrics.renderMetrics.totalRenders)) *
      100;

    if (slowRenderPercentage > 10) {
      recommendations.push(
        `${slowRenderPercentage.toFixed(1)}% of renders are slow (>16ms). Consider optimizing components with React.memo or useMemo.`,
      );
    }

    if (this.metrics.renderMetrics.maxRenderTime > 100) {
      recommendations.push(
        `Maximum render time is ${this.metrics.renderMetrics.maxRenderTime}ms. This may cause UI jank.`,
      );
    }

    // Memory recommendations
    if (this.metrics.memoryMetrics) {
      const usagePercentage =
        ((this.metrics.memoryMetrics.usedJSHeapSize || 0) /
          Math.max(1, this.metrics.memoryMetrics.jsHeapSizeLimit || 1)) *
        100;

      if (usagePercentage > 80) {
        recommendations.push(
          `JS heap usage is ${usagePercentage.toFixed(1)}%. Risk of memory pressure.`,
        );
      }
    }

    return {
      summary: {
        startupTime: this.metrics.totalStartupTime || 0,
        averageRenderTime: this.metrics.renderMetrics.averageRenderTime,
        slowRenderPercentage,
        totalMarks: this.metrics.customMarks.length,
      },
      details: this.metrics,
      recommendations,
    };
  }

  /**
   * Log performance report to console
   */
  logReport(): void {
    const report = this.getReport();

    console.log('\n📊 Performance Report:');
    console.log('====================');
    console.log(`Startup Time: ${report.summary.startupTime}ms`);
    console.log(
      `Average Render Time: ${report.summary.averageRenderTime.toFixed(2)}ms`,
    );
    console.log(
      `Slow Renders: ${report.summary.slowRenderPercentage.toFixed(1)}%`,
    );
    console.log(`Total Custom Marks: ${report.summary.totalMarks}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    console.log('====================\n');
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      appStartTime: Date.now(),
      renderMetrics: {
        totalRenders: 0,
        slowRenders: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        renderHistory: [],
      },
      customMarks: [],
    };
    this.marks.clear();
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      console.log('✅ Performance monitoring enabled');
    } else {
      console.log('⏸️ Performance monitoring disabled');
    }
  }

  /**
   * Get marks by name prefix
   */
  getMarksByPrefix(prefix: string): PerformanceMark[] {
    return this.metrics.customMarks.filter(mark =>
      mark.name.startsWith(prefix),
    );
  }

  /**
   * Get average duration for marks with specific name
   */
  getAverageDuration(name: string): number {
    const marks = this.metrics.customMarks.filter(
      mark => mark.name === name && mark.duration !== undefined,
    );

    if (marks.length === 0) return 0;

    const sum = marks.reduce((total, mark) => total + (mark.duration || 0), 0);
    return sum / marks.length;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export class for testing
export { PerformanceMonitor };
