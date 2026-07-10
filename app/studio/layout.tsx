import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private Image Studio",

  description:
    "Private artwork generation and review studio for the I AM NOBODY visual universe.",

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