import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
    title: "Hunch models: get feedback on your hunches",
    description: "Turn an idea into scenes people can respond to, then see what resonates, what differs and what is missing.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
