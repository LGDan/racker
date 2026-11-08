import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Racker DCIM | Datacenter Infrastructure Management",
  description:
    "Hierarchical Datacenter Infrastructure Management, Power Chain, 3-Phase Load, Cooling Capacity, and Interactive Rack Elevation Studio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <Script id="racker-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("racker.theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
