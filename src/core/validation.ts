import { z } from 'zod';

/**
 * ルート設定のスキーマ
 */
export const RouteConfigSchema = z.object({
  provider: z.string().min(1),
  path: z.string().startsWith('/'),
  forwardUrl: z.string().url(),
  secret: z.string().optional(),
  enabled: z.boolean(),
  description: z.string().optional(),
});

/**
 * 設定ファイル全体のスキーマ
 */
export const ConfigSchema = z.object({
  routes: z.array(RouteConfigSchema),
  settings: z
    .object({
      logging: z
        .object({
          enabled: z.boolean(),
          storageType: z.enum(['file', 'database']),
          retentionDays: z.number().int().positive(),
        })
        .optional(),
      forwarding: z
        .object({
          timeout: z.number().int().positive(),
          retryCount: z.number().int().min(0),
          retryDelay: z.number().int().positive(),
        })
        .optional(),
      security: z
        .object({
          allowedIps: z.array(z.string()),
          rateLimit: z
            .object({
              enabled: z.boolean(),
              max: z.number().int().positive(),
              window: z.number().int().positive(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Webhook受信時のペイロードスキーマ（基本的なバリデーション）
 */
export const WebhookPayloadSchema = z.object({
  // 任意のJSONオブジェクトを受け付ける
}).passthrough();

/**
 * 環境変数のスキーマ（参考実装）
 * 実際の環境変数検証は必要に応じて実装
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  PORT: z.string().optional(),
  HOST: z.string().optional(),
  ROUTES_CONFIG_PATH: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  LOG_DIR: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;
