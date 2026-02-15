export type UserRole = "admin" | "client";
export type AccessRole = "owner" | "viewer";
export type LeadStatus = "new" | "contacted" | "done";
export type LeadSource = "webhook" | "manual" | "api";
export type IntegrationType = "ga4" | "gbp" | "gsc" | "facebook";
export type CheckType = "broken_links" | "seo_audit" | "uptime";
export type CheckStatus = "running" | "completed" | "failed";
export type WPAnalysisStatus = "running" | "completed" | "failed";
export type WPDeployMethod = "none" | "git" | "wp_migrate";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  business_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ClientUser = {
  id: string;
  client_id: string;
  user_id: string;
  access_role: AccessRole;
  created_at: string;
};

export type Website = {
  id: string;
  client_id: string;
  name: string;
  url: string;
  api_key: string;
  webhook_secret: string;
  source_type: string;
  git_repo_url: string | null;
  asana_project_url: string | null;
  figma_url: string | null;
  content_hash: string | null;
  last_checked_at: string | null;
  has_changes: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WebsiteInfo = {
  id: string;
  website_id: string;
  label: string;
  value: string;
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  website_id: string;
  client_id: string; // Denormalized for query performance
  form_name: string | null;
  source: LeadSource;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  raw_data: Record<string, unknown>;
  status: LeadStatus;
  submitted_at: string;
  created_at: string;
};

export type LeadNote = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Integration = {
  id: string;
  client_id: string;
  type: IntegrationType;
  account_id: string;
  account_name: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AnalyticsCache = {
  id: string;
  client_id: string;
  integration_type: IntegrationType;
  metric_type: string;
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  fetched_at: string;
  created_at: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  file_path: string;
  file_size: number;
  generated_at: string;
  sent_at: string | null;
  created_at: string;
};

export type Invite = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  token: string;
  client_ids: string[];
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  client_id: string | null;
  user_id: string | null;
  action_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ActivityLogWithUser = ActivityLog & {
  user_name: string | null;
  user_email: string | null;
};

export type SiteCheck = {
  id: string;
  website_id: string;
  client_id: string;
  check_type: CheckType;
  status: CheckStatus;
  score: number | null;
  summary: Record<string, unknown>;
  results: Record<string, unknown>[];
  duration_ms: number | null;
  created_at: string;
};

export type WPSiteConfigRow = {
  id: string;
  website_id: string;
  local_path: string;
  deploy_method: WPDeployMethod;
  created_at: string;
  updated_at: string;
};

export type WPAnalysisRow = {
  id: string;
  website_id: string;
  client_id: string;
  status: WPAnalysisStatus;
  site_data: Record<string, unknown>;
  recommendations: Record<string, unknown>[];
  scores: Record<string, unknown>;
  pages_analyzed: number;
  issues_found: number;
  claude_tokens: number;
  summary: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

// Joined view types
export type LeadFull = Lead & {
  website_name: string;
  website_url: string;
  client_name: string;
};

// Supabase Database type for generic client
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "updated_at" | "logo_url"> & { logo_url?: string | null };
        Update: Partial<Omit<Client, "id" | "created_at">>;
        Relationships: [];
      };
      client_users: {
        Row: ClientUser;
        Insert: Omit<ClientUser, "id" | "created_at">;
        Update: Partial<Omit<ClientUser, "id" | "created_at">>;
        Relationships: [];
      };
      websites: {
        Row: Website;
        Insert: {
          client_id: string;
          name: string;
          url: string;
          api_key: string;
          webhook_secret: string;
          source_type: string;
          git_repo_url?: string | null;
          asana_project_url?: string | null;
          figma_url?: string | null;
          content_hash?: string | null;
          last_checked_at?: string | null;
          has_changes?: boolean;
          is_active: boolean;
        };
        Update: Partial<Omit<Website, "id" | "created_at">>;
        Relationships: [];
      };
      website_info: {
        Row: WebsiteInfo;
        Insert: Omit<WebsiteInfo, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<WebsiteInfo, "id" | "created_at">>;
        Relationships: [];
      };
      leads: {
        Row: Lead;
        Insert: {
          website_id: string;
          client_id: string;
          form_name?: string | null;
          source: LeadSource;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          message?: string | null;
          raw_data: Record<string, unknown>;
          status: LeadStatus;
        };
        Update: Partial<Omit<Lead, "id" | "created_at">>;
        Relationships: [];
      };
      lead_notes: {
        Row: LeadNote;
        Insert: Omit<LeadNote, "id" | "created_at">;
        Update: Partial<Omit<LeadNote, "id" | "created_at">>;
        Relationships: [];
      };
      integrations: {
        Row: Integration;
        Insert: Omit<Integration, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Integration, "id" | "created_at">>;
        Relationships: [];
      };
      analytics_cache: {
        Row: AnalyticsCache;
        Insert: Omit<AnalyticsCache, "id" | "fetched_at" | "created_at">;
        Update: Partial<Omit<AnalyticsCache, "id" | "created_at">>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: Omit<PushSubscription, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<PushSubscription, "id" | "created_at">>;
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: Omit<Report, "id" | "created_at" | "sent_at"> & { sent_at?: string | null };
        Update: Partial<Omit<Report, "id" | "created_at">>;
        Relationships: [];
      };
      invites: {
        Row: Invite;
        Insert: Omit<Invite, "id" | "token" | "created_at" | "accepted_at"> & { accepted_at?: string | null };
        Update: Partial<Omit<Invite, "id" | "token" | "created_at">>;
        Relationships: [];
      };
      activity_logs: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      site_checks: {
        Row: SiteCheck;
        Insert: Omit<SiteCheck, "id" | "created_at">;
        Update: Partial<Omit<SiteCheck, "id" | "created_at">>;
        Relationships: [];
      };
      wp_site_configs: {
        Row: WPSiteConfigRow;
        Insert: Omit<WPSiteConfigRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<WPSiteConfigRow, "id" | "created_at">>;
        Relationships: [];
      };
      wp_analyses: {
        Row: WPAnalysisRow;
        Insert: Omit<WPAnalysisRow, "id" | "created_at" | "site_data" | "recommendations" | "scores" | "pages_analyzed" | "issues_found" | "claude_tokens" | "summary" | "error_message" | "completed_at"> & {
          site_data?: Record<string, unknown>;
          recommendations?: Record<string, unknown>[];
          scores?: Record<string, unknown>;
          pages_analyzed?: number;
          issues_found?: number;
          claude_tokens?: number;
          summary?: string | null;
          error_message?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Omit<WPAnalysisRow, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
