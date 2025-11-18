/**
 * モック内部サーバー
 *
 * Webhook Relay Routerから転送されたWebhookを受け取るテスト用サーバー
 */

const http = require('http');

const PORT = process.env.PORT || 4000;

// 受信したWebhookの履歴を保存
const webhookHistory = [];
const MAX_HISTORY = 100;

const server = http.createServer((req, res) => {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ヘルスチェック
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Webhook履歴の取得
  if (req.method === 'GET' && req.url === '/webhooks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      count: webhookHistory.length,
      webhooks: webhookHistory,
    }));
    return;
  }

  // Webhookを受信
  if (req.method === 'POST') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};

        // Webhookデータを履歴に保存
        const webhookData = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          path: req.url,
          method: req.method,
          headers: req.headers,
          body: parsedBody,
        };

        webhookHistory.unshift(webhookData);

        // 履歴が上限を超えたら古いものを削除
        if (webhookHistory.length > MAX_HISTORY) {
          webhookHistory.pop();
        }

        // ログ出力
        console.log('========================================');
        console.log('📨 Webhook Received!');
        console.log('Timestamp:', webhookData.timestamp);
        console.log('Path:', req.url);
        console.log('Provider:', req.headers['x-webhook-provider'] || 'unknown');
        console.log('Original Path:', req.headers['x-original-path'] || 'unknown');
        console.log('Body:', JSON.stringify(parsedBody, null, 2));
        console.log('========================================\n');

        // 成功レスポンスを返す
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Webhook received',
          id: webhookData.id,
          timestamp: webhookData.timestamp,
        }));
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid JSON',
        }));
      }
    });

    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`🎯 Mock Server is running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   View webhooks: http://localhost:${PORT}/webhooks`);
});
