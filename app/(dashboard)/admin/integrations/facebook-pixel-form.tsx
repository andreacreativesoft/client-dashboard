"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addFacebookIntegration } from "@/lib/actions/integrations";

interface Client {
  id: string;
  business_name: string;
}

interface FacebookPixelFormProps {
  clients: Client[];
}

export function FacebookPixelForm({ clients }: FacebookPixelFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const clientId = (form.elements.namedItem("client_id") as HTMLSelectElement).value;
    const pixelId = (form.elements.namedItem("pixel_id") as HTMLInputElement).value;
    const accessToken = (form.elements.namedItem("access_token") as HTMLInputElement).value;
    const testEventCode = (form.elements.namedItem("test_event_code") as HTMLInputElement).value;

    const result = await addFacebookIntegration(
      clientId,
      pixelId,
      accessToken,
      testEventCode || undefined
    );

    setLoading(false);

    if (result.success) {
      setIsOpen(false);
      form.reset();
      router.refresh();
    } else {
      setError(result.error || "Failed to add integration");
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        Add Facebook Pixel
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="client_id">Client</Label>
        <select
          id="client_id"
          name="client_id"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.business_name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pixel_id">Pixel ID</Label>
        <Input
          id="pixel_id"
          name="pixel_id"
          required
          placeholder="123456789012345"
        />
        <p className="text-xs text-muted-foreground">
          Find this in Facebook Events Manager under Data Sources
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="access_token">Conversions API Access Token</Label>
        <Input
          id="access_token"
          name="access_token"
          type="password"
          required
          placeholder="EAAxxxxxxx..."
        />
        <p className="text-xs text-muted-foreground">
          Generate in Events Manager &gt; Settings &gt; Conversions API &gt; Generate Access Token
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="test_event_code">Test Event Code (optional)</Label>
        <Input
          id="test_event_code"
          name="test_event_code"
          placeholder="TEST12345"
        />
        <p className="text-xs text-muted-foreground">
          Use this during testing to see events in Events Manager Test Events tab
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
