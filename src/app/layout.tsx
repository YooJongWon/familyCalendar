import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "함께 캘린더", description: "권한 기반 단체 캘린더" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
