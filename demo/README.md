# Demo & Testing

このディレクトリには、Webhook Relay Routerの動作を確認するためのデモ用ツールが含まれています。

## ファイル

- **mock-server.js**: 内部サービスを模倣するモックサーバー
- **test-flow.ts**: エンドツーエンドテストスクリプト
- **send-webhook.sh**: Webhookを手動で送信するシェルスクリプト

## クイックスタート

### 1. モックサーバーの起動

```bash
npm run demo:mock
```

モックサーバーは `http://localhost:4000` で起動し、転送されたWebhookを受信します。

### 2. Webhook Relay Routerの起動

別のターミナルで：

```bash
npm run dev
```

ルーターは `http://localhost:3000` で起動します。

### 3. E2Eテストの実行

さらに別のターミナルで：

```bash
npm run test:e2e
```

このスクリプトは以下をテストします：
- ヘルスチェック
- ルート情報の取得
- Stripe Webhookの送信と検証
- GitHub Webhookの送信と検証
- Generic Webhookの送信
- 無効な署名の拒否

## 手動テスト

### Webhookの手動送信

```bash
# Stripe Webhook
./demo/send-webhook.sh stripe

# GitHub Webhook
./demo/send-webhook.sh github

# Generic Webhook
./demo/send-webhook.sh generic
```

### モックサーバーの履歴確認

ブラウザで以下にアクセス：

```
http://localhost:4000/webhooks
```

または：

```bash
curl http://localhost:4000/webhooks | jq
```

## Docker Composeでの実行

すべてをまとめて起動：

```bash
docker compose up
```

これにより以下が起動します：
- Webhook Relay Router (port 3000)
- Mock Server (port 4000)

テストを実行：

```bash
ROUTER_URL=http://localhost:3000 MOCK_SERVER_URL=http://localhost:4000 npm run test:e2e
```

## トラブルシューティング

### ポートが使用中

別のプロセスがポートを使用している場合：

```bash
# ポート3000を使用しているプロセスを確認
lsof -i :3000

# または
netstat -an | grep 3000
```

### Webhookが転送されない

1. ルーターのログを確認
2. モックサーバーが起動しているか確認
3. `config/routes.yml` の `forwardUrl` が正しいか確認

### 署名検証エラー

- `config/routes.yml` の `secret` が正しいか確認
- タイムスタンプが正しいか確認（Stripeの場合、5分以内である必要があります）
