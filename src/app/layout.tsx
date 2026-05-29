import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Roleplay Coach",
  description: "Practice natural English through AI roleplay and silent review."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
