import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to track your iOS learning progress across devices.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
