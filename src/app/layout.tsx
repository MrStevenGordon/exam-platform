import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ChatWidget from "@/components/ChatWidget";

const TITLE = 'Smart Assess Ja'
const DESCRIPTION = 'Exams, lessons and practice for Jamaican schools — Smart Assess, Smart Learning and Smart Play, all in one platform.'

export const metadata: Metadata = {
  // Resolves every relative URL in metadata (OG images, canonical links) below this — without it,
  // a page that sets only a relative openGraph.images path silently fails to resolve on some
  // crawlers/link previewers. Individual pages still set their own title/description/OG; this is
  // the site-wide fallback for the ones that don't.
  metadataBase: new URL('https://smartassessja.com'),
  title: { default: TITLE, template: `%s | ${TITLE}` },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    type: 'website',
    locale: 'en_JM',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
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
