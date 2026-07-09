"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type SwitcherWebsite = { id: string; name: string };

type SelectedWebsiteValue = {
    websites: SwitcherWebsite[];
    /** null tant que la résolution client (localStorage) n'a pas eu lieu, ou si 0 site. */
    selectedWebsiteId: string | null;
    setSelectedWebsiteId: (id: string) => void;
};

const SelectedWebsiteContext = createContext<SelectedWebsiteValue | null>(null);

function storageKey(clientId: string | null): string | null {
    return clientId ? `vsp:selectedWebsite:${clientId}` : null;
}

export function SelectedWebsiteProvider({
    websites,
    clientId,
    children,
}: {
    websites: SwitcherWebsite[];
    clientId: string | null;
    children: React.ReactNode;
}) {
    const [selectedWebsiteId, setSelected] = useState<string | null>(null);

    // Clé stable = liste des ids ; évite de re-résoudre à chaque nouveau tableau.
    const idsKey = websites.map((w) => w.id).join(",");

    // Résolution initiale côté client : choix mémorisé s'il est encore valide,
    // sinon le premier site. (En SSR selectedWebsiteId reste null → pas de
    // mismatch d'hydratation.)
    useEffect(() => {
        if (websites.length === 0) {
            setSelected(null);
            return;
        }
        const key = storageKey(clientId);
        const stored = key ? window.localStorage.getItem(key) : null;
        const isValid = stored ? websites.some((w) => w.id === stored) : false;
        setSelected(isValid ? stored : (websites[0]?.id ?? null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId, idsKey]);

    const setSelectedWebsiteId = useCallback(
        (id: string) => {
            setSelected(id);
            const key = storageKey(clientId);
            if (key) window.localStorage.setItem(key, id);
        },
        [clientId],
    );

    return (
        <SelectedWebsiteContext.Provider
            value={{ websites, selectedWebsiteId, setSelectedWebsiteId }}>
            {children}
        </SelectedWebsiteContext.Provider>
    );
}

/**
 * Site courant du sélecteur global. Hors provider (ex. espace agence) → aucune
 * sélection : les vues site-scopées afficheront leur état « pas de site ».
 */
export function useSelectedWebsite(): SelectedWebsiteValue {
    const ctx = useContext(SelectedWebsiteContext);
    if (!ctx) {
        return { websites: [], selectedWebsiteId: null, setSelectedWebsiteId: () => {} };
    }
    return ctx;
}
