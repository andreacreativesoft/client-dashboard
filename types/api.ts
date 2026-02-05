export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface WebhookLeadPayload {
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  tel?: string;
  message?: string;
  form_name?: string;
  form_id?: string;
  fields?: Record<string, string>;
  [key: string]: unknown;
}
