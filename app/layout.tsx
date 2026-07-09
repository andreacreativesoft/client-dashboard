import type { Metadata, Viewport } from "next";
import { Inter, M_PLUS_1 } from "next/font/google";

import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

// Police UI principale — grotesque neutre proche de Helvetica/Arial, auto-hébergée
// par next/font (rendu identique sur toutes les machines, contrairement à un
// `font-family: Helvetica` qui retombait sur une police système aléatoire).
const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
});

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
        <html lang="en" className={`${inter.variable} ${mplus1.variable}`}>
            <body className={`${inter.className} min-h-dvh antialiased`}>
                <TooltipProvider delayDuration={300}>
                    <ConfirmProvider>{children}</ConfirmProvider>
                </TooltipProvider>
                <Toaster richColors position="bottom-center" />
            </body>
        </html>
    );
}
