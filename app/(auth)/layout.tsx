import { RecaptchaProvider } from "@/components/recaptcha-provider";
import { LoginDecorativePanel } from "@/components/login-decorative-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RecaptchaProvider>
      <div className="flex h-dvh">
        {/* Left side — form */}
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-white px-6 py-12">
          {/* Logo */}
          <div className="absolute left-8 top-8 flex items-center gap-2 lg:left-[72px] lg:top-[72px]">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-7 text-[#2A5959]"
            >
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
              <ellipse cx="16" cy="16" rx="8" ry="14" stroke="currentColor" strokeWidth="2" />
              <path d="M2 16h28" stroke="currentColor" strokeWidth="2" />
              <path d="M4 8h24" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 24h24" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-lg font-bold text-[#2A5959]">
              Votre Site Pro
            </span>
          </div>

          <div className="w-full max-w-[576px]">{children}</div>
        </div>

        {/* Right side — decorative */}
        <LoginDecorativePanel />
      </div>
    </RecaptchaProvider>
  );
}
