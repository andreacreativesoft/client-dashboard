import type { Metadata, Viewport } from "next";
import { M_PLUS_1 } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const mplus1 = M_PLUS_1({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-mplus1",
});

export const metadata: Metadata = {
  title: {
    default: "Client Dashboard",
    template: "%s | Client Dashboard",
  },
  description: "Client dashboard for leads, analytics, and business insights",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dashboard",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${mplus1.variable} min-h-dvh antialiased`}
        style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
