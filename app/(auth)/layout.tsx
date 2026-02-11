import { ThemeToggle } from "@/components/theme-toggle";
import { RecaptchaProvider } from "@/components/recaptcha-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RecaptchaProvider>
      <div className="relative flex min-h-dvh items-center justify-center bg-muted p-4">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </RecaptchaProvider>
  );
}
