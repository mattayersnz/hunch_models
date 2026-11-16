import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
    title: "Hunch models — test ideas with reality",
    description: "Turn an idea into situations people can respond to, then learn where it resonates, differs and needs more context.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
