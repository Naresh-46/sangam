import type { Metadata } from "next";
import "./design-tokens.css";
import "./styles.css";
import "./roles.css";

export const metadata: Metadata = {
  title: "SANGAM | Medicine Supply Chain Verification",
  description:
    "Check the registered custody history and recall status of a medicine batch.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
