"use client";

import { useMemo } from "react";

import {
  formatTime,
  getCalendarBlockPosition,
  getCalendarTimeRange,
  getCourseColor,
  getVisibleCalendarDays,
  parseSchedule,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import { Course, ParsedTimeSlot } from "@/types/course";

interface MiniWeeklyCalendarProps {
  courses: Course[];
}

interface MiniCalendarBlock {
  course: Course;
  slot: ParsedTimeSlot;
}

const PLOT_HEIGHT = 240;
const TIME_MARKER_INTERVAL = 3;

function formatCompactHour(hour: number): string {
  const period = hour >= 12 ? "p" : "a";
  return `${hour % 12 || 12}${period}`;
}

export function MiniWeeklyCalendar({ courses }: MiniWeeklyCalendarProps) {
  const visibleDays = useMemo(
    () => getVisibleCalendarDays(courses),
    [courses],
  );
  const calendarRange = useMemo(
    () => getCalendarTimeRange(courses),
    [courses],
  );
  const blocksByDay = useMemo(() => {
    const grouped: MiniCalendarBlock[][] = visibleDays.map(() => []);

    courses.forEach((course) => {
      parseSchedule(course).forEach((slot) => {
        const dayIndex = visibleDays.indexOf(
          slot.day as (typeof visibleDays)[number],
        );
        if (dayIndex !== -1) {
          grouped[dayIndex].push({ course, slot });
        }
      });
    });

    return grouped;
  }, [courses, visibleDays]);
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    for (
      let hour = calendarRange.startHour;
      hour < calendarRange.endHour;
      hour += TIME_MARKER_INTERVAL
    ) {
      markers.push(hour);
    }
    return markers;
  }, [calendarRange]);
  const totalHours = calendarRange.endHour - calendarRange.startHour;

  return (
    <figure className="min-w-0" aria-label="Weekly schedule preview">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
        Weekly preview
      </figcaption>
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `28px repeat(${visibleDays.length}, minmax(0, 1fr))`,
        }}
      >
        <div aria-hidden="true" />
        {visibleDays.map((day) => (
          <div
            key={day}
            className="flex h-6 items-center justify-center rounded-sm bg-muted px-0.5 text-[9px] font-medium text-muted-foreground"
            title={day}
          >
            {day.slice(0, 3)}
          </div>
        ))}

        <div className="relative" style={{ height: `${PLOT_HEIGHT}px` }}>
          {timeMarkers.map((hour, index) => (
            <span
              key={hour}
              className={cn(
                "absolute right-1 text-[8px] leading-none text-muted-foreground",
                index !== 0 && "-translate-y-1/2",
              )}
              style={{
                top: `${((hour - calendarRange.startHour) / totalHours) * 100}%`,
              }}
            >
              {formatCompactHour(hour)}
            </span>
          ))}
        </div>

        {visibleDays.map((day, dayIndex) => (
          <div
            key={day}
            className="relative overflow-hidden rounded-sm border border-border/50 bg-muted/30"
            style={{ height: `${PLOT_HEIGHT}px` }}
          >
            {timeMarkers.map((hour) => (
              <div
                key={hour}
                aria-hidden="true"
                className="absolute w-full border-t border-border/40"
                style={{
                  top: `${((hour - calendarRange.startHour) / totalHours) * 100}%`,
                }}
              />
            ))}

            {blocksByDay[dayIndex].map((block, blockIndex) => {
              const position = getCalendarBlockPosition(
                block.slot,
                calendarRange,
              );
              const timeRange = `${formatTime(
                block.slot.startHour,
                block.slot.startMinute,
              )} – ${formatTime(
                block.slot.endHour,
                block.slot.endMinute,
              )}`;
              const description = `${block.course.Course} - ${block.course["Course Title"]} (${block.course.Section}), ${block.slot.day} ${timeRange}`;

              return (
                <div
                  key={`${block.course.Section}-${block.slot.day}-${blockIndex}`}
                  role="img"
                  aria-label={description}
                  title={description}
                  className={cn(
                    "absolute left-px right-px overflow-hidden rounded-[3px] px-0.5 text-center font-mono text-[8px] font-semibold leading-3 text-white shadow-sm",
                    getCourseColor(block.course.Course),
                  )}
                  style={{
                    top: `${position.top}%`,
                    height: `${position.height}%`,
                  }}
                >
                  <span className="block truncate">
                    {block.course.Course}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </figure>
  );
}
