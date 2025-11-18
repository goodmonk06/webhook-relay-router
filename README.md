# webhook-relay-router

各種SaaSからのWebhookを一旦受けて、認証・変換・ルーティングして内部サービスへ流す中継サーバ。

## Overview（概要）

このプロジェクトは、複数のSaaSプロバイダー（Stripe、GitHub等）からのWebhookを一元的に受信し、署名検証、ログ保存、そして内部サービスへの転送を行うゲートウェイサーバーです。

**✅ Phase 2 Complete**: エンドツーエンドで動作する完全な垂直スライスを実装済み。Docker対応、テスト完備、デモフロー付き。

### Key Features（主な機能）

- **署名検証**: プロバイダーごとの署名検証をプラグイン形式で実装（Stripe, GitHub対応）
- **入力バリデーション**: Zodによる型安全なバリデーション
- **統一エラーハンドリング**: 一貫したエラーレスポンス形式
- **ログ保存**: 受信したWebhookをファイルに保存（将来的にDB対応）
- **リクエスト転送**: 検証済みのWebhookを内部サービスへ転送
- **リトライ機能**: 転送失敗時の自動リトライ（指数バックオフ）
- **設定駆動**: YAMLファイルでルーティングを柔軟に設定
- **完全なテストカバレッジ**: Vitestによる単体テスト + E2Eテスト
- **Docker対応**: 本番環境へのデプロイが容易

### Use Cases（想定ユースケース）

1. **マルチテナントSaaS**: 複数の顧客からのWebhookを一元管理
2. **マイクロサービス**: Webhookの受信と処理を分離
3. **監査ログ**: すべてのWebhookリクエストを記録・監査
4. **開発環境**: 本番Webhookをローカル環境に転送
5. **統合基盤**: 異なるSaaSサービスからのイベントを統合処理

## Tech Stack

- **Node.js 20** + **TypeScript**: 型安全な開発
- **Fastify**: 高速なWebフレームワーク
- **Zod**: スキーマバリデーション
- **Vitest**: テストフレームワーク
- **js-yaml**: YAML設定ファイルのパース
- **axios**: HTTPリクエストの転送
- **pino**: 構造化ログ
- **Docker**: コンテナ化

## Domain Model（ドメインモデル）

### 主要エンティティ

1. **RouteConfig**: Webhookルーティング設定
   - `provider`: プロバイダー名（stripe, github, generic）
   - `path`: Webhookエンドポイントのパス
   - `forwardUrl`: 転送先URL
   - `secret`: 署名検証用シークレット
   - `enabled`: ルートの有効/無効

2. **WebhookLog**: Webhookリクエストのログ
   - リクエストメタデータ（タイムスタンプ、パス、メソッド）
   - ヘッダーとボディ
   - 転送結果（成功/失敗、ステータスコード）

3. **SignatureVerifier**: 署名検証インターフェース
   - プロバイダーごとに実装をプラグイン
   - StripeVerifier, GitHubVerifier, NoopVerifier

### リクエストフロー

```
SaaS Provider → Webhook Router → Signature Verification → Logging → Forward to Internal Service
     (Stripe,       (port 3000)      (Provider-specific)     (File)       (Your API)
      GitHub)
```

## Directory Structure（ディレクトリ構成）

```
webhook-relay-router/
├── config/
│   ├── routes.yml              # ルーティング設定（本番用）
│   └── routes.example.yml      # 設定例
├── src/
│   ├── __tests__/              # テスト
│   │   ├── verifier.test.ts
│   │   ├── validation.test.ts
│   │   └── errors.test.ts
│   ├── config/
│   │   └── loader.ts           # 設定ファイル読み込み
│   ├── core/
│   │   ├── types.ts            # 型定義
│   │   ├── router.ts           # ルーター本体
│   │   ├── verifier.ts         # 署名検証
│   │   ├── logger.ts           # ログ保存
│   │   ├── validation.ts       # Zodスキーマ
│   │   └── errors.ts           # エラークラス
│   ├── routes/
│   │   └── README.md           # プロバイダードキュメント
│   └── server.ts               # サーバーエントリーポイント
├── demo/                       # デモ・テスト用ツール
│   ├── mock-server.js          # モック内部サーバー
│   ├── test-flow.ts            # E2Eテスト
│   ├── send-webhook.sh         # 手動テスト用スクリプト
│   └── README.md
├── logs/                       # Webhookログ（自動生成）
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Getting Started

### Requirements（前提条件）

- Node.js 20+
- npm または yarn
- Docker & Docker Compose（オプション）

### Setup Steps（セットアップ手順）

#### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd webhook-relay-router
```

#### 2. 依存パッケージのインストール

```bash
npm install
```

#### 3. 設定ファイルの作成

```bash
# 環境変数ファイル
cp .env.example .env

# ルーティング設定ファイル
cp config/routes.example.yml config/routes.yml
```

#### 4. 設定ファイルの編集（オプション）

`config/routes.yml` を編集してルーティングを設定します:

```yaml
routes:
  # Stripe Webhook
  - provider: stripe
    path: /webhook/stripe
    forwardUrl: http://localhost:4000/api/stripe
    secret: whsec_test_secret
    enabled: true
    description: Stripe payment webhooks

  # GitHub Webhook
  - provider: github
    path: /webhook/github
    forwardUrl: http://localhost:4000/api/github
    secret: test_secret
    enabled: true
    description: GitHub repository events
```

#### 5. 開発サーバーの起動

```bash
npm run dev
```

サーバーが `http://localhost:3000` で起動します。

### Docker Compose での起動

すべてをまとめて起動（推奨）:

```bash
docker compose up
```

これにより以下が起動します:
- Webhook Relay Router (port 3000)
- Mock Internal Server (port 4000)

バックグラウンドで起動:

```bash
docker compose up -d
```

停止:

```bash
docker compose down
```

## Example Flow（デモフロー）

### 1. ヘルスチェック

```bash
curl http://localhost:3000/health
```

レスポンス:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 123.456
}
```

### 2. 登録ルートの確認

```bash
curl http://localhost:3000/routes
```

レスポンス:
```json
{
  "routes": [
    {
      "provider": "stripe",
      "path": "/webhook/stripe",
      "description": "Stripe payment webhooks",
      "enabled": true
    },
    {
      "provider": "github",
      "path": "/webhook/github",
      "description": "GitHub repository events",
      "enabled": true
    }
  ]
}
```

### 3. E2Eテストの実行

#### モックサーバーの起動（別ターミナル）

```bash
npm run demo:mock
```

#### E2Eテストの実行（さらに別ターミナル）

```bash
npm run test:e2e
```

このテストでは以下を検証します:
- ✅ ヘルスチェック
- ✅ ルート情報の取得
- ✅ Stripe Webhookの署名検証と転送
- ✅ GitHub Webhookの署名検証と転送
- ✅ Generic Webhookの転送
- ✅ 無効な署名の拒否

### 4. 手動でWebhookを送信

```bash
# Stripe Webhook
./demo/send-webhook.sh stripe

# GitHub Webhook
./demo/send-webhook.sh github

# Generic Webhook
./demo/send-webhook.sh generic
```

### 5. モックサーバーの履歴確認

```bash
curl http://localhost:4000/webhooks | jq
```

## Testing（テスト）

### 単体テスト

```bash
# テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:coverage

# UIモード
npm run test:ui
```

### E2Eテスト

```bash
# サーバーとモックサーバーを起動してから
npm run test:e2e
```

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

```
logs/
├── webhook-2024-01-15.log
├── webhook-2024-01-16.log
└── webhook-2024-01-17.log
```

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
- Zodによる入力バリデーション
- 統一されたエラーハンドリング

## Development（開発）

### Available Scripts

```bash
# 開発サーバー起動（ホットリロード）
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start

# テスト
npm test                # 単体テスト実行
npm run test:watch      # ウォッチモード
npm run test:coverage   # カバレッジ
npm run test:e2e        # E2Eテスト

# デモ
npm run demo:mock       # モックサーバー起動

# コード品質
npm run lint            # リント
npm run format          # フォーマット
```

### ビルド

```bash
npm run build
```

ビルド結果は `dist/` ディレクトリに出力されます。

## Deployment（デプロイ）

### Docker

```bash
# イメージをビルド
docker build -t webhook-relay-router .

# コンテナを実行
docker run -p 3000:3000 \
  -v $(pwd)/config/routes.yml:/app/config/routes.yml:ro \
  -v $(pwd)/logs:/app/logs \
  webhook-relay-router
```

### Docker Compose

```bash
docker compose up -d
```

## Future Extensions（今後の拡張）

### Phase 3候補

- [ ] **データベース統合**: PostgreSQLへのログ保存
- [ ] **Redisキャッシュ**: レート制限とセッション管理
- [ ] **IP制限機能**: 送信元IPのホワイトリスト
- [ ] **Webhook再送機能**: 失敗したWebhookの手動再送
- [ ] **管理用Web UI**: ダッシュボードと設定管理
- [ ] **メトリクス**: Prometheus/Grafana対応
- [ ] **より多くのプロバイダー**: Slack, Shopify, Twilio等
- [ ] **変換機能**: Webhookペイロードの変換・加工
- [ ] **条件付きルーティング**: ペイロード内容に基づくルーティング
- [ ] **バッチ処理**: 複数Webhookのバッチ処理

### アーキテクチャ拡張

- [ ] マルチテナント対応（テナントIDベースのルーティング）
- [ ] イベントソーシング
- [ ] CQRS パターンの導入
- [ ] Kubernetes対応（Helm Chart）

## Contributing

プルリクエストを歓迎します。大きな変更の場合は、まずIssueを開いて変更内容を議論してください。

## License

MIT

---

**Status**: Phase 2 Complete ✅
- ✅ Vertical Slice実装
- ✅ Docker環境構築
- ✅ テスト完備
- ✅ デモフロー
- ✅ 完全なドキュメント
