import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget",
  description: "Pay-period budget tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Runs before hydration so a returning user's saved theme applies on the
// very first paint instead of flashing dark (the CSS default) and then
// switching. app/page.tsx re-syncs both the attribute and this storage
// key once the signed-in user's actual profile.theme loads.
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("budget-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
