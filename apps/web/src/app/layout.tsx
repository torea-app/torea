import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import "../index.css";
import Providers from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "torea",
  description: "torea",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Script id="bfcache-reload" strategy="beforeInteractive">
          {`(function(){var n=performance.getEntriesByType("navigation")[0];if(n&&n.type==="back_forward"){location.reload()}})()`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
