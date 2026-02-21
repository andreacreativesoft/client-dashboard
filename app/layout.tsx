import type { Metadata, Viewport } from "next";
import { M_PLUS_1, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const mplus1 = M_PLUS_1({
  variable: "--font-mplus1",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#2A5959",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${mplus1.variable} ${geistMono.variable} min-h-dvh antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
