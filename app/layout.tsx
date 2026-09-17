import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Craft World — ตารางกำไรการผลิต",
  description:
    "ซื้อวัตถุดิบจากตลาด → ผลิต → ขายผลผลิต คุ้มไหม เลเวลไหนดีสุด ดูกำไรต่อรอบและต่อวันของทุกโรงงานใน Craft World",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
