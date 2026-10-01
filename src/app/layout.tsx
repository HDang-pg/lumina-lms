import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Lumina LMS", description: "LMS thu gọn cho Giáo viên và Học sinh" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
