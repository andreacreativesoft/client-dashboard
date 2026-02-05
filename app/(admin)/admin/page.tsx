import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Admin Panel</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Total Clients", value: "—" },
          { title: "Total Leads (30d)", value: "—" },
          { title: "Active Integrations", value: "—" },
        ].map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
