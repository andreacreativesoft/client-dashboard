"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { updateAvatarAction } from "@/lib/actions/profile";
import { useLanguage } from "@/lib/i18n/language-context";
import { createClient } from "@/lib/supabase/client";

interface AvatarUploadProps {
    currentAvatarUrl: string | null;
    userName: string;
    userId: string;
}

export function AvatarUpload({ currentAvatarUrl, userName, userId }: AvatarUploadProps) {
    const router = useRouter();
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setError(t("settings.avatar_invalid_type"));
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError(t("settings.avatar_too_large"));
            return;
        }

        setUploading(true);
        setError("");

        try {
            const supabase = createClient();

            // Create a unique filename
            const fileExt = file.name.split(".").pop();
            const fileName = `${userId}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload to Supabase storage
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file, {
                    cacheControl: "3600",
                    upsert: true,
                });

            if (uploadError) {
                // If bucket doesn't exist, show helpful message
                if (
                    uploadError.message.includes("bucket") ||
                    uploadError.message.includes("not found")
                ) {
                    setError(t("settings.avatar_storage_error"));
                } else {
                    setError(uploadError.message);
                }
                setUploading(false);
                return;
            }

            // Get public URL
            const {
                data: { publicUrl },
            } = supabase.storage.from("avatars").getPublicUrl(filePath);

            // Update profile with new avatar URL
            const result = await updateAvatarAction(publicUrl);

            if (!result.success) {
                setError(result.error || t("settings.avatar_update_failed"));
                setUploading(false);
                return;
            }

            setPreviewUrl(publicUrl);
            router.refresh();
        } catch (err) {
            console.error("Upload error:", err);
            setError(t("settings.avatar_upload_failed"));
        }

        setUploading(false);
    }

    async function handleRemove() {
        setUploading(true);
        setError("");

        const result = await updateAvatarAction(null);

        if (!result.success) {
            setError(result.error || t("settings.avatar_remove_failed"));
            setUploading(false);
            return;
        }

        setPreviewUrl(null);
        setUploading(false);
        router.refresh();
    }

    return (
        <div className="flex items-center gap-4">
            {/* Avatar preview */}
            <Avatar name={userName} src={previewUrl} size="2xl" />

            {/* Actions */}
            <div className="space-y-2">
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}>
                        {uploading
                            ? t("settings.avatar_uploading")
                            : previewUrl
                              ? t("settings.avatar_change")
                              : t("settings.avatar_upload")}
                    </Button>
                    {previewUrl && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemove}
                            disabled={uploading}>
                            {t("settings.avatar_remove")}
                        </Button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.avatar_hint")}</p>
                {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}
