import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpsCopilot | Institute Operations",
  description: "OpsCopilot institute operations and learning platform.",
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
