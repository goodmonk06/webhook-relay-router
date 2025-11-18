/**
 * Adapter Interfaces
 *
 * Defines extension points for plugging in external systems
 */

import { WebhookEvent } from '../domain/webhook-event';

/**
 * Notification Adapter - Send alerts about webhook events
 */
export interface INotificationAdapter {
  sendAlert(event: WebhookEvent, message: string): Promise<void>;
}

/**
 * Metrics Adapter - Send metrics to external monitoring systems
 */
export interface IMetricsAdapter {
  recordMetric(name: string, value: number, labels?: Record<string, string>): Promise<void>;
}

/**
 * Storage Adapter - Persist webhook events to external storage
 */
export interface IStorageAdapter {
  save(event: WebhookEvent): Promise<WebhookEvent>;
  findById(id: string): Promise<WebhookEvent | null>;
  query(filters: Record<string, unknown>): Promise<WebhookEvent[]>;
}

/**
 * Transformation Adapter - Custom transformation logic
 */
export interface ITransformationAdapter {
  transform(payload: unknown, context: Record<string, unknown>): Promise<unknown>;
}

/**
 * Authentication Adapter - Verify webhook authenticity beyond signatures
 */
export interface IAuthAdapter {
  authenticate(event: WebhookEvent): Promise<boolean>;
}

// ==================== Implementations ====================

/**
 * Console Notification Adapter (for development)
 */
export class ConsoleNotificationAdapter implements INotificationAdapter {
  async sendAlert(event: WebhookEvent, message: string): Promise<void> {
    console.log(`🚨 ALERT: ${message}`);
    console.log(`Event ID: ${event.id}, Provider: ${event.provider}`);
  }
}

/**
 * No-op Metrics Adapter (stub implementation)
 */
export class NoopMetricsAdapter implements IMetricsAdapter {
  async recordMetric(_name: string, _value: number, _labels?: Record<string, string>): Promise<void> {
    // No-op - replace with Prometheus/StatsD/etc in production
  }
}

/**
 * Identity Transformation Adapter (no transformation)
 */
export class IdentityTransformationAdapter implements ITransformationAdapter {
  async transform(payload: unknown): Promise<unknown> {
    return payload;
  }
}

/**
 * Always-allow Auth Adapter (stub implementation)
 */
export class AllowAllAuthAdapter implements IAuthAdapter {
  async authenticate(_event: WebhookEvent): Promise<boolean> {
    return true;
  }
}

/**
 * Adapter Registry - Central place to register and retrieve adapters
 */
export class AdapterRegistry {
  private static adapters: Map<string, unknown> = new Map();

  static register<T>(name: string, adapter: T): void {
    this.adapters.set(name, adapter);
  }

  static get<T>(name: string): T | undefined {
    return this.adapters.get(name) as T | undefined;
  }

  static getOrDefault<T>(name: string, defaultAdapter: T): T {
    return (this.adapters.get(name) as T) || defaultAdapter;
  }
}

// Register default adapters
AdapterRegistry.register('notification', new ConsoleNotificationAdapter());
AdapterRegistry.register('metrics', new NoopMetricsAdapter());
AdapterRegistry.register('transformation', new IdentityTransformationAdapter());
AdapterRegistry.register('auth', new AllowAllAuthAdapter());