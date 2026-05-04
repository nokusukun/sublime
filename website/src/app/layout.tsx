import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sublime — Code craft for AI agents",
    template: "%s | Sublime",
  },
  description:
    "A code-craft skill for AI coding agents. Opinionated positions, a named anti-pattern catalog, and a verb library.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sublime",
  },
  openGraph: {
    title: "Sublime — Code craft for AI agents",
    description:
      "Opinionated positions, a named anti-pattern catalog, and a verb library for AI coding agents.",
    type: "website",
    siteName: "Sublime",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(96.5% 0.006 60)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(12% 0.01 60)" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-10 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-muted">
              MIT-licensed. Not a linter. A partner with positions.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/nokusukun/sublime"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href="/docs/foundation"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Docs
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
