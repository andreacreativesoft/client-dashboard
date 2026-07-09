/**
 * Hook d'instrumentation Next.js — exécuté une fois au démarrage du serveur.
 *
 * On y vérifie la configuration OAuth Google (variables d'env + scopes/APIs
 * requis) et on loggue un warning serveur si les connexions Google (GA4 / GBP /
 * GSC) seraient indisponibles. Diagnostic uniquement : aucun appel réseau, aucun
 * impact sur le démarrage.
 */
export async function register() {
    // Ne tourne que côté serveur Node (pas sur le runtime edge du middleware).
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const { getGoogleOAuthConfigStatus, REQUIRED_DATA_SCOPES, REQUIRED_GOOGLE_APIS } =
        await import("@/lib/google");

    const status = getGoogleOAuthConfigStatus();

    if (!status.ok) {
        console.warn(
            `[google-oauth] Configuration incomplète : ${status.missing.join(", ")}. ` +
                "Les connexions Google (GA4 / Business Profile / Search Console) seront indisponibles " +
                "tant que ces variables ne sont pas définies.",
        );
        return;
    }

    console.info(
        "[google-oauth] Configuration OK. Vérifier côté Google Cloud que les APIs suivantes " +
            `sont activées : ${REQUIRED_GOOGLE_APIS.join(" · ")}. ` +
            `Scopes de données requis au consentement : ${REQUIRED_DATA_SCOPES.join(" ")}.`,
    );
}
