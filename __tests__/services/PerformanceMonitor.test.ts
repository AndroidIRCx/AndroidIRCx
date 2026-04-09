/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for PerformanceMonitor service
 */

import {
  performanceMonitor,
  PerformanceMonitor,
} from '../../src/services/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.reset();
    performanceMonitor.setEnabled(true);
  });

  describe('initialization', () => {
    it('should initialize with default metrics', () => {
      const metrics = performanceMonitor.getMetrics();

      expect(metrics.appStartTime).toBeGreaterThan(0);
      expect(metrics.renderMetrics.totalRenders).toBe(0);
      expect(metrics.renderMetrics.slowRenders).toBe(0);
      expect(metrics.renderMetrics.renderHistory).toEqual([]);
      expect(metrics.customMarks).toEqual([]);
    });

    it('should allow creating new instance', () => {
      const monitor = new PerformanceMonitor();
      const metrics = monitor.getMetrics();

      expect(metrics.appStartTime).toBeGreaterThan(0);
    });
  });

  describe('markStart and markEnd', () => {
    it('should record duration between marks', () => {
      performanceMonitor.markStart('test-operation');

      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {} // Busy wait ~10ms

      const duration = performanceMonitor.markEnd('test-operation');

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(100); // Should be quick in tests
    });

    it('should store mark with metadata', () => {
      performanceMonitor.markStart('with-metadata');
      performanceMonitor.markEnd('with-metadata', {
        userId: 123,
        action: 'test',
      });

      const metrics = performanceMonitor.getMetrics();
      const mark = metrics.customMarks.find(m => m.name === 'with-metadata');

      expect(mark).toBeDefined();
      expect(mark?.metadata).toEqual({ userId: 123, action: 'test' });
    });

    it('should return null when ending non-existent mark', () => {
      const duration = performanceMonitor.markEnd('non-existent');
      expect(duration).toBeNull();
    });

    it('should return null when disabled', () => {
      performanceMonitor.setEnabled(false);
      performanceMonitor.markStart('disabled-test');
      const duration = performanceMonitor.markEnd('disabled-test');
      expect(duration).toBeNull();
    });
  });

  describe('mark', () => {
    it('should record simple mark without duration', () => {
      performanceMonitor.mark('simple-mark', { info: 'data' });

      const metrics = performanceMonitor.getMetrics();
      const mark = metrics.customMarks.find(m => m.name === 'simple-mark');

      expect(mark).toBeDefined();
      expect(mark?.duration).toBeUndefined();
      expect(mark?.metadata).toEqual({ info: 'data' });
    });

    it('should not record when disabled', () => {
      performanceMonitor.setEnabled(false);
      performanceMonitor.mark('disabled-mark');

      const metrics = performanceMonitor.getMetrics();
      const mark = metrics.customMarks.find(m => m.name === 'disabled-mark');

      expect(mark).toBeUndefined();
    });
  });

  describe('markAppReady', () => {
    it('should mark app ready time', () => {
      performanceMonitor.markAppReady();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.appReadyTime).toBeGreaterThan(0);
      expect(metrics.totalStartupTime).toBeGreaterThanOrEqual(0);
    });

    it('should only mark once', () => {
      performanceMonitor.markAppReady();
      const firstReadyTime = performanceMonitor.getMetrics().appReadyTime;

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {}

      performanceMonitor.markAppReady();
      const secondReadyTime = performanceMonitor.getMetrics().appReadyTime;

      expect(firstReadyTime).toBe(secondReadyTime);
    });

    it('should not mark when disabled', () => {
      performanceMonitor.setEnabled(false);
      performanceMonitor.markAppReady();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.appReadyTime).toBeUndefined();
    });
  });

  describe('markFirstRender', () => {
    it('should mark first render time', () => {
      performanceMonitor.markFirstRender();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.firstRenderTime).toBeGreaterThan(0);
    });

    it('should only mark once', () => {
      performanceMonitor.markFirstRender();
      const firstTime = performanceMonitor.getMetrics().firstRenderTime;

      performanceMonitor.markFirstRender();
      const secondTime = performanceMonitor.getMetrics().firstRenderTime;

      expect(firstTime).toBe(secondTime);
    });
  });

  describe('markInitialDataLoaded', () => {
    it('should mark initial data load time', () => {
      performanceMonitor.markInitialDataLoaded();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.initialDataLoadTime).toBeGreaterThan(0);
    });

    it('should only mark once', () => {
      performanceMonitor.markInitialDataLoaded();
      const firstTime = performanceMonitor.getMetrics().initialDataLoadTime;

      performanceMonitor.markInitialDataLoaded();
      const secondTime = performanceMonitor.getMetrics().initialDataLoadTime;

      expect(firstTime).toBe(secondTime);
    });
  });

  describe('render tracking', () => {
    it('should track render time', () => {
      performanceMonitor.startRender();

      // Simulate render work
      const start = Date.now();
      while (Date.now() - start < 5) {}

      performanceMonitor.endRender();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.renderMetrics.totalRenders).toBe(1);
    });

    it('should track multiple renders', () => {
      for (let i = 0; i < 5; i++) {
        performanceMonitor.startRender();
        performanceMonitor.endRender();
      }

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.renderMetrics.totalRenders).toBe(5);
    });

    it('should calculate average render time', () => {
      performanceMonitor.startRender();
      performanceMonitor.endRender();
      performanceMonitor.startRender();
      performanceMonitor.endRender();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.renderMetrics.averageRenderTime).toBeGreaterThanOrEqual(0);
    });

    it('should limit render history to 100 entries', () => {
      for (let i = 0; i < 150; i++) {
        performanceMonitor.startRender();
        performanceMonitor.endRender();
      }

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.renderMetrics.renderHistory.length).toBe(100);
    });

    it('should not track render if start was not called', () => {
      performanceMonitor.endRender();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.renderMetrics.totalRenders).toBe(0);
    });

    it('should not track when disabled', () => {
      performanceMonitor.setEnabled(false);
      performanceMonitor.startRender();
      performanceMonitor.endRender();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.renderMetrics.totalRenders).toBe(0);
    });
  });

  describe('measureMemory', () => {
    it('should measure memory if available', () => {
      // Mock performance.memory if available
      const mockMemory = {
        jsHeapSizeLimit: 2000000000,
        totalJSHeapSize: 1000000000,
        usedJSHeapSize: 500000000,
      };

      Object.defineProperty(global, 'performance', {
        value: { memory: mockMemory },
        configurable: true,
      });

      performanceMonitor.measureMemory();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryMetrics).toBeDefined();
      expect(metrics.memoryMetrics?.jsHeapSizeLimit).toBe(2000000000);
      expect(metrics.memoryMetrics?.usedJSHeapSize).toBe(500000000);
    });
  });

  describe('getReport', () => {
    it('should generate performance report', () => {
      performanceMonitor.markAppReady();
      performanceMonitor.startRender();
      performanceMonitor.endRender();

      const report = performanceMonitor.getReport();

      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.summary.totalMarks).toBeGreaterThanOrEqual(0);
    });

    it('should recommend for slow startup', () => {
      // Manually set a slow startup
      const monitor = new PerformanceMonitor();
      // @ts-ignore - accessing private property for test
      monitor.metrics.totalStartupTime = 5000;

      const report = monitor.getReport();

      const hasStartupRec = report.recommendations.some(r =>
        r.includes('startup time'),
      );
      expect(hasStartupRec).toBe(true);
    });

    it('should recommend for slow renders', () => {
      // Simulate many slow renders
      for (let i = 0; i < 20; i++) {
        performanceMonitor.startRender();
        const start = Date.now();
        while (Date.now() - start < 20) {} // 20ms render
        performanceMonitor.endRender();
      }

      const report = performanceMonitor.getReport();

      const hasSlowRenderRec = report.recommendations.some(
        r => r.includes('slow') || r.includes('React.memo'),
      );
      expect(hasSlowRenderRec).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return copy of metrics', () => {
      const metrics1 = performanceMonitor.getMetrics();
      const metrics2 = performanceMonitor.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  describe('logReport', () => {
    it('should log report to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      performanceMonitor.logReport();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance Report'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics as JSON', () => {
      performanceMonitor.mark('test-mark');

      const json = performanceMonitor.exportMetrics();
      const parsed = JSON.parse(json);

      expect(parsed.appStartTime).toBeDefined();
      expect(parsed.customMarks).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      performanceMonitor.markAppReady();
      performanceMonitor.mark('test-mark');
      performanceMonitor.startRender();
      performanceMonitor.endRender();

      const beforeReset = performanceMonitor.getMetrics();
      expect(beforeReset.appReadyTime).toBeDefined();

      performanceMonitor.reset();

      const afterReset = performanceMonitor.getMetrics();
      expect(afterReset.appReadyTime).toBeUndefined();
      expect(afterReset.customMarks).toEqual([]);
      expect(afterReset.renderMetrics.totalRenders).toBe(0);
    });

    it('should reset with new start time', () => {
      const beforeStart = performanceMonitor.getMetrics().appStartTime;

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {}

      performanceMonitor.reset();

      const afterStart = performanceMonitor.getMetrics().appStartTime;
      expect(afterStart).toBeGreaterThanOrEqual(beforeStart);
    });
  });

  describe('setEnabled', () => {
    it('should enable and disable monitoring', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      performanceMonitor.setEnabled(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('enabled'),
      );

      performanceMonitor.setEnabled(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('disabled'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getMarksByPrefix', () => {
    it('should return marks matching prefix', () => {
      performanceMonitor.mark('api/user/load');
      performanceMonitor.mark('api/post/load');
      performanceMonitor.mark('ui/click');

      const apiMarks = performanceMonitor.getMarksByPrefix('api/');

      expect(apiMarks).toHaveLength(2);
      expect(apiMarks.every(m => m.name.startsWith('api/'))).toBe(true);
    });

    it('should return empty array for non-matching prefix', () => {
      performanceMonitor.mark('test');

      const marks = performanceMonitor.getMarksByPrefix('nonexistent/');

      expect(marks).toEqual([]);
    });
  });

  describe('getAverageDuration', () => {
    it('should calculate average duration for marks', () => {
      // Create multiple marks with same name
      performanceMonitor.markStart('operation');
      performanceMonitor.markEnd('operation');

      performanceMonitor.markStart('operation');
      performanceMonitor.markEnd('operation');

      performanceMonitor.markStart('operation');
      performanceMonitor.markEnd('operation');

      const avg = performanceMonitor.getAverageDuration('operation');
      expect(avg).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for non-existent marks', () => {
      const avg = performanceMonitor.getAverageDuration('non-existent');
      expect(avg).toBe(0);
    });

    it('should only include marks with duration', () => {
      performanceMonitor.mark('no-duration');

      const avg = performanceMonitor.getAverageDuration('no-duration');
      expect(avg).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle markEnd without corresponding markStart', () => {
      const duration = performanceMonitor.markEnd('orphan');
      expect(duration).toBeNull();
    });

    it('should handle rapid mark operations', () => {
      for (let i = 0; i < 100; i++) {
        performanceMonitor.markStart(`op-${i}`);
        performanceMonitor.markEnd(`op-${i}`);
      }

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.customMarks).toHaveLength(100);
    });

    it('should handle multiple marks with same name', () => {
      performanceMonitor.markStart('duplicate');
      performanceMonitor.markEnd('duplicate');

      performanceMonitor.markStart('duplicate');
      performanceMonitor.markEnd('duplicate');

      const marks = performanceMonitor
        .getMetrics()
        .customMarks.filter(m => m.name === 'duplicate');
      expect(marks).toHaveLength(2);
    });
  });
});
