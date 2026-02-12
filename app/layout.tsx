import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import ToasterProvider from "@/components/providers/ToastProvider";



const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

;

export const metadata: Metadata = {
  title: "Auto Inter",
  description: "It is a tool that helps to prepare for interviews by generating questions and answers based on the job description.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${monaSans.variable} antialiased pattern`}
      >
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
