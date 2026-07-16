import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { WalletProvider } from "@/components/WalletProvider";
import { ToastProvider } from "@/components/ToastProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Aven",
  description: "Payment streams and work attestations on Stellar.",
  metadataBase: new URL("https://aven.app"),
  themeColor: "#000000"
};

import { AppShell } from "@/components/AppShell";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}>
        <MantineProvider defaultColorScheme="light">
          <ModalsProvider>
            <Notifications />
            <WalletProvider>
              <ToastProvider>
                <AppShell>
                  {children}
                </AppShell>
              </ToastProvider>
            </WalletProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
