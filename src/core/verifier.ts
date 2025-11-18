import { FastifyRequest } from 'fastify';
import { SignatureVerifier, VerificationResult } from './types';
import * as crypto from 'crypto';

/**
 * 署名検証なしのベースVerifier
 */
export class NoopVerifier implements SignatureVerifier {
  async verify(_request: FastifyRequest, _secret: string): Promise<VerificationResult> {
    return { valid: true };
  }
}

/**
 * Stripe用の署名検証
 * https://stripe.com/docs/webhooks/signatures
 */
export class StripeVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    try {
      const signature = request.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return { valid: false, error: 'Missing stripe-signature header' };
      }

      const body = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

      // Stripe署名の解析
      const elements = signature.split(',');
      const signatureData: Record<string, string> = {};

      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureData[key] = value;
      }

      const timestamp = signatureData.t;
      const expectedSignature = signatureData.v1;

      if (!timestamp || !expectedSignature) {
        return { valid: false, error: 'Invalid signature format' };
      }

      // 署名の計算
      const payload = `${timestamp}.${body}`;
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // タイミング攻撃を防ぐため、crypto.timingSafeEqualを使用
      const valid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(computedSignature)
      );

      // タイムスタンプのチェック（5分以内）
      const tolerance = 300; // 5分
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampNum = parseInt(timestamp, 10);

      if (currentTime - timestampNum > tolerance) {
        return { valid: false, error: 'Timestamp too old' };
      }

      return { valid };
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * GitHub用の署名検証
 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export class GitHubVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    try {
      const signature = request.headers['x-hub-signature-256'];
      if (!signature || typeof signature !== 'string') {
        return { valid: false, error: 'Missing x-hub-signature-256 header' };
      }

      const body = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

      // 署名の計算
      const computedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      // タイミング攻撃を防ぐため、crypto.timingSafeEqualを使用
      const valid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
      );

      return { valid };
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Verifierのファクトリ
 */
export class VerifierFactory {
  private static verifiers: Record<string, SignatureVerifier> = {
    stripe: new StripeVerifier(),
    github: new GitHubVerifier(),
    generic: new NoopVerifier(),
  };

  static getVerifier(provider: string): SignatureVerifier {
    const verifier = this.verifiers[provider.toLowerCase()];
    if (!verifier) {
      console.warn(`No verifier found for provider: ${provider}, using NoopVerifier`);
      return new NoopVerifier();
    }
    return verifier;
  }

  static registerVerifier(provider: string, verifier: SignatureVerifier): void {
    this.verifiers[provider.toLowerCase()] = verifier;
  }
}
