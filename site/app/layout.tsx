import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
    title: "Hunch models — test hunches with reality",
    description: "Bring a hunch into the context of real life, then learn where it resonates, differs and needs more context.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
