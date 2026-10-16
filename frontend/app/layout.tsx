import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechSummitTrainers | Portal & Institute Operations",
  description: "Not a coaching class. A career launchpad. TechSummitTrainers authentication portal and institute copilot.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f59e0b" />
      </head>
      <body>{children}</body>
    </html>
  );
}
