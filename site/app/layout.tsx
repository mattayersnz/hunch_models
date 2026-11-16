import type { ReactNode } from "react";

export const metadata = { title: "Hunch models", description: "Scenes of how someone thinks things go for people, for others to respond to." };

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body style={{ margin: 0, background: "#0b0b0b", color: "#a3a3a3", font: "15px/1.6 system-ui, sans-serif" }}>{children}</body>
        </html>
    );
}
