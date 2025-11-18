# Architecture

## Overview

The Webhook Relay Router is designed as a pluggable, extensible gateway for handling webhooks from multiple SaaS providers. It follows a layered architecture with clear separation of concerns.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     External SaaS Providers                  │
│         (Stripe, GitHub, Slack, Shopify, etc.)              │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS Webhooks
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Webhook Relay Router                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Ingestion  │  │ Verification │  │ Transformation│      │
│  │    Layer     │→ │    Layer     │→ │     Layer     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Logging    │  │   Metrics    │  │  Forwarding  │      │
│  │    Layer     │  │    Layer     │  │    Layer     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                              │               │
└──────────────────────────────────────────────┼───────────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Internal Services  │
                                    │   (Your APIs)       │
                                    └─────────────────────┘
```

## Layers

### 1. Ingestion Layer (`src/server.ts`, `src/core/router.ts`)
- **Responsibility**: Receive HTTP POST requests from SaaS providers
- **Components**:
  - Fastify HTTP server
  - Route registration from YAML config
  - Raw body preservation for signature verification
  - Error handling middleware

### 2. Verification Layer (`src/core/verifier.ts`)
- **Responsibility**: Cryptographically verify webhook authenticity
- **Components**:
  - `SignatureVerifier` interface
  - Provider-specific verifiers (Stripe, GitHub, Slack, etc.)
  - `VerifierFactory` for verifier lookup
  - Timing-safe comparison utilities
- **Extension Point**: Register custom verifiers via `VerifierFactory.registerVerifier()`

### 3. Transformation Layer (Phase 3+)
- **Responsibility**: Transform, filter, and enrich webhook payloads
- **Components** (planned):
  - Field mapping engine
  - Template-based transformation
  - Conditional routing rules
  - Enrichment from external sources

### 4. Logging Layer (`src/core/logger.ts`, `src/lib/webhook-store.ts`)
- **Responsibility**: Persist webhook events for audit and replay
- **Components**:
  - File-based event store (JSONlines format)
  - Query interface for history retrieval
  - Statistics aggregation
  - Automatic cleanup of old events
- **Future**: PostgreSQL/MongoDB adapter

### 5. Metrics Layer (`src/lib/metrics.ts`)
- **Responsibility**: Collect and expose operational metrics
- **Components**:
  - Counter metrics (received, processed, failed)
  - Histogram metrics (latency, duration)
  - Prometheus text format export
  - JSON format export for custom dashboards
- **Metrics**:
  - `webhook_received_total` - Total webhooks received by provider
  - `webhook_processed_total` - Successfully processed webhooks
  - `webhook_failed_total` - Failed webhooks
  - `webhook_processing_duration_seconds` - Processing time histogram
  - `webhook_forward_duration_seconds` - Forward time histogram

### 6. Forwarding Layer (`src/core/router.ts`)
- **Responsibility**: Reliably deliver webhooks to internal services
- **Components**:
  - HTTP client with retry logic
  - Exponential backoff strategy
  - Timeout handling
  - Header enrichment (forwarded-for, original-path, provider)
- **Future**: Retry queue with persistence

## Domain Model

### Core Entities

1. **WebhookEvent** (`src/domain/webhook-event.ts`)
   - Full lifecycle tracking of a webhook
   - Status: received → validated → forwarding → delivered/failed
   - Metadata: correlation ID, tenant ID, tags
   - Retry tracking: count, next retry time

2. **RouteConfig** (`src/core/types.ts`)
   - Defines how a webhook should be routed
   - Provider, path, forward URL, secret
   - Enabled/disabled flag

3. **TransformationRule** (`src/domain/transformation-rule.ts`)
   - Defines payload transformations
   - Types: field mapping, template, filter, enrichment
   - Conditional matching

4. **RetryPolicy** (`src/domain/retry-policy.ts`)
   - Configurable retry strategies
   - Exponential backoff, linear, fixed
   - Dead letter queue support

## Data Flow

```
1. Webhook arrives at /webhook/{provider}
   ↓
2. Route matched from config
   ↓
3. Signature verified using provider-specific verifier
   ↓ (if valid)
4. Event logged to webhook store
   ↓
5. Metrics recorded (received counter)
   ↓
6. Transformation applied (if configured)
   ↓
7. Forward to internal service with retry
   ↓
8. Response logged and metrics updated
   ↓
9. HTTP 200 returned to provider (or error)
```

## Extension Points

### 1. Custom Providers
Implement `SignatureVerifier` interface and register:
```typescript
class CustomVerifier implements SignatureVerifier {
  async verify(request, secret): Promise<VerificationResult> {
    // Custom logic
  }
}
VerifierFactory.registerVerifier('custom', new CustomVerifier());
```

### 2. Custom Adapters
Implement adapter interfaces in `src/lib/adapters.ts`:
- `INotificationAdapter` - Send alerts (e.g., to Slack, PagerDuty)
- `IMetricsAdapter` - Send metrics (e.g., to Datadog, New Relic)
- `IStorageAdapter` - Custom storage backend
- `ITransformationAdapter` - Custom transformation logic
- `IAuthAdapter` - Additional authentication

Register via `AdapterRegistry`:
```typescript
AdapterRegistry.register('notification', new SlackNotificationAdapter());
```

### 3. Event Hooks (Future)
Subscribe to domain events:
- `webhook.received`
- `webhook.validated`
- `webhook.forwarded`
- `webhook.failed`

## Configuration

### YAML-based (`config/routes.yml`)
```yaml
routes:
  - provider: stripe
    path: /webhook/stripe
    forwardUrl: https://api.internal/stripe
    secret: whsec_xxx
    enabled: true

settings:
  logging:
    enabled: true
    retentionDays: 30
  forwarding:
    timeout: 10000
    retryCount: 3
```

### Environment Variables (`.env`)
```
NODE_ENV=production
PORT=3000
ROUTES_CONFIG_PATH=./config/routes.yml
LOG_LEVEL=info
LOG_DIR=./logs
```

## Scalability Considerations

### Horizontal Scaling
- **Stateless design**: No shared state between instances
- **Load balancer compatible**: Any instance can handle any webhook
- **Shared storage**: Use centralized logging (PostgreSQL, S3) for multi-instance deployments

### Performance
- **Non-blocking I/O**: Fastify with async/await throughout
- **Minimal latency**: Signature verification < 1ms typical
- **Configurable timeouts**: Prevent slow downstream services from blocking

### Reliability
- **Retry logic**: Configurable exponential backoff
- **Dead letter queue**: Failed webhooks can be recovered
- **Health checks**: Built-in `/health` endpoint
- **Graceful shutdown**: Finishes in-flight requests

## Security

### Signature Verification
- All providers use HMAC-based signatures
- Timing-safe comparison to prevent timing attacks
- Timestamp validation to prevent replay attacks (Stripe, Slack)

### Input Validation
- Zod schemas for config validation
- Request body size limits
- Rate limiting (configurable)

### Best Practices
- Secrets never logged
- TLS required in production
- IP allowlisting supported
- Audit trail for all webhooks

## Future Enhancements

### Phase 4+
- Real-time webhook streaming (WebSocket)
- GraphQL API for webhook queries
- Web UI for management
- Machine learning anomaly detection
- Schema registry for payload validation
- CDC (Change Data Capture) integration
- Multi-region deployment
- Webhook batching/aggregation

## Related Documentation
- [Phase 3 Overview](./PHASE3_OVERVIEW.md) - Current phase goals
- [Integration Recipes](./INTEGRATION_RECIPES.md) - Common integration patterns
- [Provider Guide](../src/routes/README.md) - Adding new providers