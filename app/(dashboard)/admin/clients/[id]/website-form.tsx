"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    createWebsiteAction,
    updateWebsiteAction,
    type WebsiteFormData,
} from "@/lib/actions/websites";
import type { Website } from "@/types/database";

interface WebsiteFormProps {
    open: boolean;
    onClose: () => void;
    clientId: string;
    website?: Website | null;
}

// Plateformes connues (le champ DB reste ouvert ; cette liste pilote le select).
const PLATFORMS = [
    { value: "wordpress", label: "WordPress" },
    { value: "shopify", label: "Shopify" },
    { value: "wix", label: "Wix" },
    { value: "webflow", label: "Webflow" },
    { value: "prestashop", label: "PrestaShop" },
    { value: "custom", label: "Sur-mesure" },
    { value: "other", label: "Autre" },
];

export function WebsiteForm({ open, onClose, clientId, website }: WebsiteFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [platform, setPlatform] = useState(website?.platform || "wordpress");

    const isEdit = !!website;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const form = e.currentTarget;
        const formData: WebsiteFormData = {
            name: (form.elements.namedItem("name") as HTMLInputElement).value,
            url: (form.elements.namedItem("url") as HTMLInputElement).value,
            platform,
        };

        const result = isEdit
            ? await updateWebsiteAction(website.id, formData)
            : await createWebsiteAction(clientId, formData);

        setLoading(false);

        if (!result.success) {
            setError(result.error || "Une erreur est survenue");
            return;
        }

        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={isEdit ? "Modifier le site" : "Ajouter un site"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nom du site *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        defaultValue={website?.name || ""}
                        placeholder="Site principal"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="url">URL du site *</Label>
                    <Input
                        id="url"
                        name="url"
                        type="url"
                        required
                        defaultValue={website?.url || "https://"}
                        placeholder="https://exemple.be"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="platform">Plateforme</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger id="platform" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PLATFORMS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Annuler
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter le site"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
