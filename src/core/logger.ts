import * as fs from 'fs';
import * as path from 'path';
import { WebhookLog } from './types';

/**
 * Webhookログを保存するクラス
 */
export class WebhookLogger {
  private logDir: string;
  private enabled: boolean;

  constructor(logDir: string = './logs', enabled: boolean = true) {
    this.logDir = logDir;
    this.enabled = enabled;

    if (this.enabled && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Webhookログを保存
   */
  async log(webhookLog: WebhookLog): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(this.logDir, `webhook-${dateStr}.log`);

      const logEntry = {
        ...webhookLog,
        timestamp: webhookLog.timestamp.toISOString(),
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      // ファイルに追記
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write webhook log:', error);
    }
  }

  /**
   * 古いログファイルを削除
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const maxAge = retentionDays * 24 * 60 * 60 * 1000; // ミリ秒に変換

      for (const file of files) {
        if (!file.startsWith('webhook-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }
}
