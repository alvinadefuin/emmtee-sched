import type { Metadata, Viewport } from "next";
import { SiteHeader } from "./components/SiteHeader";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "./theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volunteer Schedule",
  description: "Pick your Sunday dates for the month.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Dark is the default; the head script and ThemeToggle update this for the light theme.
  themeColor: THEME_COLOR.dark,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
