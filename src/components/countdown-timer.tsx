"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { APP_CONFIG } from "@/config";

const TARGET_DATE = new Date(APP_CONFIG.countdown.targetDateTime);

if (Number.isNaN(TARGET_DATE.getTime())) {
  throw new Error("APP_CONFIG.countdown.targetDateTime must be a valid date");
}

function formatTargetDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat(APP_CONFIG.countdown.locale, {
    timeZone: APP_CONFIG.countdown.timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const dateLabel = `${getPart("month")} ${getPart("day")}, ${getPart("year")}`;
  const timeLabel = `${getPart("hour")}:${getPart("minute")} ${getPart("dayPeriod")}`;
  const timeZoneLabel = getPart("timeZoneName");

  return `${dateLabel} • ${timeLabel} (${timeZoneLabel})`;
}

const TARGET_DATE_LABEL = formatTargetDate(TARGET_DATE);

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(): TimeLeft {
  const now = new Date();
  const difference = TARGET_DATE.getTime() - now.getTime();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="mt-6 p-6 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-border/50 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary animate-pulse" />
          <h3 className="text-lg font-semibold">
            {APP_CONFIG.countdown.loadingMessage}
          </h3>
        </div>
      </div>
    );
  }

  const isExpired =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  if (isExpired) {
    return (
      <div className="mt-6 p-6 rounded-xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 border border-green-500/30 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🎉</span>
          <h3 className="text-xl font-bold text-green-600 dark:text-green-400">
            {APP_CONFIG.countdown.expiredMessage}
          </h3>
          <span className="text-2xl">🎉</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 p-6 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-border/50 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary animate-pulse" />
        <h3 className="text-lg font-semibold">
          {APP_CONFIG.countdown.heading}
        </h3>
      </div>

      <div className="flex items-center justify-center gap-3 md:gap-6">
        <TimeUnit value={timeLeft.days} label="Days" />
        <Separator />
        <TimeUnit value={timeLeft.hours} label="Hours" />
        <Separator />
        <TimeUnit value={timeLeft.minutes} label="Minutes" />
        <Separator />
        <TimeUnit value={timeLeft.seconds} label="Seconds" />
      </div>

      <p className="text-center text-sm text-muted-foreground mt-4">
        {TARGET_DATE_LABEL}
      </p>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-background border border-border shadow-lg flex items-center justify-center">
          <span className="text-2xl md:text-3xl font-bold tabular-nums bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
            {String(value).padStart(2, "0")}
          </span>
        </div>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
      </div>
      <span className="text-xs md:text-sm text-muted-foreground mt-2 font-medium">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <div className="flex flex-col items-center gap-2 pb-6">
      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
    </div>
  );
}
