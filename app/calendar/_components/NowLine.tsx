"use client";

import { useEffect, useMemo, useState } from "react";

function getZonedHourMinute(now: Date, timeZone: string) {
    const dtf = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });

    const parts = dtf.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

    return { hour: Number(map.hour), minute: Number(map.minute) };
}

function getZonedYMD(now: Date, timeZone: string) {
    const dtf = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const parts = dtf.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

    return `${map.year}-${map.month}-${map.day}`; // YYYY-MM-DD
}

type Props = {
    dayISO: string;      // YYYY-MM-DD (columna)
    timeZone: string;    // business tz
    startHour: number;
    endHour: number;
    slotH: number;       // px por hora
    gridH: number;       // alto total
};

export function NowLine({ dayISO, timeZone, startHour, endHour, slotH, gridH }: Props) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(id);
    }, []);

    const isTodayColumn = useMemo(
        () => getZonedYMD(now, timeZone) === dayISO,
        [now, timeZone, dayISO]
    );

    if (!isTodayColumn) return null;

    const { hour, minute } = getZonedHourMinute(now, timeZone);

    if (hour < startHour || hour >= endHour) return null;

    const minutesFromStart = (hour - startHour) * 60 + minute;
    const top = (minutesFromStart / 60) * slotH;

    if (top < 0 || top > gridH) return null;

    return (
        <div
            className="pointer-events-none absolute left-0 right-0 z-30"
            style={{ top }}
            aria-hidden="true"
        >
            <div className="h-[2px] bg-black/70" />
        </div>
    );
}
