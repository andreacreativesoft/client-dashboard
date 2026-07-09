export type UserRole = "admin" | "client";
export type AccessRole = "owner" | "viewer";
export type SubmissionStatus = "new" | "contacted" | "done";
export type SubmissionSource = "webhook" | "manual" | "api";
/**
 * Plateforme technique d'un site. Valeurs connues pour l'autocomplete, mais
 * ensemble ouvert (varchar côté DB) — extensible sans migration.
 */
export type WebsitePlatform =
    | "wordpress"
    | "shopify"
    | "wix"
    | "webflow"
    | "prestashop"
    | "custom"
    | "other"
    | (string & {});
/**
 * Slug de la stratégie de parsing d'un connecteur. Le registry
 * (lib/connectors) fait foi au runtime ; valeurs V1 listées ici.
 */
export type ConnectorKind = "wordpress-form" | "generic-webhook" | (string & {});
/** Provider d'un credential OAuth générique (connected_accounts). */
export type CredentialProvider = "google" | (string & {});
export type AnalyticsService = "ga4" | "gbp" | "gsc";
export type AppLanguage = "en" | "fr-BE" | "ro";
export type TicketStatus = "open" | "in_progress" | "waiting_on_client" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type Profile = {
    id: string;
    role: UserRole;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    last_login_at: string | null;
    is_blocked: boolean;
    language: AppLanguage;
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
    platform: WebsitePlatform;
    uptime_enabled: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

/** Credential OAuth générique, agnostique du provider (niveau client). */
export type ConnectedAccount = {
    id: string;
    /** null = compte global/agence (admin) ; renseigné = compte spécifique client. */
    client_id: string | null;
    /** Auteur de la connexion (admin ou utilisateur client). */
    created_by: string | null;
    provider: CredentialProvider;
    external_account_id: string | null;
    external_account_label: string | null;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    token_expires_at: string | null;
    scopes: string[];
    metadata: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

/** Porte de collecte attachée à un site. */
export type Connector = {
    id: string;
    website_id: string;
    kind: ConnectorKind;
    name: string;
    /** Nom humain des items produits ("Prospect" / "Formulaire" / "Ticket"). */
    label: string;
    ingest_token: string;
    signing_secret: string;
    config: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

/** Métadonnée à preset (ou texte libre si `type` est null). */
export type Attribute = {
    id: string;
    website_id: string;
    type: string | null;
    title: string;
    value: string;
    is_sensitive: boolean;
    is_admin_only: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
};

/**
 * Soumission entrante : prospect / formulaire / demande. Rattachée au client
 * (pivot), provenance via `connector_id` nullable (null = saisie manuelle).
 */
export type Submission = {
    id: string;
    client_id: string;
    connector_id: string | null;
    form_name: string | null;
    source: SubmissionSource;
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    raw_data: Record<string, unknown>;
    status: SubmissionStatus;
    submitted_at: string;
    created_at: string;
};

export type SubmissionNote = {
    id: string;
    submission_id: string;
    user_id: string;
    content: string;
    created_at: string;
};

/** Liaison site ↔ ressource analytics, adossée à un connected_account. */
export type Integration = {
    id: string;
    website_id: string;
    account_id: string;
    service: AnalyticsService;
    resource_id: string;
    resource_label: string | null;
    config: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type AnalyticsCache = {
    id: string;
    website_id: string;
    service: AnalyticsService;
    metric_type: string;
    period_start: string;
    period_end: string;
    data: Record<string, unknown>;
    fetched_at: string;
    created_at: string;
};

export type UptimeStatus = "up" | "down" | "degraded";

export type UptimeCheck = {
    id: string;
    website_id: string;
    checked_at: string;
    status: UptimeStatus;
    http_status: number | null;
    response_ms: number | null;
    error: string | null;
};

export type UptimeIncident = {
    id: string;
    website_id: string;
    started_at: string;
    resolved_at: string | null;
    last_status: "down" | "degraded";
    created_at: string;
    updated_at: string;
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
    /** Resolved on cross-client views (admin activity feed) for the "showClient" column. */
    client_name?: string | null;
};

export type Ticket = {
    id: string;
    number: number;
    client_id: string;
    created_by: string;
    assigned_to: string | null;
    subject: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    type: string;
    details: Record<string, string>;
    due_date: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type TicketReplyKind = "reply" | "system";

/** Payload structuré d'un reply système (rendu localisé côté UI). */
export type TicketReplySystemMetadata = {
    event?: "status_changed" | "priority_changed" | "assigned";
    from?: string | null;
    /** Pour `assigned` : nom de l'assigné (null = désassigné). */
    to?: string | null;
};

export type TicketReply = {
    id: string;
    ticket_id: string;
    user_id: string;
    content: string;
    is_internal: boolean;
    kind: TicketReplyKind;
    metadata: TicketReplySystemMetadata;
    created_at: string;
};

export type TicketWithDetails = Ticket & {
    client_name: string;
    created_by_name: string;
    assigned_to_name: string | null;
    assigned_to_avatar: string | null;
    reply_count: number;
};

export type TicketReplyWithUser = TicketReply & {
    user_name: string;
    user_role: UserRole;
    user_avatar: string | null;
};

/** Submission enrichie : connecteur d'origine (nullable) + site dérivé + client. */
export type SubmissionFull = Submission & {
    connector_label: string | null;
    connector_kind: ConnectorKind | null;
    website_name: string | null;
    website_url: string | null;
    client_name: string;
};

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Omit<Profile, "created_at" | "updated_at" | "language"> & {
                    language?: AppLanguage;
                };
                Update: Partial<Omit<Profile, "id" | "created_at">>;
                Relationships: [];
            };
            clients: {
                Row: Client;
                Insert: Omit<Client, "id" | "created_at" | "updated_at" | "logo_url"> & {
                    logo_url?: string | null;
                };
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
                    platform?: WebsitePlatform;
                    uptime_enabled?: boolean;
                    is_active?: boolean;
                };
                Update: Partial<Omit<Website, "id" | "created_at">>;
                Relationships: [];
            };
            connected_accounts: {
                Row: ConnectedAccount;
                Insert: {
                    client_id?: string | null;
                    created_by?: string | null;
                    provider: CredentialProvider;
                    external_account_id?: string | null;
                    external_account_label?: string | null;
                    access_token_encrypted?: string | null;
                    refresh_token_encrypted?: string | null;
                    token_expires_at?: string | null;
                    scopes?: string[];
                    metadata?: Record<string, unknown>;
                    is_active?: boolean;
                };
                Update: Partial<Omit<ConnectedAccount, "id" | "created_at">>;
                Relationships: [];
            };
            connectors: {
                Row: Connector;
                Insert: {
                    website_id: string;
                    kind?: ConnectorKind;
                    name?: string;
                    label?: string;
                    config?: Record<string, unknown>;
                    is_active?: boolean;
                };
                Update: Partial<Omit<Connector, "id" | "created_at">>;
                Relationships: [];
            };
            attributes: {
                Row: Attribute;
                Insert: {
                    website_id: string;
                    type?: string | null;
                    title: string;
                    value?: string;
                    is_sensitive?: boolean;
                    is_admin_only?: boolean;
                    sort_order?: number;
                };
                Update: Partial<Omit<Attribute, "id" | "created_at">>;
                Relationships: [];
            };
            submissions: {
                Row: Submission;
                Insert: {
                    client_id: string;
                    connector_id?: string | null;
                    form_name?: string | null;
                    source: SubmissionSource;
                    name?: string | null;
                    email?: string | null;
                    phone?: string | null;
                    message?: string | null;
                    raw_data: Record<string, unknown>;
                    status: SubmissionStatus;
                };
                Update: Partial<Omit<Submission, "id" | "created_at">>;
                Relationships: [];
            };
            submission_notes: {
                Row: SubmissionNote;
                Insert: Omit<SubmissionNote, "id" | "created_at">;
                Update: Partial<Omit<SubmissionNote, "id" | "created_at">>;
                Relationships: [];
            };
            integrations: {
                Row: Integration;
                Insert: {
                    website_id: string;
                    account_id: string;
                    service: AnalyticsService;
                    resource_id: string;
                    resource_label?: string | null;
                    config?: Record<string, unknown>;
                    is_active?: boolean;
                };
                Update: Partial<Omit<Integration, "id" | "created_at">>;
                Relationships: [];
            };
            analytics_cache: {
                Row: AnalyticsCache;
                Insert: Omit<AnalyticsCache, "id" | "fetched_at" | "created_at">;
                Update: Partial<Omit<AnalyticsCache, "id" | "created_at">>;
                Relationships: [];
            };
            uptime_checks: {
                Row: UptimeCheck;
                Insert: Omit<UptimeCheck, "id" | "checked_at"> & { checked_at?: string };
                Update: Partial<Omit<UptimeCheck, "id">>;
                Relationships: [];
            };
            uptime_incidents: {
                Row: UptimeIncident;
                Insert: Omit<UptimeIncident, "id" | "created_at" | "updated_at">;
                Update: Partial<Omit<UptimeIncident, "id" | "created_at">>;
                Relationships: [];
            };
            invites: {
                Row: Invite;
                Insert: Omit<Invite, "id" | "token" | "created_at" | "accepted_at"> & {
                    accepted_at?: string | null;
                };
                Update: Partial<Omit<Invite, "id" | "token" | "created_at">>;
                Relationships: [];
            };
            activity_logs: {
                Row: ActivityLog;
                Insert: Omit<ActivityLog, "id" | "created_at">;
                Update: never;
                Relationships: [];
            };
            tickets: {
                Row: Ticket;
                Insert: Omit<
                    Ticket,
                    | "id"
                    | "number"
                    | "created_at"
                    | "updated_at"
                    | "closed_at"
                    | "assigned_to"
                    | "due_date"
                    | "type"
                    | "details"
                > & {
                    assigned_to?: string | null;
                    due_date?: string | null;
                    closed_at?: string | null;
                    type?: string;
                    details?: Record<string, string>;
                };
                Update: Partial<Omit<Ticket, "id" | "created_at">>;
                Relationships: [];
            };
            ticket_replies: {
                Row: TicketReply;
                Insert: Omit<TicketReply, "id" | "created_at" | "kind" | "metadata"> & {
                    kind?: TicketReplyKind;
                    metadata?: TicketReplySystemMetadata;
                };
                Update: Partial<Omit<TicketReply, "id" | "created_at">>;
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: {
            submission_daily_counts: {
                Args: { p_client_id: string | null; p_days: number };
                Returns: { day: string; count: number }[];
            };
            submission_top_sources: {
                Args: { p_client_id: string | null; p_days: number; p_limit: number };
                Returns: { source: string; count: number }[];
            };
        };
    };
};
