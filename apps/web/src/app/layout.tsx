import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "../index.css";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "screenbase",
  description: "screenbase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="bfcache-reload" strategy="beforeInteractive">
          {`(function(){var n=performance.getEntriesByType("navigation")[0];if(n&&n.type==="back_forward"){location.reload()}})()`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
