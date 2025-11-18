import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios, { AxiosError } from 'axios';
import { Config, RouteConfig, WebhookLog } from './types';
import { VerifierFactory } from './verifier';
import { WebhookLogger } from './logger';

/**
 * Webhookルーター
 */
export class WebhookRouter {
  private config: Config;
  private logger: WebhookLogger;

  constructor(config: Config, logger: WebhookLogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Fastifyにルートを登録
   */
  registerRoutes(fastify: FastifyInstance): void {
    for (const route of this.config.routes) {
      if (!route.enabled) {
        continue;
      }

      fastify.post(route.path, async (request: FastifyRequest, reply: FastifyReply) => {
        return this.handleWebhook(request, reply, route);
      });

      console.log(`Registered route: ${route.path} -> ${route.forwardUrl} (${route.provider})`);
    }
  }

  /**
   * Webhookリクエストを処理
   */
  private async handleWebhook(
    request: FastifyRequest,
    reply: FastifyReply,
    route: RouteConfig
  ): Promise<void> {
    const startTime = Date.now();
    const webhookLog: WebhookLog = {
      timestamp: new Date(),
      provider: route.provider,
      path: route.path,
      method: request.method,
      headers: request.headers,
      body: request.body,
      forwardUrl: route.forwardUrl,
    };

    try {
      // 1. 署名検証
      if (route.secret) {
        const verifier = VerifierFactory.getVerifier(route.provider);
        const verificationResult = await verifier.verify(request, route.secret);

        if (!verificationResult.valid) {
          webhookLog.statusCode = 401;
          webhookLog.error = verificationResult.error || 'Invalid signature';
          await this.logger.log(webhookLog);

          return reply.code(401).send({
            error: 'Unauthorized',
            message: verificationResult.error || 'Invalid signature',
          });
        }
      }

      // 2. リクエストを転送
      const forwardResult = await this.forwardRequest(request, route);

      webhookLog.statusCode = forwardResult.statusCode;
      webhookLog.forwardSuccess = forwardResult.success;
      webhookLog.forwardResponse = forwardResult.data;

      if (!forwardResult.success) {
        webhookLog.error = forwardResult.error;
      }

      // 3. ログを保存
      await this.logger.log(webhookLog);

      // 4. レスポンスを返す
      const duration = Date.now() - startTime;

      if (forwardResult.success) {
        return reply.code(200).send({
          success: true,
          message: 'Webhook processed successfully',
          duration: `${duration}ms`,
        });
      } else {
        return reply.code(502).send({
          error: 'Bad Gateway',
          message: 'Failed to forward webhook',
          details: forwardResult.error,
        });
      }
    } catch (error) {
      // エラーログ
      webhookLog.statusCode = 500;
      webhookLog.error = error instanceof Error ? error.message : 'Unknown error';
      await this.logger.log(webhookLog);

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * リクエストを転送
   */
  private async forwardRequest(
    request: FastifyRequest,
    route: RouteConfig
  ): Promise<{
    success: boolean;
    statusCode: number;
    data?: unknown;
    error?: string;
  }> {
    const timeout = this.config.settings?.forwarding?.timeout || 10000;
    const retryCount = this.config.settings?.forwarding?.retryCount || 3;
    const retryDelay = this.config.settings?.forwarding?.retryDelay || 1000;

    let lastError: string | undefined;

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        // ヘッダーをコピー（いくつかは除外）
        const headers: Record<string, string | string[] | undefined> = { ...request.headers };
        delete headers.host;
        delete headers.connection;

        // オリジナルの情報を追加
        headers['x-forwarded-for'] = request.ip;
        headers['x-forwarded-proto'] = request.protocol;
        headers['x-forwarded-host'] = request.hostname;
        headers['x-original-path'] = route.path;
        headers['x-webhook-provider'] = route.provider;

        const response = await axios({
          method: 'POST',
          url: route.forwardUrl,
          headers,
          data: request.body,
          timeout,
          validateStatus: () => true, // 全てのステータスコードを受け付ける
        });

        // 2xx系のレスポンスは成功とみなす
        if (response.status >= 200 && response.status < 300) {
          return {
            success: true,
            statusCode: response.status,
            data: response.data,
          };
        } else {
          lastError = `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
        }
      } catch (error) {
        if (error instanceof AxiosError) {
          lastError = error.message;
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            // リトライ可能なエラー
            if (attempt < retryCount - 1) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
              continue;
            }
          }
        } else {
          lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      // リトライ前に待機
      if (attempt < retryCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    return {
      success: false,
      statusCode: 502,
      error: lastError || 'Failed to forward request',
    };
  }
}
