import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
    title: "Hunch models — show how an idea might play out",
    description: "Turn an idea into scenes people can respond to. See what resonates, what differs and what is missing.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
