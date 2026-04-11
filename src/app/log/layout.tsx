import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log GG & Match & matches · OMGG Leaderboard",
};

export default function LogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
