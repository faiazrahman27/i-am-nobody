import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "I AM NOBODY Image Studio",

  description: "Private artwork creation and review for I AM NOBODY.",

  robots: {
    index: false,
    follow: false,
    nocache: true,

    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
