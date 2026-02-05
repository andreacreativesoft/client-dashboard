"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
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

const SOURCE_TYPES = [
  { value: "elementor", label: "Elementor Forms" },
  { value: "contact_form_7", label: "Contact Form 7" },
  { value: "wpforms", label: "WPForms" },
  { value: "gravity_forms", label: "Gravity Forms" },
  { value: "custom", label: "Custom / Other" },
];

export function WebsiteForm({ open, onClose, clientId, website }: WebsiteFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!website;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const formData: WebsiteFormData = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      url: (form.elements.namedItem("url") as HTMLInputElement).value,
      source_type: (form.elements.namedItem("source_type") as HTMLSelectElement).value,
    };

    const result = isEdit
      ? await updateWebsiteAction(website.id, formData)
      : await createWebsiteAction(clientId, formData);

    setLoading(false);

    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }

    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Website" : "Add Website"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Website Name *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={website?.name || ""}
            placeholder="Main Website"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">Website URL *</Label>
          <Input
            id="url"
            name="url"
            type="url"
            required
            defaultValue={website?.url || "https://"}
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source_type">Form Source</Label>
          <select
            id="source_type"
            name="source_type"
            defaultValue={website?.source_type || "elementor"}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {SOURCE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Website"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
