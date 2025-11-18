/**
 * Transformation Rule Domain Entity
 *
 * Defines how webhook payloads should be transformed before forwarding
 */

export enum TransformationType {
  FIELD_MAPPING = 'field_mapping',
  TEMPLATE = 'template',
  FILTER = 'filter',
  ENRICHMENT = 'enrichment',
}

export interface FieldMapping {
  source: string; // JSONPath expression
  target: string; // JSONPath expression
  transform?: 'uppercase' | 'lowercase' | 'trim' | 'base64' | 'json_parse';
}

export interface TransformationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;

  // Matching criteria
  provider?: string; // null = match all
  path?: string; // null = match all
  conditions?: Array<{
    field: string; // JSONPath
    operator: 'equals' | 'contains' | 'regex' | 'exists';
    value?: unknown;
  }>;

  // Transformation
  type: TransformationType;

  // For FIELD_MAPPING type
  fieldMappings?: FieldMapping[];

  // For TEMPLATE type
  template?: string; // Handlebars template

  // For FILTER type
  filterExpression?: string; // JSONPath boolean expression

  // For ENRICHMENT type
  enrichmentSource?: 'header' | 'env' | 'api';
  enrichmentKey?: string;
  enrichmentTarget?: string;

  // Metadata
  priority: number; // Lower = higher priority
  createdAt: Date;
  updatedAt: Date;
}