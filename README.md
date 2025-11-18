# webhook-relay-router

各種SaaSからのWebhookを一旦受けて、認証・変換・ルーティングして内部サービスへ流す中継サーバ。

## 概要

このプロジェクトは、複数のSaaSプロバイダー（Stripe、GitHub等）からのWebhookを一元的に受信し、署名検証、ログ保存、そして内部サービスへの転送を行うゲートウェイサーバーです。

### 主な機能

- **署名検証**: プロバイダーごとの署名検証をプラグイン形式で実装
- **ログ保存**: 受信したWebhookをファイル（または将来的にDB）に保存
- **リクエスト転送**: 検証済みのWebhookを内部サービスへ転送
- **リトライ機能**: 転送失敗時の自動リトライ
- **設定駆動**: YAMLファイルでルーティングを柔軟に設定

### 想定ユースケース

1. **マルチテナントSaaS**: 複数の顧客からのWebhookを一元管理
2. **マイクロサービス**: Webhookの受信と処理を分離
3. **監査ログ**: すべてのWebhookリクエストを記録・監査
4. **開発環境**: 本番Webhookをローカル環境に転送

## Tech Stack

- **Node.js** + **TypeScript**: 型安全な開発
- **Fastify**: 高速なWebフレームワーク
- **js-yaml**: YAML設定ファイルのパース
- **axios**: HTTPリクエストの転送
- **pino**: 構造化ログ

## ディレクトリ構成

```
webhook-relay-router/
├── config/
│   ├── routes.yml              # ルーティング設定（本番用）
│   └── routes.example.yml      # 設定例
├── src/
│   ├── config/
│   │   └── loader.ts           # 設定ファイル読み込み
│   ├── core/
│   │   ├── types.ts            # 型定義
│   │   ├── router.ts           # ルーター本体
│   │   ├── verifier.ts         # 署名検証
│   │   └── logger.ts           # ログ保存
│   ├── routes/
│   │   └── README.md           # プロバイダードキュメント
│   └── server.ts               # サーバーエントリーポイント
├── logs/                       # Webhookログ（自動生成）
└── package.json
```

## Getting Started

### 1. インストール

```bash
npm install
```

### 2. 設定ファイルの作成

```bash
# 環境変数ファイル
cp .env.example .env

# ルーティング設定ファイル
cp config/routes.example.yml config/routes.yml
```

### 3. 設定ファイルの編集

`config/routes.yml` を編集してルーティングを設定します:

```yaml
routes:
  # Stripe Webhook
  - provider: stripe
    path: /webhook/stripe
    forwardUrl: https://internal.example.com/api/stripe
    secret: whsec_your_stripe_webhook_secret_here
    enabled: true
    description: Stripe payment webhooks

  # GitHub Webhook
  - provider: github
    path: /webhook/github
    forwardUrl: https://internal.example.com/api/github
    secret: your_github_webhook_secret_here
    enabled: true
    description: GitHub repository events
```

### 4. 起動

#### 開発モード（ホットリロード）
```bash
npm run dev
```

#### 本番モード
```bash
npm run build
npm start
```

サーバーが起動すると、以下のエンドポイントが利用可能になります:

- `http://localhost:3000/health` - ヘルスチェック
- `http://localhost:3000/routes` - 登録されているルート一覧
- `http://localhost:3000/webhook/*` - Webhook受信エンドポイント

## 設定例

### Stripeの設定

1. Stripeダッシュボードで Webhook エンドポイントを作成
2. エンドポイントURL: `https://your-domain.com/webhook/stripe`
3. Webhook署名シークレットをコピー
4. `config/routes.yml` に設定:

```yaml
- provider: stripe
  path: /webhook/stripe
  forwardUrl: https://your-internal-service.com/api/stripe
  secret: whsec_xxxxxxxxxxxxx
  enabled: true
```

### GitHubの設定

1. GitHubリポジトリの Settings → Webhooks で新規作成
2. Payload URL: `https://your-domain.com/webhook/github`
3. Content type: `application/json`
4. Secret を設定
5. `config/routes.yml` に設定:

```yaml
- provider: github
  path: /webhook/github
  forwardUrl: https://your-internal-service.com/api/github
  secret: your_secret_here
  enabled: true
```

## カスタムプロバイダーの追加

新しいSaaSプロバイダーを追加するには、`src/core/verifier.ts` に新しいVerifierクラスを実装します:

```typescript
export class CustomVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    // カスタム署名検証ロジック
    const signature = request.headers['x-custom-signature'];
    // ... 検証処理
    return { valid: true };
  }
}

// VerifierFactoryに登録
VerifierFactory.registerVerifier('custom', new CustomVerifier());
```

詳しくは `src/routes/README.md` を参照してください。

## ログ

Webhookのログは `logs/` ディレクトリに日付ごとのファイルとして保存されます:

- `logs/webhook-2024-01-15.log`
- `logs/webhook-2024-01-16.log`

ログファイルは `settings.logging.retentionDays` で指定した日数後に自動削除されます（デフォルト: 30日）。

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `NODE_ENV` | 実行環境 | `development` |
| `PORT` | サーバーポート | `3000` |
| `HOST` | バインドアドレス | `0.0.0.0` |
| `ROUTES_CONFIG_PATH` | ルーティング設定ファイルのパス | `./config/routes.yml` |
| `LOG_LEVEL` | ログレベル | `info` |
| `LOG_DIR` | ログ保存ディレクトリ | `./logs` |

## セキュリティ

- すべてのWebhookリクエストは署名検証を行います
- タイミング攻撃を防ぐため `crypto.timingSafeEqual` を使用
- Stripeの署名にはタイムスタンプチェック（5分以内）を実施
- 将来的にIP制限やレート制限の実装を予定

## 開発

### ビルド
```bash
npm run build
```

### リント
```bash
npm run lint
```

### フォーマット
```bash
npm run format
```

## ロードマップ

- [ ] データベースへのログ保存（PostgreSQL）
- [ ] Redisを使用したレート制限
- [ ] IP制限機能
- [ ] Webhookの再送機能
- [ ] 管理用Web UI
- [ ] メトリクス・監視機能（Prometheus対応）
- [ ] より多くのプロバイダー対応（Slack、Shopify等）

## License

MIT
