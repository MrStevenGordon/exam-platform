import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "Exam Platform",
  description: "Online examination platform",
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
