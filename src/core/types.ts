import { FastifyRequest } from 'fastify';

/**
 * ルート設定
 */
export interface RouteConfig {
  provider: string;
  path: string;
  forwardUrl: string;
  secret?: string;
  enabled: boolean;
  description?: string;
}

/**
 * 設定ファイル全体
 */
export interface Config {
  routes: RouteConfig[];
  settings?: {
    logging?: {
      enabled: boolean;
      storageType: 'file' | 'database';
      retentionDays: number;
    };
    forwarding?: {
      timeout: number;
      retryCount: number;
      retryDelay: number;
    };
    security?: {
      allowedIps: string[];
      rateLimit?: {
        enabled: boolean;
        max: number;
        window: number;
      };
    };
  };
}

/**
 * 署名検証の結果
 */
export interface VerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * 署名検証インターフェース
 */
export interface SignatureVerifier {
  verify(request: FastifyRequest, secret: string): Promise<VerificationResult>;
}

/**
 * Webhookログ
 */
export interface WebhookLog {
  id?: string;
  timestamp: Date;
  provider: string;
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  statusCode?: number;
  forwardUrl?: string;
  forwardSuccess?: boolean;
  forwardResponse?: unknown;
  error?: string;
}
