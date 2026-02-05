import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Websites",
};

export default function WebsitesPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Websites</h1>
        <button
          className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background opacity-50"
          disabled
        >
          Add Website
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Websites</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Website management will be implemented in Phase 3.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
