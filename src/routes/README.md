# Provider Handlers

このディレクトリは、各プロバイダー固有の処理を実装するための場所です。

現在、署名検証は `src/core/verifier.ts` で実装されています。

## サポートされているプロバイダー

### 1. Stripe

**署名検証**: `StripeVerifier`

Stripeは `stripe-signature` ヘッダーを使用してWebhookの署名を検証します。

**設定例**:
```yaml
- provider: stripe
  path: /webhook/stripe
  forwardUrl: https://internal.example.com/api/stripe
  secret: whsec_your_stripe_webhook_secret_here
  enabled: true
```

**参考**: https://stripe.com/docs/webhooks/signatures

### 2. GitHub

**署名検証**: `GitHubVerifier`

GitHubは `x-hub-signature-256` ヘッダーを使用してWebhookの署名を検証します。

**設定例**:
```yaml
- provider: github
  path: /webhook/github
  forwardUrl: https://internal.example.com/api/github
  secret: your_github_webhook_secret_here
  enabled: true
```

**参考**: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

### 3. Generic

**署名検証**: `NoopVerifier` (検証なし)

署名検証を行わない汎用的なWebhookエンドポイントです。

**設定例**:
```yaml
- provider: generic
  path: /webhook/generic
  forwardUrl: https://internal.example.com/api/generic
  enabled: true
```

## カスタムプロバイダーの追加

新しいプロバイダーを追加するには:

1. `src/core/verifier.ts` に新しいVerifierクラスを作成
2. `SignatureVerifier` インターフェースを実装
3. `VerifierFactory` に登録

**例**:

```typescript
export class CustomVerifier implements SignatureVerifier {
  async verify(request: FastifyRequest, secret: string): Promise<VerificationResult> {
    // カスタム検証ロジック
    return { valid: true };
  }
}

// VerifierFactoryに登録
VerifierFactory.registerVerifier('custom', new CustomVerifier());
```

その後、設定ファイルで使用できます:

```yaml
- provider: custom
  path: /webhook/custom
  forwardUrl: https://internal.example.com/api/custom
  secret: your_custom_secret
  enabled: true
```
