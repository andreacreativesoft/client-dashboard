import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Good morning</h1>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          { label: "New Leads", value: "—", sub: "30 days" },
          { label: "Calls", value: "—", sub: "30 days" },
          { label: "Visitors", value: "—", sub: "30 days" },
          { label: "Directions", value: "—", sub: "30 days" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm font-medium">{stat.label}</p>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent leads placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No leads yet. Connect a website to start receiving leads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
