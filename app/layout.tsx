import "./globals.css";
import type { Metadata } from "next";
import MobileBottomNav from "./components/MobileBottomNav";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Salon Platform",
  description: "Discover salons and book appointments in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <Providers>
          {children}
          <MobileBottomNav />
        </Providers>
      </body>
    </html>
  );
}
