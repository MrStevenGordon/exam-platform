import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "Smart Assess Ja",
  description: "Online exam and lesson planning platform for Jamaican schools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
