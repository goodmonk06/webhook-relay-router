# Integration Recipes

Common patterns for integrating the Webhook Relay Router with other systems in your ecosystem.

## Recipe 1: Auth Service Integration

### Scenario
You want to verify that webhooks are authorized for specific tenants before forwarding.

### Solution
Implement a custom `IAuthAdapter`:

```typescript
import { IAuthAdapter } from '../lib/adapters';
import { WebhookEvent } from '../domain/webhook-event';
import axios from 'axios';

class AuthServiceAdapter implements IAuthAdapter {
  private authServiceUrl: string;

  constructor(authServiceUrl: string) {
    this.authServiceUrl = authServiceUrl;
  }

  async authenticate(event: WebhookEvent): Promise<boolean> {
    try {
      const response = await axios.post(`${this.authServiceUrl}/verify-webhook`, {
        provider: event.provider,
        tenantId: event.tenantId,
        path: event.path,
      });
      return response.data.authorized === true;
    } catch {
      return false;
    }
  }
}

// Register
AdapterRegistry.register('auth', new AuthServiceAdapter('https://auth.internal'));
```

Usage in router:
```typescript
const authAdapter = AdapterRegistry.get<IAuthAdapter>('auth');
if (authAdapter && !(await authAdapter.authenticate(webhookEvent))) {
  return reply.code(403).send({ error: 'Forbidden' });
}
```

---

## Recipe 2: Notification Hub Integration

### Scenario
Send alerts when webhooks fail or when specific events occur.

### Solution
Implement `INotificationAdapter` with your notification service:

```typescript
import { INotificationAdapter } from '../lib/adapters';
import { WebhookEvent } from '../domain/webhook-event';

class SlackNotificationAdapter implements INotificationAdapter {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(event: WebhookEvent, message: string): Promise<void> {
    await axios.post(this.webhookUrl, {
      text: `🚨 *${message}*`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Provider', value: event.provider, short: true },
          { title: 'Path', value: event.path, short: true },
          { title: 'Status', value: event.status, short: true },
          { title: 'Event ID', value: event.id, short: false },
        ],
      }],
    });
  }
}

AdapterRegistry.register('notification', new SlackNotificationAdapter(process.env.SLACK_WEBHOOK_URL!));
```

Trigger alerts in router error handling:
```typescript
const notificationAdapter = AdapterRegistry.get<INotificationAdapter>('notification');
if (!forwardResult.success && notificationAdapter) {
  await notificationAdapter.sendAlert(webhookEvent, 'Webhook forward failed');
}
```

---

## Recipe 3: Metrics Export to Datadog

### Scenario
Export metrics to Datadog for centralized monitoring.

### Solution
Implement `IMetricsAdapter`:

```typescript
import { IMetricsAdapter } from '../lib/adapters';
import { StatsD } from 'hot-shots';

class DatadogMetricsAdapter implements IMetricsAdapter {
  private statsd: StatsD;

  constructor(host: string, port: number) {
    this.statsd = new StatsD({ host, port });
  }

  async recordMetric(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const tags = labels ? Object.entries(labels).map(([k, v]) => `${k}:${v}`) : [];
    this.statsd.gauge(name, value, tags);
  }
}

AdapterRegistry.register('metrics', new DatadogMetricsAdapter('localhost', 8125));
```

---

## Recipe 4: Database Storage for Webhooks

### Scenario
Store webhooks in PostgreSQL instead of files for better querying.

### Solution
Implement `IStorageAdapter`:

```typescript
import { IStorageAdapter } from '../lib/adapters';
import { WebhookEvent } from '../domain/webhook-event';
import { Pool } from 'pg';

class PostgresStorageAdapter implements IStorageAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async save(event: WebhookEvent): Promise<WebhookEvent> {
    const query = `
      INSERT INTO webhook_events (id, correlation_id, provider, path, status, headers, body, received_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      event.id,
      event.correlationId,
      event.provider,
      event.path,
      event.status,
      JSON.stringify(event.headers),
      JSON.stringify(event.body),
      event.receivedAt,
    ];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findById(id: string): Promise<WebhookEvent | null> {
    const result = await this.pool.query('SELECT * FROM webhook_events WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async query(filters: Record<string, unknown>): Promise<WebhookEvent[]> {
    // Build dynamic query based on filters
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.provider) {
      conditions.push(`provider = $${values.length + 1}`);
      values.push(filters.provider);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM webhook_events ${whereClause} ORDER BY received_at DESC LIMIT 100`;

    const result = await this.pool.query(query, values);
    return result.rows;
  }
}

// Usage
AdapterRegistry.register('storage', new PostgresStorageAdapter(process.env.DATABASE_URL!));
```

---

## Recipe 5: Webhook Transformation Pipeline

### Scenario
Transform incoming Shopify webhooks into your internal format.

### Solution
Implement `ITransformationAdapter`:

```typescript
import { ITransformationAdapter } from '../lib/adapters';

class ShopifyTransformationAdapter implements ITransformationAdapter {
  async transform(payload: unknown, context: Record<string, unknown>): Promise<unknown> {
    const shopifyEvent = payload as any;

    // Transform to internal format
    return {
      eventType: 'order_created',
      orderId: shopifyEvent.id,
      customerEmail: shopifyEvent.email,
      totalAmount: shopifyEvent.total_price,
      currency: shopifyEvent.currency,
      items: shopifyEvent.line_items.map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        price: item.price,
      })),
      metadata: {
        shopDomain: context.shopDomain,
        receivedAt: context.receivedAt,
      },
    };
  }
}
```

---

## Recipe 6: Multi-Region Deployment

### Architecture
```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬─────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │ Router US   │  │ Router EU   │  │ Router APAC │
    └─────────────┘  └─────────────┘  └─────────────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
                    ┌───────▼────────┐
                    │ Shared Storage │
                    │   (PostgreSQL)  │
                    └────────────────┘
```

### Setup
1. Deploy router instances in each region
2. Use shared PostgreSQL for webhook storage
3. Load balancer routes by geolocation
4. Each instance forwards to region-specific internal services

---

## Recipe 7: Webhook Replay After Deployment

### Scenario
You deployed a bug fix and need to replay failed webhooks.

### Solution
```bash
# Find failed webhooks
npm run cli history --status failed --from 2024-01-01

# For each ID, replay via API
curl -X POST http://localhost:3000/admin/replay/{webhook-id}
```

Or programmatically:
```typescript
import { WebhookEventStore } from './lib/webhook-store';
import axios from 'axios';

async function replayFailed(fromDate: Date) {
  const store = new WebhookEventStore();
  const failed = await store.query({
    status: WebhookEventStatus.FAILED,
    fromDate,
    limit: 1000,
  });

  for (const event of failed) {
    await axios.post(`http://localhost:3000${event.path}`, event.body, {
      headers: event.headers as any,
    });
    console.log(`Replayed: ${event.id}`);
  }
}
```

---

## Recipe 8: Rate Limiting with Redis

### Scenario
Prevent abuse with distributed rate limiting.

### Solution
```typescript
import Redis from 'ioredis';

class RedisRateLimiter {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async checkLimit(key: string, max: number, window: number): Promise<boolean> {
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, window);
    }

    return count <= max;
  }
}

// In router
const rateLimiter = new RedisRateLimiter(process.env.REDIS_URL!);
const key = `rate:${request.ip}:${Date.now() / 60000 | 0}`;

if (!(await rateLimiter.checkLimit(key, 100, 60))) {
  return reply.code(429).send({ error: 'Too Many Requests' });
}
```

---

## Recipe 9: Webhook Schema Validation

### Scenario
Validate webhook payloads against known schemas before forwarding.

### Solution
```typescript
import Ajv from 'ajv';

const ajv = new Ajv();

const schemas = {
  stripe: {
    type: 'object',
    required: ['id', 'type', 'data'],
    properties: {
      id: { type: 'string' },
      type: { type: 'string' },
      data: { type: 'object' },
    },
  },
  // ... other schemas
};

function validatePayload(provider: string, payload: unknown): boolean {
  const schema = schemas[provider];
  if (!schema) return true; // No schema = skip validation

  const validate = ajv.compile(schema);
  return validate(payload);
}
```

---

## Recipe 10: Observability with OpenTelemetry

### Scenario
Distributed tracing across your microservices.

### Solution
```typescript
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('webhook-relay-router');

// In router handler
const span = tracer.startSpan('process_webhook', {
  attributes: {
    'webhook.provider': event.provider,
    'webhook.path': event.path,
  },
});

try {
  // Process webhook
  await forwardWebhook(event);
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
} finally {
  span.end();
}
```

---

## Best Practices

1. **Idempotency**: Always check for duplicate webhooks using correlation IDs
2. **Timeouts**: Set aggressive timeouts to prevent cascading failures
3. **Circuit Breakers**: Stop forwarding if downstream service is down
4. **Monitoring**: Track success rates, latencies, and error patterns
5. **Testing**: Use the mock server for integration testing
6. **Versioning**: Version your internal webhook formats
7. **Documentation**: Document what each webhook type contains
8. **Security**: Rotate secrets regularly, use TLS everywhere

## Next Steps

- See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See [Phase 3 Overview](./PHASE3_OVERVIEW.md) for planned features
- See [Provider Guide](../src/routes/README.md) for adding new providers