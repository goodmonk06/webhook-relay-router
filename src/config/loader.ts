import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Config } from '../core/types';
import { ConfigSchema } from '../core/validation';
import { ConfigError } from '../core/errors';

/**
 * YAML設定ファイルを読み込む
 */
export function loadConfig(configPath?: string): Config {
  const resolvedPath = configPath || process.env.ROUTES_CONFIG_PATH || './config/routes.yml';
  const absolutePath = path.resolve(resolvedPath);

  if (!fs.existsSync(absolutePath)) {
    throw new ConfigError(`Config file not found: ${absolutePath}`);
  }

  try {
    const fileContents = fs.readFileSync(absolutePath, 'utf8');
    const rawConfig = yaml.load(fileContents);

    // zodでバリデーション
    const validationResult = ConfigSchema.safeParse(rawConfig);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ConfigError(`Invalid config: ${errorMessages}`);
    }

    const config = validationResult.data;

    // 有効なルートのみをフィルタリング
    config.routes = config.routes.filter((route) => {
      if (!route.enabled) {
        return false;
      }
      return true;
    });

    return config;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(`Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 環境変数を読み込む
 */
export function loadEnv(): void {
  const dotenv = require('dotenv');
  const envPath = path.resolve('.env');

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    console.warn('.env file not found, using environment variables');
  }
}
