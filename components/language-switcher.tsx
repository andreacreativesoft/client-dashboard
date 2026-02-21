"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";
import { updateLanguageAction } from "@/lib/actions/profile";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n/translations";
import type { AppLanguage } from "@/types/database";

export function LanguageSwitcher() {
  const { language } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSelect(lang: AppLanguage) {
    if (lang === language) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    setOpen(false);
    await updateLanguageAction(lang);
    router.refresh();
    setUpdating(false);
  }

  const currentLabel = language === "fr-BE" ? "FR" : "EN";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={updating}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50",
          open && "bg-muted"
        )}
        title={language === "fr-BE" ? "Changer de langue" : "Change language"}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
        </svg>
        {currentLabel}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => handleSelect(lang.value)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                lang.value === language && "font-medium text-foreground",
                lang.value !== language && "text-muted-foreground"
              )}
            >
              <span className="w-5 text-center text-xs font-bold">
                {lang.value === "en" ? "EN" : "FR"}
              </span>
              {lang.label}
              {lang.value === language && (
                <svg className="ml-auto h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
