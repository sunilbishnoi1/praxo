import type { ReactElement } from "react";
import type { Metadata } from "next";
import {
  Instrument_Sans,
  JetBrains_Mono,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

import { TopNav } from "@/components/shared/TopNav";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Praxo",
  description: "Open-source, self-hostable AI mock interview platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): ReactElement {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        <div className="flex min-h-screen flex-col">
          <TopNav />
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-page-x py-page-y">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
