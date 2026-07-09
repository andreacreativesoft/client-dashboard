#!/usr/bin/env tsx
/**
 * Simulateur d'arrivée sur un connecteur d'ingestion (dev).
 *
 *   pnpm ingest:sim                       # 1 envoi sur le 1er connecteur actif
 *   pnpm ingest:sim wordpress-form        # cible un connecteur de ce kind
 *   pnpm ingest:sim generic-webhook --count=5
 *   pnpm ingest:sim --token=<ingest_token>   # cible un connecteur précis
 *   pnpm ingest:sim --url=https://sandbox.exemple.be   # cible un déploiement
 *
 * Reproduit un vrai POST :
 *   POST {url}/api/ingest/<kind>/<token>  + header x-signature (HMAC-SHA256
 *   du corps avec le signing_secret du connecteur). Cible par défaut le serveur
 *   dev local (http://localhost:8201) ; --url pour un autre hôte.
 *
 * Lit l'env (.env.local puis .env) : NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY (pour trouver un connecteur), NEXT_PUBLIC_APP_URL.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── Env loading (.env.local then .env, no override of real env) ────────────
function loadEnvFile(path: string): void {
    try {
        for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
    } catch {
        /* fichier absent : on ignore */
    }
}
loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

// ─── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string) =>
    args
        .find((a) => a.startsWith(`--${name}=`))
        ?.split("=")
        .slice(1)
        .join("=");
const kindArg = args.find((a) => !a.startsWith("--"));
const tokenArg = flag("token");
const count = Math.max(1, parseInt(flag("count") || "1", 10) || 1);

// ─── Données aléatoires ───────────────────────────────────────────────────────
const NAMES = ["Marie Dupont", "Paul Lefèvre", "Sophie Martin", "Luc Bernard", "Emma Petit"];
const MESSAGES = [
    "Bonjour, je souhaite un devis pour la rénovation de ma cuisine.",
    "Pouvez-vous me rappeler concernant vos services ?",
    "Intéressé par une démonstration, merci de me contacter.",
    "Question sur vos tarifs et délais.",
];
const FORMS = ["Contact", "Devis", "Rappel", "Newsletter"];
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

function samplePayload(): Record<string, unknown> {
    const name = pick(NAMES);
    const slug = name
        .toLowerCase()
        .replace(/\s+/g, ".")
        .replace(/[^a-z.]/g, "");
    return {
        name,
        email: `${slug}@example.com`,
        phone: `+32 4${Math.floor(70 + Math.random() * 9)} ${Math.floor(100000 + Math.random() * 899999)}`,
        message: pick(MESSAGES),
        form_name: pick(FORMS),
        _sim: true,
    };
}

async function main() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Cible le serveur dev local par défaut (port du script `dev`) ; --url override.
    const appUrl = (flag("url") || "http://localhost:8201").replace(/\/$/, "");
    if (!supabaseUrl || !serviceKey) {
        console.error("✗ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // Sélection du connecteur cible.
    let query = supabase
        .from("connectors")
        .select("id, kind, name, ingest_token, signing_secret, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);
    if (tokenArg) query = supabase.from("connectors").select("*").eq("ingest_token", tokenArg);
    else if (kindArg) query = query.eq("kind", kindArg);

    const { data: rows, error } = await query;
    if (error) {
        console.error("✗ Erreur DB :", error.message);
        process.exit(1);
    }
    const connector = rows?.[0];
    if (!connector) {
        console.error(
            `✗ Aucun connecteur actif trouvé${kindArg ? ` de kind « ${kindArg} »` : ""}. Crée-en un sur la fiche client.`,
        );
        process.exit(1);
    }

    const url = `${appUrl}/api/ingest/${connector.kind}/${connector.ingest_token}`;
    console.log(`▸ Cible : ${connector.kind} — « ${connector.name || connector.id}»`);
    console.log(`  ${url}\n`);

    let ok = 0;
    for (let i = 0; i < count; i++) {
        const body = JSON.stringify(samplePayload());
        const signature = createHmac("sha256", connector.signing_secret).update(body).digest("hex");
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-signature": signature },
                body,
            });
            const text = await res.text();
            if (res.ok) {
                ok++;
                console.log(`  ✓ ${i + 1}/${count} → ${res.status} ${text}`);
            } else {
                console.log(`  ✗ ${i + 1}/${count} → ${res.status} ${text}`);
            }
        } catch (e) {
            console.log(`  ✗ ${i + 1}/${count} → ${e instanceof Error ? e.message : e}`);
            console.log("    (le serveur dev tourne-t-il sur " + appUrl + " ?)");
            break;
        }
    }
    console.log(`\n✓ ${ok}/${count} soumission(s) envoyée(s).`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
