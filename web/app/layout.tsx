import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Trajan-like serif for the ATRIA wordmark — editorial, premium brand voice.
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Atria",
  description: "The schedule maker for medicine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
