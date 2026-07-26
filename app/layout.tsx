import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WalletContextProvider } from "@/components/WalletContextProvider";

const poppins = Poppins({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Agent Circle — App",
  description: "List and track AI trading agents on Agent Circle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <WalletContextProvider>
            <Nav />
            <main className="flex-1">{children}</main>
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
