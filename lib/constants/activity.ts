export const ActivityTypes = {
    SUBMISSION_CREATED: "submission_created",
    SUBMISSION_STATUS_CHANGED: "submission_status_changed",
    SUBMISSION_NOTE_ADDED: "submission_note_added",

    CONNECTOR_CREATED: "connector_created",
    CONNECTOR_UPDATED: "connector_updated",
    CONNECTOR_DELETED: "connector_deleted",

    TICKET_CREATED: "ticket_created",
    TICKET_REPLIED: "ticket_replied",
    TICKET_STATUS_CHANGED: "ticket_status_changed",

    CLIENT_CREATED: "client_created",
    CLIENT_UPDATED: "client_updated",

    WEBSITE_ADDED: "website_added",
    WEBSITE_UPDATED: "website_updated",
    WEBSITE_REMOVED: "website_removed",

    ATTRIBUTE_ADDED: "attribute_added",
    ATTRIBUTE_UPDATED: "attribute_updated",
    ATTRIBUTE_REMOVED: "attribute_removed",

    USER_INVITED: "user_invited",
    USER_JOINED: "user_joined",
    USER_ASSIGNED: "user_assigned",
    USER_REMOVED: "user_removed",

    ANALYTICS_SYNCED: "analytics_synced",
    INTEGRATION_CONNECTED: "integration_connected",
    INTEGRATION_DISCONNECTED: "integration_disconnected",

    EMAIL_SENT: "email_sent",
} as const;

export type ActivityType = (typeof ActivityTypes)[keyof typeof ActivityTypes];
