import { M_PLUS_1 } from "next/font/google";
import { RecaptchaProvider } from "@/components/recaptcha-provider";
import { LoginDecorativePanel } from "@/components/login-decorative-panel";

const mplus1 = M_PLUS_1({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-mplus1",
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RecaptchaProvider>
      <div className={`flex h-dvh font-[Helvetica,Arial,sans-serif] ${mplus1.variable}`}>
        {/* Left side — form */}
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-white px-6">
          <div className="flex w-full max-w-[576px] flex-1 flex-col">
            {/* Logo — aligned with form left edge */}
            <div className="flex items-center gap-2 pb-8 pt-8 lg:pt-[72px]">
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

            {/* Form — vertically centered in remaining space */}
            <div className="flex flex-1 items-center pb-12">
              <div className="w-full">{children}</div>
            </div>
          </div>
        </div>

        {/* Right side — decorative */}
        <LoginDecorativePanel />
      </div>
    </RecaptchaProvider>
  );
}
