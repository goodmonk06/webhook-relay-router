import { describe, it, expect } from 'vitest';
import { ConfigSchema, RouteConfigSchema } from '../core/validation';

describe('RouteConfigSchema', () => {
  it('should validate valid route config', () => {
    const validRoute = {
      provider: 'stripe',
      path: '/webhook/stripe',
      forwardUrl: 'https://example.com/api',
      secret: 'secret123',
      enabled: true,
      description: 'Stripe webhooks',
    };

    const result = RouteConfigSchema.safeParse(validRoute);
    expect(result.success).toBe(true);
  });

  it('should reject route with invalid path', () => {
    const invalidRoute = {
      provider: 'stripe',
      path: 'invalid-path', // should start with /
      forwardUrl: 'https://example.com/api',
      enabled: true,
    };

    const result = RouteConfigSchema.safeParse(invalidRoute);
    expect(result.success).toBe(false);
  });

  it('should reject route with invalid URL', () => {
    const invalidRoute = {
      provider: 'stripe',
      path: '/webhook/stripe',
      forwardUrl: 'not-a-url',
      enabled: true,
    };

    const result = RouteConfigSchema.safeParse(invalidRoute);
    expect(result.success).toBe(false);
  });

  it('should accept route without optional fields', () => {
    const minimalRoute = {
      provider: 'generic',
      path: '/webhook/generic',
      forwardUrl: 'https://example.com/api',
      enabled: true,
    };

    const result = RouteConfigSchema.safeParse(minimalRoute);
    expect(result.success).toBe(true);
  });
});

describe('ConfigSchema', () => {
  it('should validate complete config', () => {
    const validConfig = {
      routes: [
        {
          provider: 'stripe',
          path: '/webhook/stripe',
          forwardUrl: 'https://example.com/api',
          secret: 'secret',
          enabled: true,
        },
      ],
      settings: {
        logging: {
          enabled: true,
          storageType: 'file',
          retentionDays: 30,
        },
        forwarding: {
          timeout: 10000,
          retryCount: 3,
          retryDelay: 1000,
        },
        security: {
          allowedIps: [],
          rateLimit: {
            enabled: true,
            max: 100,
            window: 60000,
          },
        },
      },
    };

    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should validate minimal config', () => {
    const minimalConfig = {
      routes: [
        {
          provider: 'generic',
          path: '/webhook/test',
          forwardUrl: 'https://example.com/api',
          enabled: true,
        },
      ],
    };

    const result = ConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
  });

  it('should reject config with invalid storage type', () => {
    const invalidConfig = {
      routes: [],
      settings: {
        logging: {
          enabled: true,
          storageType: 'invalid', // should be 'file' or 'database'
          retentionDays: 30,
        },
      },
    };

    const result = ConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject config with negative retention days', () => {
    const invalidConfig = {
      routes: [],
      settings: {
        logging: {
          enabled: true,
          storageType: 'file',
          retentionDays: -1,
        },
      },
    };

    const result = ConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });
});
