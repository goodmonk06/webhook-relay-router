/**
 * カスタムエラークラス
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * 認証エラー
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 設定エラー
 */
export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, 500, 'CONFIG_ERROR');
  }
}

/**
 * 転送エラー
 */
export class ForwardError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 502, 'FORWARD_ERROR');
  }
}

/**
 * エラーレスポンスの型
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  statusCode: number;
  details?: unknown;
  timestamp: string;
}

/**
 * エラーをErrorResponseに変換
 */
export function formatError(error: Error | AppError): ErrorResponse {
  const response: ErrorResponse = {
    error: error.name,
    message: error.message,
    statusCode: 500,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof AppError) {
    response.statusCode = error.statusCode;
    response.code = error.code;
  }

  if (error instanceof ValidationError) {
    response.details = error.details;
  }

  if (error instanceof ForwardError) {
    response.details = error.details;
  }

  return response;
}
