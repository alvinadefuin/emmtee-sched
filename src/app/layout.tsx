import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volunteer Schedule",
  description: "Pick your Sunday dates for the month.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
