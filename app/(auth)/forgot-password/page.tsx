import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email to receive a reset link
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Coming in Phase 2
      </p>
    </div>
  );
}
