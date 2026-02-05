// Activity action types for consistency
export const ActivityTypes = {
  // Lead actions
  LEAD_CREATED: "lead_created",
  LEAD_STATUS_CHANGED: "lead_status_changed",
  LEAD_NOTE_ADDED: "lead_note_added",

  // Client actions
  CLIENT_CREATED: "client_created",
  CLIENT_UPDATED: "client_updated",

  // Website actions
  WEBSITE_ADDED: "website_added",
  WEBSITE_REMOVED: "website_removed",

  // User actions
  USER_INVITED: "user_invited",
  USER_JOINED: "user_joined",
  USER_ASSIGNED: "user_assigned",
  USER_REMOVED: "user_removed",

  // Integration actions
  ANALYTICS_SYNCED: "analytics_synced",
  INTEGRATION_CONNECTED: "integration_connected",
  INTEGRATION_DISCONNECTED: "integration_disconnected",

  // Report actions
  REPORT_GENERATED: "report_generated",
  REPORT_SENT: "report_sent",
} as const;

export type ActivityType = (typeof ActivityTypes)[keyof typeof ActivityTypes];
