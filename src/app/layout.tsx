import type { Metadata } from "next";
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
