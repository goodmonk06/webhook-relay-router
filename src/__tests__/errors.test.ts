import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ConfigError,
  ForwardError,
  formatError,
} from '../core/errors';

describe('AppError', () => {
  it('should create error with default status code', () => {
    const error = new AppError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBeUndefined();
  });

  it('should create error with custom status code', () => {
    const error = new AppError('Test error', 404, 'NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('ValidationError', () => {
  it('should create validation error with 400 status', () => {
    const error = new ValidationError('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should store validation details', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new ValidationError('Invalid input', details);
    expect(error.details).toEqual(details);
  });
});

describe('UnauthorizedError', () => {
  it('should create unauthorized error with 401 status', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should accept custom message', () => {
    const error = new UnauthorizedError('Invalid token');
    expect(error.message).toBe('Invalid token');
  });
});

describe('ConfigError', () => {
  it('should create config error with 500 status', () => {
    const error = new ConfigError('Invalid config');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('CONFIG_ERROR');
  });
});

describe('ForwardError', () => {
  it('should create forward error with 502 status', () => {
    const error = new ForwardError('Failed to forward');
    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('FORWARD_ERROR');
  });

  it('should store error details', () => {
    const details = { url: 'https://example.com', timeout: true };
    const error = new ForwardError('Failed to forward', details);
    expect(error.details).toEqual(details);
  });
});

describe('formatError', () => {
  it('should format standard Error', () => {
    const error = new Error('Standard error');
    const formatted = formatError(error);

    expect(formatted.error).toBe('Error');
    expect(formatted.message).toBe('Standard error');
    expect(formatted.statusCode).toBe(500);
    expect(formatted.timestamp).toBeDefined();
  });

  it('should format AppError with status code', () => {
    const error = new AppError('Custom error', 404, 'NOT_FOUND');
    const formatted = formatError(error);

    expect(formatted.statusCode).toBe(404);
    expect(formatted.code).toBe('NOT_FOUND');
  });

  it('should include validation details', () => {
    const details = { field: 'email' };
    const error = new ValidationError('Invalid', details);
    const formatted = formatError(error);

    expect(formatted.details).toEqual(details);
    expect(formatted.statusCode).toBe(400);
  });

  it('should include forward error details', () => {
    const details = { url: 'https://example.com' };
    const error = new ForwardError('Failed', details);
    const formatted = formatError(error);

    expect(formatted.details).toEqual(details);
    expect(formatted.statusCode).toBe(502);
  });
});
