"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarAction } from "@/lib/actions/profile";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  userName: string;
  userId: string;
}

export function AvatarUpload({ currentAvatarUrl, userName, userId }: AvatarUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);

  // Get initials for fallback
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
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
        if (uploadError.message.includes("bucket") || uploadError.message.includes("not found")) {
          setError("Storage not configured. Create 'avatars' bucket in Supabase.");
        } else {
          setError(uploadError.message);
        }
        setUploading(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const result = await updateAvatarAction(publicUrl);

      if (!result.success) {
        setError(result.error || "Failed to update profile");
        setUploading(false);
        return;
      }

      setPreviewUrl(publicUrl);
      router.refresh();
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image");
    }

    setUploading(false);
  }

  async function handleRemove() {
    setUploading(true);
    setError("");

    const result = await updateAvatarAction(null);

    if (!result.success) {
      setError(result.error || "Failed to remove avatar");
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
      {previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={previewUrl}
          alt={userName}
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {initials || "U"}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : previewUrl ? "Change" : "Upload"}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG or GIF. Max 2MB.
        </p>
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
