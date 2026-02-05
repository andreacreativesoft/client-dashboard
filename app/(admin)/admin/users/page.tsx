import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Users",
};

export default function UsersPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button
          className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background opacity-50"
          disabled
        >
          Add User
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            User management will be implemented in Phase 3.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
