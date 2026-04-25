import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans, Cinzel } from "next/font/google";
import { Agentation } from "agentation";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";

const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OMGG Leaderboard",
  description: "Realtime GG and match tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", "h-full", "antialiased", geistSans.variable, geistMono.variable, cinzel.variable, "font-sans", dmSans.variable)}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
