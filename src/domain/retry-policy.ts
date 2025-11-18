/**
 * Retry Policy Domain Entity
 *
 * Defines retry behavior for failed webhook deliveries
 */

export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR = 'linear',
  FIXED = 'fixed',
  CUSTOM = 'custom',
}

export interface RetryPolicy {
  id: string;
  name: string;
  description?: string;

  // Matching criteria
  provider?: string; // null = default policy
  path?: string;

  // Strategy
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay?: number; // milliseconds (cap for exponential)
  multiplier?: number; // For exponential (default 2)

  // Conditions
  retryableStatusCodes?: number[]; // e.g., [500, 502, 503, 504]
  retryableErrors?: string[]; // Error codes/messages to retry

  // Dead letter queue
  deadLetterQueueEnabled: boolean;
  deadLetterQueueUrl?: string;

  // Metadata
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Calculate next retry delay based on policy
 */
export function calculateRetryDelay(
  policy: RetryPolicy,
  currentRetryCount: number
): number {
  switch (policy.strategy) {
    case RetryStrategy.EXPONENTIAL_BACKOFF: {
      const multiplier = policy.multiplier || 2;
      const delay = policy.initialDelay * Math.pow(multiplier, currentRetryCount);
      return policy.maxDelay ? Math.min(delay, policy.maxDelay) : delay;
    }

    case RetryStrategy.LINEAR: {
      const multiplier = policy.multiplier || 1;
      const delay = policy.initialDelay + (policy.initialDelay * multiplier * currentRetryCount);
      return policy.maxDelay ? Math.min(delay, policy.maxDelay) : delay;
    }

    case RetryStrategy.FIXED:
      return policy.initialDelay;

    case RetryStrategy.CUSTOM:
      // For custom strategies, return initial delay
      // In real implementation, this would call a user-defined function
      return policy.initialDelay;

    default:
      return policy.initialDelay;
  }
}

/**
 * Check if an error/status is retryable according to policy
 */
export function isRetryable(
  policy: RetryPolicy,
  statusCode?: number,
  error?: string
): boolean {
  if (statusCode && policy.retryableStatusCodes?.includes(statusCode)) {
    return true;
  }

  if (error && policy.retryableErrors?.some(pattern => error.includes(pattern))) {
    return true;
  }

  // Default retryable status codes if not specified
  if (!policy.retryableStatusCodes && !policy.retryableErrors) {
    return statusCode ? statusCode >= 500 : true;
  }

  return false;
}