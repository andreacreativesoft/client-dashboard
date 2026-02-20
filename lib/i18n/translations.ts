import type { AppLanguage } from "@/types/database";

export type TranslationKey = keyof typeof en;

const en = {
  // Navigation - Sidebar
  "nav.main": "Main",
  "nav.admin_section": "Admin",
  "nav.overview": "Overview",
  "nav.leads": "Leads",
  "nav.google_analytics": "Google Analytics",
  "nav.search_console": "Search Console",
  "nav.google_business": "Google Business",
  "nav.reports": "Reports",
  "nav.settings": "Settings",
  "nav.admin": "Admin",
  "nav.clients": "Clients",
  "nav.users": "Users",
  "nav.websites": "Websites",
  "nav.tools": "Tools",

  // Mobile nav
  "nav.home": "Home",
  "nav.ga4": "GA4",
  "nav.gsc": "GSC",
  "nav.gbp": "GBP",

  // Header
  "header.admin": "Admin",
  "header.sign_out": "Sign out",
  "header.edit_profile": "Edit profile",

  // Language
  "language.label": "Language",
  "language.en": "English",
  "language.fr_be": "Fran\u00e7ais (Belgique)",

  // Dashboard
  "dashboard.greeting_morning": "Good morning",
  "dashboard.greeting_afternoon": "Good afternoon",
  "dashboard.greeting_evening": "Good evening",
  "dashboard.total_leads": "Total Leads",
  "dashboard.last_30_days": "Last 30 days",
  "dashboard.new": "New",
  "dashboard.awaiting_contact": "Awaiting contact",
  "dashboard.contacted": "Contacted",
  "dashboard.in_progress": "In progress",
  "dashboard.done": "Done",
  "dashboard.completed": "Completed",
  "dashboard.your_websites": "Your Websites",
  "dashboard.wp_admin": "WP Admin",
  "dashboard.recent_leads": "Recent Leads",
  "dashboard.view_all": "View all",

  // Leads
  "leads.title": "Leads",
  "leads.all": "All",
  "leads.new": "New",
  "leads.contacted": "Contacted",
  "leads.done": "Done",
  "leads.no_leads": "No leads found",
  "leads.showing": "Showing",
  "leads.of": "of",
  "leads.previous": "Previous",
  "leads.next": "Next",

  // Analytics
  "analytics.title": "Google Analytics",
  "analytics.lead_analytics": "Lead Analytics",
  "analytics.this_week": "This Week",
  "analytics.last_7_days": "Last 7 days",
  "analytics.conversion": "Conversion",
  "analytics.marked_as_done": "Marked as done",
  "analytics.active_sources": "Active Sources",
  "analytics.with_leads": "With leads",
  "analytics.lead_trend": "Lead Trend (30 days)",
  "analytics.days_ago": "30 days ago",
  "analytics.today": "Today",
  "analytics.status_breakdown": "Status Breakdown",
  "analytics.top_sources": "Top Sources",
  "analytics.no_leads_yet": "No leads yet",

  // Reports
  "reports.title": "Reports",
  "reports.no_reports": "No reports yet. Monthly reports will appear here automatically.",
  "reports.period": "Period",
  "reports.generated": "Generated",
  "reports.size": "Size",

  // Settings
  "settings.title": "Settings",
  "settings.profile": "Profile",
  "settings.profile_photo": "Profile Photo",
  "settings.email": "Email",
  "settings.email_no_change": "Email cannot be changed",
  "settings.full_name": "Full Name",
  "settings.phone": "Phone",
  "settings.save_changes": "Save Changes",
  "settings.saving": "Saving...",
  "settings.profile_updated": "Profile updated successfully",
  "settings.profile_update_failed": "Failed to update profile",
  "settings.change_password": "Change Password",
  "settings.new_password": "New Password",
  "settings.confirm_password": "Confirm Password",
  "settings.min_8_chars": "Min 8 characters",
  "settings.confirm_new_password": "Confirm new password",
  "settings.passwords_no_match": "Passwords do not match",
  "settings.password_min_length": "Password must be at least 8 characters",
  "settings.password_changed": "Password changed successfully",
  "settings.password_change_failed": "Failed to change password",
  "settings.changing": "Changing...",
  "settings.notifications": "Notifications",
  "settings.account": "Account",
  "settings.role": "Role",
  "settings.member_since": "Member since",

  // Common
  "common.loading": "Loading...",
  "common.error": "Error",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.create": "Create",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.no_data": "No data available",
} as const;

const frBE: Record<TranslationKey, string> = {
  // Navigation - Sidebar
  "nav.main": "Principal",
  "nav.admin_section": "Admin",
  "nav.overview": "Aper\u00e7u",
  "nav.leads": "Prospects",
  "nav.google_analytics": "Google Analytics",
  "nav.search_console": "Search Console",
  "nav.google_business": "Google Business",
  "nav.reports": "Rapports",
  "nav.settings": "Param\u00e8tres",
  "nav.admin": "Admin",
  "nav.clients": "Clients",
  "nav.users": "Utilisateurs",
  "nav.websites": "Sites web",
  "nav.tools": "Outils",

  // Mobile nav
  "nav.home": "Accueil",
  "nav.ga4": "GA4",
  "nav.gsc": "GSC",
  "nav.gbp": "GBP",

  // Header
  "header.admin": "Admin",
  "header.sign_out": "D\u00e9connexion",
  "header.edit_profile": "Modifier le profil",

  // Language
  "language.label": "Langue",
  "language.en": "English",
  "language.fr_be": "Fran\u00e7ais (Belgique)",

  // Dashboard
  "dashboard.greeting_morning": "Bonjour",
  "dashboard.greeting_afternoon": "Bon apr\u00e8s-midi",
  "dashboard.greeting_evening": "Bonsoir",
  "dashboard.total_leads": "Total prospects",
  "dashboard.last_30_days": "30 derniers jours",
  "dashboard.new": "Nouveau",
  "dashboard.awaiting_contact": "En attente de contact",
  "dashboard.contacted": "Contact\u00e9",
  "dashboard.in_progress": "En cours",
  "dashboard.done": "Termin\u00e9",
  "dashboard.completed": "Termin\u00e9",
  "dashboard.your_websites": "Vos sites web",
  "dashboard.wp_admin": "WP Admin",
  "dashboard.recent_leads": "Prospects r\u00e9cents",
  "dashboard.view_all": "Voir tout",

  // Leads
  "leads.title": "Prospects",
  "leads.all": "Tous",
  "leads.new": "Nouveau",
  "leads.contacted": "Contact\u00e9",
  "leads.done": "Termin\u00e9",
  "leads.no_leads": "Aucun prospect trouv\u00e9",
  "leads.showing": "Affichage de",
  "leads.of": "sur",
  "leads.previous": "Pr\u00e9c\u00e9dent",
  "leads.next": "Suivant",

  // Analytics
  "analytics.title": "Google Analytics",
  "analytics.lead_analytics": "Analyse des prospects",
  "analytics.this_week": "Cette semaine",
  "analytics.last_7_days": "7 derniers jours",
  "analytics.conversion": "Conversion",
  "analytics.marked_as_done": "Marqu\u00e9 comme termin\u00e9",
  "analytics.active_sources": "Sources actives",
  "analytics.with_leads": "Avec prospects",
  "analytics.lead_trend": "Tendance prospects (30 jours)",
  "analytics.days_ago": "Il y a 30 jours",
  "analytics.today": "Aujourd\u2019hui",
  "analytics.status_breakdown": "R\u00e9partition par statut",
  "analytics.top_sources": "Meilleures sources",
  "analytics.no_leads_yet": "Pas encore de prospects",

  // Reports
  "reports.title": "Rapports",
  "reports.no_reports": "Pas encore de rapports. Les rapports mensuels appara\u00eetront ici automatiquement.",
  "reports.period": "P\u00e9riode",
  "reports.generated": "G\u00e9n\u00e9r\u00e9",
  "reports.size": "Taille",

  // Settings
  "settings.title": "Param\u00e8tres",
  "settings.profile": "Profil",
  "settings.profile_photo": "Photo de profil",
  "settings.email": "E-mail",
  "settings.email_no_change": "L\u2019e-mail ne peut pas \u00eatre modifi\u00e9",
  "settings.full_name": "Nom complet",
  "settings.phone": "T\u00e9l\u00e9phone",
  "settings.save_changes": "Enregistrer",
  "settings.saving": "Enregistrement...",
  "settings.profile_updated": "Profil mis \u00e0 jour avec succ\u00e8s",
  "settings.profile_update_failed": "\u00c9chec de la mise \u00e0 jour du profil",
  "settings.change_password": "Changer le mot de passe",
  "settings.new_password": "Nouveau mot de passe",
  "settings.confirm_password": "Confirmer le mot de passe",
  "settings.min_8_chars": "Min 8 caract\u00e8res",
  "settings.confirm_new_password": "Confirmer le nouveau mot de passe",
  "settings.passwords_no_match": "Les mots de passe ne correspondent pas",
  "settings.password_min_length": "Le mot de passe doit contenir au moins 8 caract\u00e8res",
  "settings.password_changed": "Mot de passe chang\u00e9 avec succ\u00e8s",
  "settings.password_change_failed": "\u00c9chec du changement de mot de passe",
  "settings.changing": "Changement...",
  "settings.notifications": "Notifications",
  "settings.account": "Compte",
  "settings.role": "R\u00f4le",
  "settings.member_since": "Membre depuis",

  // Common
  "common.loading": "Chargement...",
  "common.error": "Erreur",
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.edit": "Modifier",
  "common.create": "Cr\u00e9er",
  "common.search": "Rechercher",
  "common.filter": "Filtrer",
  "common.no_data": "Aucune donn\u00e9e disponible",
};

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en,
  "fr-BE": frBE,
};

export function t(language: AppLanguage, key: TranslationKey): string {
  return translations[language]?.[key] ?? translations.en[key] ?? key;
}

export const SUPPORTED_LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr-BE", label: "Fran\u00e7ais (Belgique)" },
];

export { translations };
