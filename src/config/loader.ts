import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Config } from '../core/types';

/**
 * YAML設定ファイルを読み込む
 */
export function loadConfig(configPath?: string): Config {
  const resolvedPath = configPath || process.env.ROUTES_CONFIG_PATH || './config/routes.yml';
  const absolutePath = path.resolve(resolvedPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const fileContents = fs.readFileSync(absolutePath, 'utf8');
  const config = yaml.load(fileContents) as Config;

  // バリデーション
  if (!config.routes || !Array.isArray(config.routes)) {
    throw new Error('Invalid config: routes must be an array');
  }

  // 有効なルートのみをフィルタリング
  config.routes = config.routes.filter((route) => {
    if (!route.enabled) {
      return false;
    }
    if (!route.provider || !route.path || !route.forwardUrl) {
      console.warn(`Skipping invalid route: ${JSON.stringify(route)}`);
      return false;
    }
    return true;
  });

  return config;
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
