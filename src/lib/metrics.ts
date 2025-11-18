/**
 * Metrics Collection System
 *
 * Provides Prometheus-compatible metrics for monitoring
 */

export interface MetricLabels {
  [key: string]: string;
}

export interface Counter {
  name: string;
  help: string;
  value: number;
  labels?: MetricLabels;
}

export interface Histogram {
  name: string;
  help: string;
  buckets: number[];
  observations: number[];
  sum: number;
  count: number;
  labels?: MetricLabels;
}

export class MetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels?: MetricLabels, value: number = 1): void {
    const key = this.makeKey(name, labels);
    const existing = this.counters.get(key);

    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, {
        name,
        help: `Counter for ${name}`,
        value,
        labels,
      });
    }
  }

  /**
   * Observe a value in a histogram
   */
  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const key = this.makeKey(name, labels);
    const existing = this.histograms.get(key);

    if (existing) {
      existing.observations.push(value);
      existing.sum += value;
      existing.count++;
    } else {
      this.histograms.set(key, {
        name,
        help: `Histogram for ${name}`,
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        observations: [value],
        sum: value,
        count: 1,
        labels,
      });
    }
  }

  /**
   * Get all metrics in Prometheus text format
   */
  getMetrics(): string {
    let output = '';

    // Counters
    for (const counter of this.counters.values()) {
      output += `# HELP ${counter.name} ${counter.help}\n`;
      output += `# TYPE ${counter.name} counter\n`;
      output += `${counter.name}${this.formatLabels(counter.labels)} ${counter.value}\n`;
    }

    // Histograms
    for (const histogram of this.histograms.values()) {
      output += `# HELP ${histogram.name} ${histogram.help}\n`;
      output += `# TYPE ${histogram.name} histogram\n`;

      // Buckets
      const bucketed = this.bucketize(histogram.observations, histogram.buckets);
      for (let i = 0; i < histogram.buckets.length; i++) {
        const le = histogram.buckets[i];
        const count = bucketed[i];
        output += `${histogram.name}_bucket${this.formatLabels({
          ...histogram.labels,
          le: le.toString(),
        })} ${count}\n`;
      }

      // +Inf bucket
      output += `${histogram.name}_bucket${this.formatLabels({
        ...histogram.labels,
        le: '+Inf',
      })} ${histogram.count}\n`;

      // Sum and count
      output += `${histogram.name}_sum${this.formatLabels(histogram.labels)} ${histogram.sum}\n`;
      output += `${histogram.name}_count${this.formatLabels(histogram.labels)} ${histogram.count}\n`;
    }

    return output;
  }

  /**
   * Get metrics as JSON
   */
  getMetricsJSON(): { counters: Counter[]; histograms: Histogram[] } {
    return {
      counters: Array.from(this.counters.values()),
      histograms: Array.from(this.histograms.values()),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  private makeKey(name: string, labels?: MetricLabels): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private formatLabels(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) return '';
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `{${labelStr}}`;
  }

  private bucketize(observations: number[], buckets: number[]): number[] {
    const result = new Array(buckets.length).fill(0);
    for (const obs of observations) {
      for (let i = 0; i < buckets.length; i++) {
        if (obs <= buckets[i]) {
          result[i]++;
        }
      }
    }
    return result;
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Predefined metric names
export const MetricNames = {
  WEBHOOK_RECEIVED: 'webhook_received_total',
  WEBHOOK_PROCESSED: 'webhook_processed_total',
  WEBHOOK_FAILED: 'webhook_failed_total',
  WEBHOOK_RETRY: 'webhook_retry_total',
  WEBHOOK_DURATION: 'webhook_processing_duration_seconds',
  FORWARD_DURATION: 'webhook_forward_duration_seconds',
  SIGNATURE_VERIFICATION: 'webhook_signature_verification_total',
} as const;