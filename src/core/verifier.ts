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
 * Slack用の署名検証
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export class SlackVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    try {
      const signature = request.headers['x-slack-signature'];
      const timestamp = request.headers['x-slack-request-timestamp'];

      if (!signature || typeof signature !== 'string') {
        return { valid: false, error: 'Missing x-slack-signature header' };
      }

      if (!timestamp || typeof timestamp !== 'string') {
        return { valid: false, error: 'Missing x-slack-request-timestamp header' };
      }

      // Check timestamp to prevent replay attacks (within 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampNum = parseInt(timestamp, 10);
      if (Math.abs(currentTime - timestampNum) > 300) {
        return { valid: false, error: 'Request timestamp too old or in future' };
      }

      const body = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

      // Create signature base string
      const signatureBase = `v0:${timestamp}:${body}`;
      const computedSignature = 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(signatureBase)
        .digest('hex');

      // Timing-safe comparison
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
 * Shopify用の署名検証
 * https://shopify.dev/docs/apps/build/webhooks/subscribe/https#step-5-verify-the-webhook
 */
export class ShopifyVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    try {
      const signature = request.headers['x-shopify-hmac-sha256'];

      if (!signature || typeof signature !== 'string') {
        return { valid: false, error: 'Missing x-shopify-hmac-sha256 header' };
      }

      const body = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

      // Compute HMAC
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');

      // Timing-safe comparison
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
 * Twilio用の署名検証
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export class TwilioVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    try {
      const signature = request.headers['x-twilio-signature'];

      if (!signature || typeof signature !== 'string') {
        return { valid: false, error: 'Missing x-twilio-signature header' };
      }

      // Twilio sends form-encoded data, not JSON
      // For now, we'll handle JSON bodies and expect proper form handling in router
      // const body = typeof request.body === 'string'
      //   ? request.body
      //   : JSON.stringify(request.body);

      // Get full URL (Twilio includes this in signature)
      const url = `${request.protocol}://${request.hostname}${request.url}`;

      // Create signature string (URL + sorted params)
      let signatureString = url;
      if (typeof request.body === 'object' && request.body !== null) {
        const sortedKeys = Object.keys(request.body).sort();
        for (const key of sortedKeys) {
          signatureString += key + (request.body as Record<string, unknown>)[key];
        }
      }

      // Compute HMAC
      const computedSignature = crypto
        .createHmac('sha1', secret)
        .update(signatureString)
        .digest('base64');

      // Timing-safe comparison
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
 * SendGrid用の署名検証
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
export class SendGridVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    try {
      const signature = request.headers['x-twilio-email-event-webhook-signature'];
      const timestamp = request.headers['x-twilio-email-event-webhook-timestamp'];

      if (!signature || typeof signature !== 'string') {
        return { valid: false, error: 'Missing x-twilio-email-event-webhook-signature header' };
      }

      if (!timestamp || typeof timestamp !== 'string') {
        return { valid: false, error: 'Missing x-twilio-email-event-webhook-timestamp header' };
      }

      const body = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

      // Create signature payload
      const payload = timestamp + body;
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      // Timing-safe comparison
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
    slack: new SlackVerifier(),
    shopify: new ShopifyVerifier(),
    twilio: new TwilioVerifier(),
    sendgrid: new SendGridVerifier(),
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

  static getAllProviders(): string[] {
    return Object.keys(this.verifiers);
  }
}
