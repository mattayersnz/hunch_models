import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
    title: "Hunch models — a humble start to a conversation",
    description: "Put an idea out there as a small model of people, places, actions and thoughts, then invite others to say how it fits their world.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
