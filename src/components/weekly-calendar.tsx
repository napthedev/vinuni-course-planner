"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  SelectedCourse,
  DAYS_OF_WEEK,
  ParsedTimeSlot,
} from "@/types/course";
import { APP_CONFIG } from "@/config";
import {
  parseSchedule,
  generateTimeLabels,
  getVisibleCalendarDays,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { AgendaView } from "@/components/agenda-view";
import { getInstructorDisplayName } from "@/lib/course-utils";

interface WeeklyCalendarProps {
  courses: SelectedCourse[];
}

const {
  startHour: CALENDAR_START_HOUR,
  endHour: CALENDAR_END_HOUR,
} = APP_CONFIG.calendar;

interface CalendarBlock {
  course: SelectedCourse;
  slot: ParsedTimeSlot;
  dayIndex: number;
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

export function WeeklyCalendar({ courses }: WeeklyCalendarProps) {
  const isMobile = useIsMobile();
  const visibleDays = useMemo(
    () => getVisibleCalendarDays(courses),
    [courses]
  );

  // Parse all course schedules into calendar blocks
  const calendarBlocks = useMemo(() => {
    const blocks: CalendarBlock[] = [];

    courses.forEach((course) => {
      const slots = parseSchedule(course);
      slots.forEach((slot) => {
        const dayIndex = DAYS_OF_WEEK.indexOf(
          slot.day as (typeof DAYS_OF_WEEK)[number]
        );
        if (dayIndex !== -1) {
          blocks.push({ course, slot, dayIndex });
        }
      });
    });

    return blocks;
  }, [courses]);

  // Group blocks by each currently visible calendar day
  const blocksByDay = useMemo(() => {
    const grouped: CalendarBlock[][] = visibleDays.map(() => []);
    calendarBlocks.forEach((block) => {
      const visibleDayIndex = visibleDays.indexOf(
        DAYS_OF_WEEK[block.dayIndex]
      );
      if (visibleDayIndex !== -1) {
        grouped[visibleDayIndex].push(block);
      }
    });
    return grouped;
  }, [calendarBlocks, visibleDays]);

  const visibleBlocks = useMemo(() => blocksByDay.flat(), [blocksByDay]);

  const calendarRange = useMemo(() => {
    if (visibleBlocks.length === 0) {
      return {
        startHour: CALENDAR_START_HOUR,
        endHour: CALENDAR_END_HOUR,
      };
    }

    const earliestStartHour = Math.min(
      ...visibleBlocks.map((block) => block.slot.startHour)
    );
    const latestEndHour = Math.max(
      ...visibleBlocks.map((block) =>
        block.slot.endMinute > 0 ? block.slot.endHour + 1 : block.slot.endHour
      )
    );

    return {
      startHour: Math.min(CALENDAR_START_HOUR, earliestStartHour),
      endHour: Math.max(CALENDAR_END_HOUR, latestEndHour),
    };
  }, [visibleBlocks]);

  const timeLabels = useMemo(
    () => generateTimeLabels(calendarRange.startHour, calendarRange.endHour),
    [calendarRange]
  );
  const totalHours = calendarRange.endHour - calendarRange.startHour;

  // Calculate position and size for a block
  const getBlockStyle = (slot: ParsedTimeSlot) => {
    const startOffset =
      (slot.startHour - calendarRange.startHour) * 60 + slot.startMinute;
    const endOffset =
      (slot.endHour - calendarRange.startHour) * 60 + slot.endMinute;
    const duration = endOffset - startOffset;

    const totalMinutes = totalHours * 60;
    const top = (startOffset / totalMinutes) * 100;
    const height = (duration / totalMinutes) * 100;

    return {
      top: `${top}%`,
      height: `${height}%`,
    };
  };

  // Mobile: render agenda view
  if (isMobile) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Weekly Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <AgendaView courses={courses} days={visibleDays} />
        </CardContent>
      </Card>
    );
  }

  // Desktop: render grid calendar
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Weekly Schedule</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        <ScrollArea className="w-full min-w-0 max-w-full">
          <div
            className="p-4 sm:p-0"
            style={{ minWidth: visibleDays.length === 7 ? "956px" : "700px" }}
          >
            {/* Header with days */}
            <div
              className="grid gap-1 mb-1"
              style={{
                gridTemplateColumns: `60px repeat(${visibleDays.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="h-10" /> {/* Empty corner cell */}
              {visibleDays.map((day) => (
                <div
                  key={day}
                  className="h-10 flex items-center justify-center font-medium text-sm bg-muted rounded-md"
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.slice(0, 3)}</span>
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `60px repeat(${visibleDays.length}, minmax(0, 1fr))`,
              }}
            >
              {/* Time labels column */}
              <div className="relative">
                {timeLabels.map((label, index) => (
                  <div
                    key={label}
                    className="h-12 flex items-start justify-end pr-2 text-xs text-muted-foreground"
                    style={{ marginTop: index === 0 ? 0 : undefined }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {visibleDays.map((day, dayIndex) => (
                <div
                  key={day}
                  className="relative bg-muted/30 rounded-md"
                  style={{ height: `${totalHours * 48}px` }} // 48px per hour
                >
                  {/* Hour grid lines */}
                  {timeLabels.map((_, index) => (
                    <div
                      key={index}
                      className="absolute w-full border-t border-border/50"
                      style={{ top: `${(index / totalHours) * 100}%` }}
                    />
                  ))}

                  {/* Course blocks */}
                  {blocksByDay[dayIndex].map((block, blockIndex) => {
                    const style = getBlockStyle(block.slot);
                    const baseColor = getCourseColor(block.course.Course);

                    return (
                      <div
                        key={`${block.course.Section}-${blockIndex}`}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded-md px-1 py-0.5 overflow-hidden text-white text-xs shadow-sm transition-all hover:z-10 hover:scale-[1.02]",
                          block.course.hasConflict
                            ? "bg-red-500 ring-2 ring-red-600"
                            : baseColor
                        )}
                        style={style}
                        title={`${block.course.Course} - ${
                          block.course["Course Title"]
                        }\n${getInstructorDisplayName(
                          block.course.Instructor
                        )}\n${block.slot.day} ${
                          block.course.Schedule.find(
                            (s) => s.day === block.slot.day
                          )?.time
                        }`}
                      >
                        <div className="truncate text-[10px] leading-tight">
                          {block.course["Course Title"]}
                        </div>
                        <div className="font-semibold truncate">
                          {block.course.Course}
                        </div>
                        <div className="truncate opacity-90 text-[10px]">
                          {block.course.Section}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        {courses.length > 0 && (
          <div className="mt-4 px-4 sm:px-0">
            <h5 className="text-sm font-medium mb-2">Legend</h5>
            <div className="flex flex-wrap gap-2">
              {courses.map((course) => (
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
        {courses.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No scheduled courses to display.</p>
            <p className="text-sm mt-1">
              Add courses with schedules to see them on the calendar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
