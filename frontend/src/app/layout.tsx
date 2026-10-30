import type { Metadata } from "next";
import TopNav from "@/components/Layout/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Smart City Traffic Command Center",
  description: "Enterprise Smart City AI Traffic Management & Operations Center",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full flex flex-col bg-[#060a0f] text-gray-100 overflow-hidden">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
