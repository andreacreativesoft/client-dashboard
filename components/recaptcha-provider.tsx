"use client";

import Script from "next/script";
import { createContext, useCallback, useContext } from "react";

// ─── Types ────────────────────────────────────────────────────────────

interface RecaptchaContextValue {
  executeRecaptcha: (action: string) => Promise<string | undefined>;
  isReady: boolean;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

// ─── Context ──────────────────────────────────────────────────────────

const RecaptchaContext = createContext<RecaptchaContextValue>({
  executeRecaptcha: async () => undefined,
  isReady: false,
});

export function useRecaptcha() {
  return useContext(RecaptchaContext);
}

// ─── Provider ─────────────────────────────────────────────────────────

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export function RecaptchaProvider({ children }: { children: React.ReactNode }) {
  const executeRecaptcha = useCallback(async (action: string): Promise<string | undefined> => {
    if (!SITE_KEY || !window.grecaptcha) {
      return undefined;
    }

    try {
      return await new Promise<string>((resolve, reject) => {
        window.grecaptcha!.ready(() => {
          window.grecaptcha!
            .execute(SITE_KEY, { action })
            .then(resolve)
            .catch(reject);
        });
      });
    } catch (err) {
      console.error("reCAPTCHA execution error:", err);
      return undefined;
    }
  }, []);

  return (
    <RecaptchaContext.Provider value={{ executeRecaptcha, isReady: !!SITE_KEY }}>
      {SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}
      {children}
    </RecaptchaContext.Provider>
  );
}
