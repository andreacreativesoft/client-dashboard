#!/usr/bin/env tsx
/**
 * Demo data seeding script for VSP / Client Dashboard.
 *
 *   pnpm db:seed           # insert demo data
 *   pnpm db:seed:clear     # remove only the demo data
 *   pnpm db:seed:reset     # clear + create
 *
 * Uses the Supabase service_role key to bypass RLS. Reads env from .env.local
 * (or .env).
 *
 * Demo data is tagged so a clear never touches real records:
 *   - clients.notes starts with the SEED_TAG line "[seed:demo]"
 *   - auth users have an email under the DEMO_EMAIL_DOMAIN
 *
 * ⚠️ SCHÉMA DE RÉFÉRENCE — voir SCHEMA_BASELINE ci-dessous.
 * Ce seed cible le schéma tel qu'il est APRÈS la dernière migration listée.
 * Quand tu ajoutes une migration qui touche une table seedée (colonne, rename,
 * table), mets à jour ce seed ET bump SCHEMA_BASELINE dans le même commit.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { composeDescription, composeSubject, getTicketType } from "@/lib/tickets/ticket-types";
import type {
    Database,
    SubmissionStatus,
    SubmissionSource,
    TicketStatus,
    TicketPriority,
} from "@/types/database";

// Seeds need to backdate timestamps the public Insert types don't expose.
type SubmissionSeed = Database["public"]["Tables"]["submissions"]["Insert"] & {
    submitted_at?: string;
};
type ActivityLogSeed = Database["public"]["Tables"]["activity_logs"]["Insert"] & {
    created_at?: string;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const SEED_TAG = "[seed:demo]";
const DEMO_EMAIL_DOMAIN = "vsp.local";
const DEMO_PASSWORD = "password";

// Dernière migration prise en compte par ce seed (fichier dans supabase/migrations/).
// Sert de repère : si la migration la plus récente du dossier dépasse cette valeur,
// le seed est potentiellement désynchronisé du schéma — à vérifier avant de bump.
const SCHEMA_BASELINE = "003_storage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── Env loading (.env.local then .env, no override of real env) ────────────

function loadEnvFile(path: string): void {
    try {
        const raw = readFileSync(path, "utf8");
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eq = trimmed.indexOf("=");
            if (eq === -1) continue;
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            if (!(key in process.env)) process.env[key] = value;
        }
    } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code !== "ENOENT") throw e;
    }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
        "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local)",
    );
    process.exit(1);
}

const supabase: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const log = {
    info: (msg: string) => console.log(`  ${msg}`),
    step: (msg: string) => console.log(`\n▸ ${msg}`),
    ok: (msg: string) => console.log(`✓ ${msg}`),
    warn: (msg: string) => console.warn(`⚠ ${msg}`),
    err: (msg: string) => console.error(`✗ ${msg}`),
};

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === "object") {
        const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
        const parts = [e.message, e.details, e.hint, e.code].filter(
            (v): v is string => typeof v === "string" && v.length > 0,
        );
        if (parts.length) return parts.join(" | ");
        return JSON.stringify(error);
    }
    return String(error);
}

function die(error: unknown, context: string): never {
    log.err(`${context}: ${errorMessage(error)}`);
    process.exit(1);
}

function pick<T>(arr: readonly T[]): T {
    const item = arr[Math.floor(Math.random() * arr.length)];
    if (item === undefined) throw new Error("pick from empty array");
    return item;
}

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Demo fixtures ──────────────────────────────────────────────────────────

type DemoUser = {
    email: string;
    full_name: string;
    role: "admin" | "client";
    phone: string;
    client_slug: string | null;
};

type DemoWebsite = {
    name: string;
    url: string;
    connector: string;
    info: { label: string; value: string; sensitive: boolean }[];
};

type DemoClient = {
    slug: string;
    business_name: string;
    contact_email: string;
    contact_phone: string;
    websites: DemoWebsite[];
};

type DemoTicket = {
    type: string;
    details: Record<string, string>;
    status: TicketStatus;
    priority: TicketPriority;
};

const DEMO_USERS: DemoUser[] = [
    {
        email: `marie@${DEMO_EMAIL_DOMAIN}`,
        full_name: "Marie Dubois",
        role: "client",
        phone: "+32 478 12 34 56",
        client_slug: "le-jardin",
    },
    {
        email: `paul@${DEMO_EMAIL_DOMAIN}`,
        full_name: "Paul Lefèvre",
        role: "client",
        phone: "+32 471 98 76 54",
        client_slug: "belle-vie",
    },
    {
        email: `sophie@${DEMO_EMAIL_DOMAIN}`,
        full_name: "Sophie Martin",
        role: "client",
        phone: "+32 495 22 33 44",
        client_slug: "atelier-bois",
    },
    {
        email: `admin@${DEMO_EMAIL_DOMAIN}`,
        full_name: "Demo Admin",
        role: "admin",
        phone: "+32 470 00 00 00",
        client_slug: null,
    },
];

const DEMO_CLIENTS: DemoClient[] = [
    {
        slug: "le-jardin",
        business_name: "Restaurant Le Jardin",
        contact_email: "contact@lejardin.be",
        contact_phone: "+32 2 555 12 34",
        websites: [
            {
                name: "Site principal",
                url: "https://lejardin.be",
                connector: "wordpress-form",
                info: [
                    { label: "WP admin", value: "https://lejardin.be/wp-admin", sensitive: false },
                    { label: "Hébergeur", value: "Combell", sensitive: false },
                    { label: "FTP login", value: "lejardin_ftp", sensitive: true },
                ],
            },
        ],
    },
    {
        slug: "belle-vie",
        business_name: "Coiffure Belle Vie",
        contact_email: "info@coiffure-bellevie.be",
        contact_phone: "+32 4 333 55 77",
        websites: [
            {
                name: "Site vitrine",
                url: "https://coiffure-bellevie.be",
                connector: "wordpress-form",
                info: [
                    { label: "Plateforme", value: "WordPress 6.5", sensitive: false },
                    { label: "Thème", value: "Astra Pro", sensitive: false },
                ],
            },
        ],
    },
    {
        slug: "atelier-bois",
        business_name: "Atelier du Bois",
        contact_email: "bonjour@atelierdubois.be",
        contact_phone: "+32 81 22 11 00",
        websites: [
            {
                name: "Site catalogue",
                url: "https://atelierdubois.be",
                connector: "wordpress-form",
                info: [
                    {
                        label: "WP admin",
                        value: "https://atelierdubois.be/wp-login.php",
                        sensitive: false,
                    },
                    { label: "Hébergeur", value: "OVH", sensitive: false },
                ],
            },
            {
                name: "Landing devis cuisine",
                url: "https://atelierdubois.be/devis-cuisine",
                connector: "wordpress-form",
                info: [
                    { label: "Campagne", value: "Google Ads — printemps 2026", sensitive: false },
                ],
            },
        ],
    },
];

const LEAD_NAMES = [
    "Julie Vandenberghe",
    "Marc Lemoine",
    "Camille Petit",
    "Antoine Dubois",
    "Élise Renard",
    "Thomas Moreau",
    "Clara Janssens",
    "Hugo De Smet",
    "Margaux Lefèbvre",
    "Nicolas Verhaegen",
    "Léa Dupont",
    "Romain Charlier",
    "Inès Bauwens",
    "Maxime Claes",
    "Anaïs Pirotte",
    "Florian Mertens",
    "Charlotte Wauters",
    "Adrien Goossens",
    "Manon Lambert",
    "Quentin Henry",
];

const LEAD_MESSAGES = [
    "Bonjour, je souhaiterais avoir un devis pour une équipe de 12 personnes samedi soir.",
    "Possibilité de rendez-vous cette semaine ?",
    "Pouvez-vous me rappeler concernant votre offre ?",
    "Je cherche un prestataire dans la région pour un projet en avril.",
    "Avez-vous des disponibilités le week-end prochain ?",
    "Bonjour, intéressé(e) par vos services. Merci de me recontacter.",
    "Je voudrais réserver une table pour 4 personnes vendredi 19h.",
    "Question sur vos tarifs : pourriez-vous m'envoyer une grille ?",
    "",
];

const FORM_NAMES = ["contact-form", "devis-form", "reservation", "rappel-form", "newsletter"];
const LEAD_STATUSES: SubmissionStatus[] = ["new", "contacted", "done"];
const LEAD_SOURCES: SubmissionSource[] = ["webhook", "manual", "webhook", "webhook"]; // webhook biased

const TICKETS: DemoTicket[] = [
    {
        type: "content_change",
        details: {
            page: "Footer + page Contact",
            changes: "Mettre à jour les horaires d'ouverture",
            new_content:
                "Les nouveaux horaires d'été commencent le 1er juin (9h–18h du lundi au samedi).",
        },
        status: "open",
        priority: "medium",
    },
    {
        type: "bug",
        details: {
            page: "Formulaire de contact",
            problem: "Depuis hier les leads n'arrivent plus.",
            since: "today",
        },
        status: "in_progress",
        priority: "urgent",
    },
    {
        type: "new_page",
        details: {
            objective: "Page « Galerie » pour montrer nos réalisations récentes",
            content: "30 photos prêtes à intégrer.",
        },
        status: "waiting_on_client",
        priority: "low",
    },
    {
        type: "billing",
        details: { topic: "invoice", detail: "Question sur la facturation 2026 (nom de domaine)." },
        status: "closed",
        priority: "low",
    },
];

// ─── DB operations ──────────────────────────────────────────────────────────

type AuthUser = { id: string; email?: string | undefined };

async function listDemoAuthUsers(): Promise<AuthUser[]> {
    const out: AuthUser[] = [];
    let page = 1;
    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) die(error, "listUsers");
        const matches = data.users.filter((u) => u.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`));
        out.push(...matches);
        if (data.users.length < 200) break;
        page += 1;
    }
    return out;
}

async function findOrCreateAuthUser(spec: DemoUser): Promise<string> {
    const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing?.users.find((u) => u.email === spec.email);
    if (found) {
        await supabase
            .from("profiles")
            .update({
                full_name: spec.full_name,
                role: spec.role,
                phone: spec.phone,
                language: "fr-BE",
            })
            .eq("id", found.id);
        return found.id;
    }

    const { data, error } = await supabase.auth.admin.createUser({
        email: spec.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: spec.full_name },
    });
    if (error || !data.user) die(error ?? new Error("no user"), `createUser ${spec.email}`);

    const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: spec.full_name, role: spec.role, phone: spec.phone })
        .eq("id", data.user.id);
    if (pErr) die(pErr, `update profile ${spec.email}`);

    return data.user.id;
}

async function clearDemoData() {
    log.step("Suppression des données démo");

    const { data: demoClients, error: cErr } = await supabase
        .from("clients")
        .select("id")
        .like("notes", `${SEED_TAG}%`);
    if (cErr) die(cErr, "select demo clients");

    const clientIds = (demoClients ?? []).map((c) => c.id);
    log.info(`${clientIds.length} clients démo trouvés`);

    if (clientIds.length > 0) {
        // FK cascades: websites → connectors → submissions/submission_notes,
        // attributes, integrations, analytics_cache, uptime_*, client_users,
        // connected_accounts, tickets, ticket_replies, activity_logs.
        const { error } = await supabase.from("clients").delete().in("id", clientIds);
        if (error) die(error, "delete clients");
        log.ok("Clients démo supprimés (cascade)");
    }

    const authUsers = await listDemoAuthUsers();
    log.info(`${authUsers.length} utilisateurs auth démo trouvés`);
    for (const u of authUsers) {
        const { error } = await supabase.auth.admin.deleteUser(u.id);
        if (error) log.warn(`delete user ${u.email}: ${error.message}`);
    }
    if (authUsers.length) log.ok("Utilisateurs démo supprimés");

    log.ok("Nettoyage terminé");
}

async function createDemoData() {
    log.step("Création des utilisateurs démo");
    type ResolvedUser = DemoUser & { id: string };
    const usersById: Record<string, ResolvedUser> = {};
    for (const spec of DEMO_USERS) {
        const id = await findOrCreateAuthUser(spec);
        usersById[spec.email] = { ...spec, id };
        log.info(`${spec.role.padEnd(6)} → ${spec.email}`);
    }
    log.ok(`${DEMO_USERS.length} utilisateurs prêts (mot de passe: ${DEMO_PASSWORD})`);

    const adminUser = Object.values(usersById).find((u) => u.role === "admin");
    if (!adminUser) die(new Error("no admin user resolved"), "createDemoData");

    log.step("Création des clients + websites + leads");
    let totalLeads = 0;
    let totalTickets = 0;

    for (const c of DEMO_CLIENTS) {
        // Client
        const { data: client, error: clientErr } = await supabase
            .from("clients")
            .insert({
                business_name: c.business_name,
                contact_email: c.contact_email,
                contact_phone: c.contact_phone,
                notes: `${SEED_TAG} compte démo généré par scripts/seed.mjs`,
                created_by: adminUser.id,
            })
            .select("id")
            .single();
        if (clientErr) die(clientErr, `insert client ${c.business_name}`);
        log.info(`Client: ${c.business_name}`);

        // Assign owner user
        const ownerSpec = Object.values(usersById).find((u) => u.client_slug === c.slug);
        if (ownerSpec) {
            const { error } = await supabase.from("client_users").insert({
                user_id: ownerSpec.id,
                client_id: client.id,
                access_role: "owner",
            });
            if (error) die(error, `client_users for ${c.slug}`);
        }

        // Websites
        for (const w of c.websites) {
            const { data: site, error: wErr } = await supabase
                .from("websites")
                .insert({
                    client_id: client.id,
                    name: w.name,
                    url: w.url,
                    platform: "wordpress",
                    is_active: true,
                })
                .select("id")
                .single();
            if (wErr) die(wErr, `insert website ${w.url}`);
            log.info(`  └─ Site: ${w.name} (${w.url})`);

            // Connector (porte de collecte) for this website
            const { data: connector, error: connErr } = await supabase
                .from("connectors")
                .insert({ website_id: site.id, kind: w.connector, name: w.name, label: "Prospect" })
                .select("id")
                .single();
            if (connErr) die(connErr, `insert connector ${w.name}`);

            // Attributes (ex website_info) — infos & accès, admin-only
            if (w.info?.length) {
                const attrRows = w.info.map((i) => ({
                    website_id: site.id,
                    type: null,
                    title: i.label,
                    value: i.value,
                    is_sensitive: i.sensitive,
                    is_admin_only: true,
                }));
                const { error } = await supabase.from("attributes").insert(attrRows);
                if (error) log.warn(`attributes: ${error.message}`);
            }

            // Submissions: 15-30 per website spread over 90 days
            const subCount = randomBetween(15, 30);
            const subRows: SubmissionSeed[] = [];
            for (let i = 0; i < subCount; i++) {
                const name = pick(LEAD_NAMES);
                const message = pick(LEAD_MESSAGES);
                const submittedAt = daysAgo(randomBetween(0, 90));
                const slug = name
                    .toLowerCase()
                    .replace(/\s+/g, ".")
                    .replace(/[^a-z.]/g, "");
                subRows.push({
                    client_id: client.id,
                    connector_id: connector.id,
                    form_name: pick(FORM_NAMES),
                    source: pick(LEAD_SOURCES),
                    name,
                    email: `${slug}@example.com`,
                    phone: `+32 ${randomBetween(450, 499)} ${randomBetween(100000, 999999)}`,
                    message: message || null,
                    raw_data: { _seed: true, form: "demo" },
                    status: pick(LEAD_STATUSES),
                    submitted_at: submittedAt,
                });
            }
            const { data: insertedSubs, error: lErr } = await supabase
                .from("submissions")
                .insert(subRows)
                .select("id, status")
                .overrideTypes<{ id: string; status: SubmissionStatus }[], { merge: false }>();
            if (lErr || !insertedSubs)
                die(lErr ?? new Error("no submissions"), "insert submissions");
            totalLeads += insertedSubs.length;

            // A few notes on contacted/done submissions
            const notedSubs = insertedSubs.filter((s) => s.status !== "new").slice(0, 4);
            if (notedSubs.length) {
                const noteRows = notedSubs.map((s) => ({
                    submission_id: s.id,
                    user_id: adminUser.id,
                    content: pick([
                        "Appelé, rendez-vous fixé jeudi.",
                        "Pas intéressé, à archiver.",
                        "Devis envoyé par email.",
                        "À recontacter dans 2 semaines.",
                    ]),
                }));
                await supabase.from("submission_notes").insert(noteRows);
            }
        }

        // Tickets per client
        const ticketsForClient = TICKETS.slice(0, randomBetween(2, TICKETS.length));
        for (const t of ticketsForClient) {
            const reqType = getTicketType(t.type)!;
            const insertPayload: Database["public"]["Tables"]["tickets"]["Insert"] = {
                client_id: client.id,
                created_by: ownerSpec?.id ?? adminUser.id,
                subject: composeSubject(reqType, t.details),
                description: composeDescription(reqType, t.details, "fr-BE"),
                type: t.type,
                details: t.details,
                status: t.status,
                priority: t.priority,
                closed_at: t.status === "closed" ? daysAgo(randomBetween(1, 30)) : null,
            };

            const { data: ticket, error: tErr } = await supabase
                .from("tickets")
                .insert(insertPayload)
                .select("id")
                .single();
            if (tErr) {
                log.warn(`ticket: ${tErr.message}`);
                continue;
            }
            totalTickets += 1;

            if (t.status !== "open") {
                await supabase.from("ticket_replies").insert({
                    ticket_id: ticket.id,
                    user_id: adminUser.id,
                    content: "Bien reçu, on s'en occupe cette semaine.",
                    is_internal: false,
                });
            }
        }

        // Activity logs
        const actions = [
            { action_type: "client.created", description: `Client ${c.business_name} créé` },
            { action_type: "website.created", description: "Site web ajouté" },
            { action_type: "lead.received", description: "Nouveau lead reçu" },
        ];
        const logRows: ActivityLogSeed[] = actions.map((a, i) => ({
            client_id: client.id,
            user_id: adminUser.id,
            action_type: a.action_type,
            description: a.description,
            metadata: {},
            created_at: daysAgo(30 - i),
        }));
        await supabase.from("activity_logs").insert(logRows);
    }

    log.ok(`${DEMO_CLIENTS.length} clients, ${totalLeads} leads, ${totalTickets} tickets`);

    log.step("Récapitulatif comptes démo");
    for (const u of DEMO_USERS) {
        console.log(`  · ${u.role.padEnd(6)} ${u.email}  (pwd: ${DEMO_PASSWORD})`);
    }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main() {
    const cmd = process.argv[2];
    log.info(`Schéma de référence du seed : ${SCHEMA_BASELINE}`);
    switch (cmd) {
        case "create":
            await createDemoData();
            break;
        case "clear":
            await clearDemoData();
            break;
        case "reset":
            await clearDemoData();
            await createDemoData();
            break;
        default:
            console.log("Usage: tsx scripts/seed.ts <create | clear | reset>");
            console.log("");
            console.log("  create   Insère les données de démo (idempotent)");
            console.log("  clear    Supprime uniquement les données taguées démo");
            console.log("  reset    clear puis create");
            process.exit(cmd ? 1 : 0);
    }
}

main().catch((e) => die(e, "seed"));
