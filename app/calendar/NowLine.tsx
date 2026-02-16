"use client";

import { useEffect, useState } from "react";

export function NowLine() {
    const [top, setTop] = useState<number>(0);

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const minutes = now.getHours() * 60 + now.getMinutes();
            // Ajusta este cálculo a tu grid real (ej: altura de día)
            setTop(minutes);
        };

        tick();
        const id = setInterval(tick, 60_000);
        return () => clearInterval(id);
    }, []);

    return (
        <div
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                top,
                height: 2,
            }}
        />
    );
}
