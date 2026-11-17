import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghostline - Talk it out. Post in your voice.",
  description:
    "A founder talks for two minutes, an interview agent asks the follow-ups a ghostwriter would ask, and Ghostline drafts a LinkedIn post from only what the founder actually said.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
