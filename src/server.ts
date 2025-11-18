import Fastify from 'fastify';
import { loadConfig, loadEnv } from './config/loader';
import { WebhookRouter } from './core/router';
import { WebhookLogger } from './core/logger';
import { formatError } from './core/errors';

// 環境変数を読み込む
loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const LOG_DIR = process.env.LOG_DIR || './logs';

/**
 * サーバーを起動
 */
async function start() {
  try {
    // 設定ファイルを読み込む
    const config = loadConfig();

    // Fastifyインスタンスを作成
    const fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
      // 生のボディを保持（署名検証のため）
      disableRequestLogging: false,
      bodyLimit: 1048576, // 1MB
    });

    // グローバルエラーハンドラー
    fastify.setErrorHandler((error, request, reply) => {
      const errorResponse = formatError(error);

      // エラーをログに記録
      request.log.error({
        err: error,
        url: request.url,
        method: request.method,
      }, 'Request error');

      reply.code(errorResponse.statusCode).send(errorResponse);
    });

    // Webhookロガーを作成
    const webhookLogger = new WebhookLogger(
      LOG_DIR,
      config.settings?.logging?.enabled ?? true
    );

    // ルーターを作成
    const router = new WebhookRouter(config, webhookLogger);

    // ルートを登録
    router.registerRoutes(fastify);

    // ヘルスチェックエンドポイント
    fastify.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    });

    // ルート情報エンドポイント
    fastify.get('/routes', async () => {
      return {
        routes: config.routes.map((route) => ({
          provider: route.provider,
          path: route.path,
          description: route.description,
          enabled: route.enabled,
        })),
      };
    });

    // グレースフルシャットダウン
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Received ${signal}, closing server...`);
        await fastify.close();
        process.exit(0);
      });
    });

    // 古いログファイルのクリーンアップ（起動時に1回実行）
    const retentionDays = config.settings?.logging?.retentionDays || 30;
    await webhookLogger.cleanupOldLogs(retentionDays);

    // サーバーを起動
    await fastify.listen({ port: PORT, host: HOST });

    fastify.log.info(`🚀 Webhook Relay Router is running!`);
    fastify.log.info(`📍 Server: http://${HOST}:${PORT}`);
    fastify.log.info(`🔍 Health: http://${HOST}:${PORT}/health`);
    fastify.log.info(`📋 Routes: http://${HOST}:${PORT}/routes`);
    fastify.log.info(`📝 Registered ${config.routes.length} webhook routes`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// サーバーを起動
start();
