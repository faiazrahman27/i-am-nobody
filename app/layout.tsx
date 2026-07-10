import type { Metadata } from "next";
import "./globals.css";

const BRAND_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: {
    default: "I AM NOBODY — Andrea Magelli",
    template: "%s | I AM NOBODY",
  },

  description:
    "I AM NOBODY is a philosophical and visual project by Andrea Magelli about identity, social masks, and who we are when nobody is watching.",

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/favicon-96x96.png",
        type: "image/png",
        sizes: "96x96",
      },
    ],

    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />

        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        <link
          rel="stylesheet"
          href={BRAND_FONT_STYLESHEET}
        />
      </head>

      <body>{children}</body>
    </html>
  );
}