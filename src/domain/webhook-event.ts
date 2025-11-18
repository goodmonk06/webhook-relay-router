/**
 * Webhook Event Domain Entity
 *
 * Represents a single webhook event with full lifecycle tracking
 */

export enum WebhookEventStatus {
  RECEIVED = 'received',
  VALIDATED = 'validated',
  FORWARDING = 'forwarding',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DEAD_LETTER = 'dead_letter',
}

export interface WebhookEvent {
  id: string;
  correlationId: string; // For tracking across systems
  provider: string;
  path: string;
  method: string;

  // Request data
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: string; // For signature verification

  // Metadata
  receivedAt: Date;
  sourceIp?: string;
  userAgent?: string;

  // Processing
  status: WebhookEventStatus;
  signatureValid?: boolean;
  validationError?: string;

  // Forwarding
  forwardUrl?: string;
  forwardedAt?: Date;
  forwardDuration?: number; // milliseconds
  forwardStatusCode?: number;
  forwardResponse?: unknown;
  forwardError?: string;

  // Retry tracking
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  lastRetryAt?: Date;

  // Transformation
  transformed?: boolean;
  transformationApplied?: string; // Rule name
  originalBody?: unknown;

  // Analytics
  processingDuration?: number; // milliseconds
  tenantId?: string; // For multi-tenant support
  tags?: string[];
}