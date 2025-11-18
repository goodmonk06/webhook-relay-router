/**
 * Webhook Event Store
 *
 * Persistent storage for webhook events with query capabilities
 * For Phase 3, using file-based storage (JSONlines). Can be replaced with DB later.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WebhookEvent, WebhookEventStatus } from '../domain/webhook-event';
import { randomUUID } from 'crypto';

export interface WebhookQuery {
  provider?: string;
  status?: WebhookEventStatus;
  fromDate?: Date;
  toDate?: Date;
  correlationId?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

export interface WebhookStats {
  totalEvents: number;
  byProvider: Record<string, number>;
  byStatus: Record<string, number>;
  avgProcessingDuration?: number;
  successRate: number;
}

export class WebhookEventStore {
  private storePath: string;

  constructor(storePath: string = './data/webhooks') {
    this.storePath = storePath;

    // Ensure directory exists
    if (!fs.existsSync(storePath)) {
      fs.mkdirSync(storePath, { recursive: true });
    }
  }

  /**
   * Save a webhook event
   */
  async save(event: WebhookEvent): Promise<WebhookEvent> {
    if (!event.id) {
      event.id = randomUUID();
    }

    if (!event.correlationId) {
      event.correlationId = randomUUID();
    }

    const dateStr = event.receivedAt.toISOString().split('T')[0];
    const eventFile = path.join(this.storePath, `events-${dateStr}.jsonl`);

    // Append to file
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(eventFile, line, 'utf8');

    return event;
  }

  /**
   * Find event by ID
   */
  async findById(id: string): Promise<WebhookEvent | null> {
    // Search through all event files
    const files = fs.readdirSync(this.storePath)
      .filter(f => f.startsWith('events-') && f.endsWith('.jsonl'))
      .sort()
      .reverse(); // Most recent first

    for (const file of files) {
      const filePath = path.join(this.storePath, file);
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const event = JSON.parse(line) as WebhookEvent;
        if (event.id === id) {
          // Parse dates
          event.receivedAt = new Date(event.receivedAt);
          if (event.forwardedAt) event.forwardedAt = new Date(event.forwardedAt);
          if (event.nextRetryAt) event.nextRetryAt = new Date(event.nextRetryAt);
          if (event.lastRetryAt) event.lastRetryAt = new Date(event.lastRetryAt);
          return event;
        }
      }
    }

    return null;
  }

  /**
   * Query webhook events
   */
  async query(query: WebhookQuery): Promise<WebhookEvent[]> {
    const results: WebhookEvent[] = [];
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Determine which files to scan based on date range
    let files = fs.readdirSync(this.storePath)
      .filter(f => f.startsWith('events-') && f.endsWith('.jsonl'))
      .sort()
      .reverse(); // Most recent first

    if (query.fromDate || query.toDate) {
      files = files.filter(file => {
        const dateMatch = file.match(/events-(\d{4}-\d{2}-\d{2})\.jsonl/);
        if (!dateMatch) return false;

        const fileDate = new Date(dateMatch[1]);
        if (query.fromDate && fileDate < query.fromDate) return false;
        if (query.toDate && fileDate > query.toDate) return false;
        return true;
      });
    }

    let skipped = 0;

    for (const file of files) {
      if (results.length >= limit) break;

      const filePath = path.join(this.storePath, file);
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const event = JSON.parse(line) as WebhookEvent;

        // Apply filters
        if (query.provider && event.provider !== query.provider) continue;
        if (query.status && event.status !== query.status) continue;
        if (query.correlationId && event.correlationId !== query.correlationId) continue;
        if (query.tenantId && event.tenantId !== query.tenantId) continue;

        // Skip offset
        if (skipped < offset) {
          skipped++;
          continue;
        }

        // Parse dates
        event.receivedAt = new Date(event.receivedAt);
        if (event.forwardedAt) event.forwardedAt = new Date(event.forwardedAt);
        if (event.nextRetryAt) event.nextRetryAt = new Date(event.nextRetryAt);
        if (event.lastRetryAt) event.lastRetryAt = new Date(event.lastRetryAt);

        results.push(event);

        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Get statistics
   */
  async getStats(query?: Partial<WebhookQuery>): Promise<WebhookStats> {
    const events = await this.query({
      ...query,
      limit: 10000, // Large number to get all for stats
    });

    const byProvider: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;
    let successCount = 0;

    for (const event of events) {
      byProvider[event.provider] = (byProvider[event.provider] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;

      if (event.processingDuration) {
        totalDuration += event.processingDuration;
        durationCount++;
      }

      if (event.status === WebhookEventStatus.DELIVERED) {
        successCount++;
      }
    }

    return {
      totalEvents: events.length,
      byProvider,
      byStatus,
      avgProcessingDuration: durationCount > 0 ? totalDuration / durationCount : undefined,
      successRate: events.length > 0 ? successCount / events.length : 0,
    };
  }

  /**
   * Update an existing event
   */
  async update(id: string, updates: Partial<WebhookEvent>): Promise<WebhookEvent | null> {
    const event = await this.findById(id);
    if (!event) return null;

    // For simplicity, append the updated event as a new line
    // In production, use a proper database
    const updated = { ...event, ...updates };
    await this.save(updated);

    return updated;
  }

  /**
   * Delete old events (cleanup)
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = fs.readdirSync(this.storePath)
      .filter(f => f.startsWith('events-') && f.endsWith('.jsonl'));

    let deletedCount = 0;

    for (const file of files) {
      const dateMatch = file.match(/events-(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (!dateMatch) continue;

      const fileDate = new Date(dateMatch[1]);
      if (fileDate < cutoffDate) {
        const filePath = path.join(this.storePath, file);
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}