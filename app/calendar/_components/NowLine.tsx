"use client";

import { useEffect, useMemo, useState } from "react";

type NowLineProps = {
    dayISO: string;      // "YYYY-MM-DD"
    timeZone: string;    // e.g. "Europe/Vienna"
    startHour: number;   // e.g. 6
    endHour: number;     // e.g. 22
    slotH: number;       // px por slot
    gridH: number;       // px total del grid
};

function getTZNowParts(timeZone: string) {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });

    const parts = dtf.formatToParts(now);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

    return {
        dayISO: `${pick("year")}-${pick("month")}-${pick("day")}`,
        hour: Number(pick("hour") || "0"),
        minute: Number(pick("minute") || "0"),
    };
}

export function NowLine({
                            dayISO,
                            timeZone,
                            startHour,
                            endHour,
                            slotH,
                            gridH,
                        }: NowLineProps) {
    const [top, setTop] = useState<number | null>(null);

    const minutesRange = useMemo(() => {
        const startMin = startHour * 60;
        const endMin = endHour * 60;
        return { startMin, endMin, totalMin: Math.max(1, endMin - startMin) };
    }, [startHour, endHour]);

    useEffect(() => {
        const tick = () => {
            const now = getTZNowParts(timeZone);

            // Solo mostrar línea si el día coincide (en el timezone del negocio)
            if (now.dayISO !== dayISO) {
                setTop(null);
                return;
            }

            const currentMin = now.hour * 60 + now.minute;
            if (currentMin < minutesRange.startMin || currentMin > minutesRange.endMin) {
                setTop(null);
                return;
            }

            const offsetMin = currentMin - minutesRange.startMin;
            const ratio = offsetMin / minutesRange.totalMin;

            // Usa gridH como fuente de verdad. slotH queda por compatibilidad con tu API.
            const y = Math.round(ratio * gridH);
            setTop(y);
        };

        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, [dayISO, timeZone, gridH, minutesRange]);

    if (top === null) return null;

    return (
        <div
            aria-hidden="true"
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                top,
                height: 2,
                zIndex: 20,
                pointerEvents: "none",
                opacity: 0.9,
            }}
        />
    );
}
