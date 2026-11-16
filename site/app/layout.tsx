import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
    title: "Hunch models — make ideas concrete enough to discuss",
    description: "Turn an abstract idea into scenes people can respond to, revealing its assumptions and showing what matches, differs or is missing.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
