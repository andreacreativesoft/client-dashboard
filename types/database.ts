export type UserRole = "admin" | "client";
export type AccessRole = "owner" | "viewer";
export type LeadStatus = "new" | "contacted" | "done";
export type LeadSource = "webhook" | "manual" | "api";
export type IntegrationType = "ga4" | "gbp";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  website_id: string;
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
        Insert: Omit<Client, "id" | "created_at" | "updated_at">;
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
        Insert: Omit<Website, "id" | "api_key" | "webhook_secret" | "created_at" | "updated_at">;
        Update: Partial<Omit<Website, "id" | "created_at">>;
        Relationships: [];
      };
      leads: {
        Row: Lead;
        Insert: Omit<Lead, "id" | "submitted_at" | "created_at">;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
