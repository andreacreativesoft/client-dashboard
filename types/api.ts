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
  first_name?: string;
  last_name?: string;
  your_name?: string;
  email?: string;
  your_email?: string;
  phone?: string;
  tel?: string;
  telephone?: string;
  your_phone?: string;
  message?: string;
  your_message?: string;
  comment?: string;
  form_name?: string;
  form_id?: string;
  formName?: string;
  fields?: Record<string, string>;
  [key: string]: unknown;
}
