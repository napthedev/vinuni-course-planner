"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SelectedCourse, DAYS_OF_WEEK, ParsedTimeSlot } from "@/types/course";
import {
  parseSchedule,
  formatTime,
  hasValidSchedule,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

interface AgendaViewProps {
  courses: SelectedCourse[];
}

// Weekdays only (exclude Saturday and Sunday)
const WEEKDAYS = DAYS_OF_WEEK.filter(
  (day) => day !== "Saturday" && day !== "Sunday"
);

interface AgendaItem {
  course: SelectedCourse;
  slot: ParsedTimeSlot;
}

// Generate a consistent color for each course based on its code
function getCourseColor(courseCode: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-cyan-500",
    "bg-teal-500",
    "bg-amber-500",
    "bg-orange-500",
    "bg-lime-500",
    "bg-emerald-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-fuchsia-500",
    "bg-sky-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-blue-600",
    "bg-purple-600",
    "bg-teal-600",
    "bg-orange-600",
    "bg-emerald-600",
    "bg-indigo-600",
    "bg-pink-600",
    "bg-cyan-600",
  ];

  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function AgendaView({ courses }: AgendaViewProps) {
  // Parse all course schedules and group by day
  const agendaByDay = useMemo(() => {
    const grouped: Map<string, AgendaItem[]> = new Map();

    // Initialize all weekdays
    WEEKDAYS.forEach((day) => {
      grouped.set(day, []);
    });

    courses.filter(hasValidSchedule).forEach((course) => {
      const slots = parseSchedule(course);
      slots.forEach((slot) => {
        const dayItems = grouped.get(slot.day);
        if (dayItems) {
          dayItems.push({ course, slot });
        }
      });
    });

    // Sort each day's items by start time
    grouped.forEach((items) => {
      items.sort((a, b) => {
        const aTime = a.slot.startHour * 60 + a.slot.startMinute;
        const bTime = b.slot.startHour * 60 + b.slot.startMinute;
        return aTime - bTime;
      });
    });

    return grouped;
  }, [courses]);

  const scheduledCourses = courses.filter(hasValidSchedule);

  return (
    <div className="space-y-4">
      {/* Day sections */}
      {WEEKDAYS.map((day) => {
        const items = agendaByDay.get(day) || [];

        return (
          <div key={day} className="space-y-2">
            {/* Day header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 py-2 px-1 border-b">
              <h3 className="font-semibold text-base">{day}</h3>
            </div>

            {/* Course cards for this day */}
            {items.length > 0 ? (
              <div className="space-y-2 px-1">
                {items.map((item, index) => {
                  const timeRange = `${formatTime(
                    item.slot.startHour,
                    item.slot.startMinute
                  )} – ${formatTime(item.slot.endHour, item.slot.endMinute)}`;
                  const baseColor = getCourseColor(item.course.Course);

                  return (
                    <Card
                      key={`${item.course.Section}-${index}`}
                      className={cn(
                        "overflow-hidden border-l-4 transition-all",
                        item.course.hasConflict
                          ? "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                          : "border-l-current"
                      )}
                      style={{
                        borderLeftColor: item.course.hasConflict
                          ? undefined
                          : `var(--${baseColor
                              .replace("bg-", "")
                              .replace("-500", "-9")
                              .replace("-600", "-9")})`,
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          {/* Color indicator */}
                          <div
                            className={cn(
                              "w-2 h-full min-h-15 rounded-full shrink-0",
                              item.course.hasConflict ? "bg-red-500" : baseColor
                            )}
                          />

                          {/* Course details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            {/* Time */}
                            <div className="text-sm text-muted-foreground font-medium">
                              {timeRange}
                            </div>

                            {/* Course code and title */}
                            <div className="font-semibold text-base">
                              {item.course.Course}
                              {item.course.hasConflict && (
                                <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400">
                                  (Conflict)
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-foreground/80 line-clamp-2">
                              {item.course["Course Title"]}
                            </div>

                            {/* Section and Instructor */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                              <span className="font-mono">
                                {item.course.Section}
                              </span>
                              {item.course.Instructor && (
                                <span>{item.course.Instructor}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="px-1 py-3 text-sm text-muted-foreground italic">
                No classes
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      {scheduledCourses.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h5 className="text-sm font-medium mb-2">Legend</h5>
          <div className="flex flex-wrap gap-2">
            {scheduledCourses.map((course) => (
              <div
                key={course.Section}
                className="flex items-center gap-1.5 text-xs"
              >
                <div
                  className={cn(
                    "w-3 h-3 rounded-sm",
                    course.hasConflict
                      ? "bg-red-500"
                      : getCourseColor(course.Course)
                  )}
                />
                <span className="font-mono">{course.Course}</span>
                <span className="text-muted-foreground">
                  ({course.Section})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {scheduledCourses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No scheduled courses to display.</p>
          <p className="text-sm mt-1">
            Add courses with schedules to see them on the calendar.
          </p>
        </div>
      )}
    </div>
  );
}
