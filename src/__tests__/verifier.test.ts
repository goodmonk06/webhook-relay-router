import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { StripeVerifier, GitHubVerifier, NoopVerifier, VerifierFactory } from '../core/verifier';
import type { FastifyRequest } from 'fastify';

describe('StripeVerifier', () => {
  const verifier = new StripeVerifier();
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: {} });

  it('should validate correct Stripe signature', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    const mockRequest = {
      headers: {
        'stripe-signature': `t=${timestamp},v1=${signature}`,
      },
      body: payload,
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, secret);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid Stripe signature', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongSignature = 'invalid_signature';

    const mockRequest = {
      headers: {
        'stripe-signature': `t=${timestamp},v1=${wrongSignature}`,
      },
      body: payload,
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject missing signature header', async () => {
    const mockRequest = {
      headers: {},
      body: payload,
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing stripe-signature header');
  });

  it('should reject old timestamp', async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6分前
    const signedPayload = `${oldTimestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    const mockRequest = {
      headers: {
        'stripe-signature': `t=${oldTimestamp},v1=${signature}`,
      },
      body: payload,
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Timestamp too old');
  });
});

describe('GitHubVerifier', () => {
  const verifier = new GitHubVerifier();
  const secret = 'github_secret';
  const payload = JSON.stringify({ action: 'opened', pull_request: {} });

  it('should validate correct GitHub signature', async () => {
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const mockRequest = {
      headers: {
        'x-hub-signature-256': signature,
      },
      body: payload,
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, secret);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid GitHub signature', async () => {
    const mockRequest = {
      headers: {
        'x-hub-signature-256': 'sha256=invalid_signature',
      },
      body: payload,
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, secret);
    expect(result.valid).toBe(false);
  });

  it('should reject missing signature header', async () => {
    const mockRequest = {
      headers: {},
      body: payload,
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing x-hub-signature-256 header');
  });
});

describe('NoopVerifier', () => {
  const verifier = new NoopVerifier();

  it('should always return valid', async () => {
    const mockRequest = {
      headers: {},
      body: {},
    } as unknown as FastifyRequest;

    const result = await verifier.verify(mockRequest, '');
    expect(result.valid).toBe(true);
  });
});

describe('VerifierFactory', () => {
  it('should return StripeVerifier for stripe provider', () => {
    const verifier = VerifierFactory.getVerifier('stripe');
    expect(verifier).toBeInstanceOf(StripeVerifier);
  });

  it('should return GitHubVerifier for github provider', () => {
    const verifier = VerifierFactory.getVerifier('github');
    expect(verifier).toBeInstanceOf(GitHubVerifier);
  });

  it('should return NoopVerifier for generic provider', () => {
    const verifier = VerifierFactory.getVerifier('generic');
    expect(verifier).toBeInstanceOf(NoopVerifier);
  });

  it('should return NoopVerifier for unknown provider', () => {
    const verifier = VerifierFactory.getVerifier('unknown');
    expect(verifier).toBeInstanceOf(NoopVerifier);
  });

  it('should allow registering custom verifier', () => {
    class CustomVerifier extends NoopVerifier {}
    VerifierFactory.registerVerifier('custom', new CustomVerifier());

    const verifier = VerifierFactory.getVerifier('custom');
    expect(verifier).toBeInstanceOf(CustomVerifier);
  });
});
