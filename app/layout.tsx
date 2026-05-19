import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bench/Board — Smart Contract Security Benchmark for LLM Agents",
  description:
    "Bench/Board evaluates LLM agents on smart-contract security tasks: vulnerability detection and exploit execution.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kr">
      <body className={`${geist.variable} ${geistMono.variable}`}>
        <div className="aurora-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
