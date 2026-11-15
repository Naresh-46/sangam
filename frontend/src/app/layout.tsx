import type { Metadata } from "next";
import "./styles.css";
import "./roles.css";

export const metadata: Metadata = {
  title: "ANANTA | Medicine Traceability",
  description:
    "Check the registered custody history and recall status of a medicine batch.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
