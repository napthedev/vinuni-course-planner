"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  SelectedCourse,
  DAYS_OF_WEEK,
  ParsedTimeSlot,
} from "@/types/course";
import {
  formatTime,
  parseSchedule,
  generateTimeLabels,
  getVisibleCalendarDays,
  getCalendarBlockPosition,
  getCalendarTimeRange,
  getCourseColor,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { AgendaView } from "@/components/agenda-view";
import { getInstructorDisplayName } from "@/lib/course-utils";

interface WeeklyCalendarProps {
  courses: SelectedCourse[];
}

interface CalendarBlock {
  course: SelectedCourse;
  slot: ParsedTimeSlot;
  dayIndex: number;
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

  const calendarRange = useMemo(
    () => getCalendarTimeRange(courses),
    [courses]
  );

  const timeLabels = useMemo(
    () => generateTimeLabels(calendarRange.startHour, calendarRange.endHour),
    [calendarRange]
  );
  const totalHours = calendarRange.endHour - calendarRange.startHour;

  // Calculate position and size for a block
  const getBlockStyle = (slot: ParsedTimeSlot) => {
    const position = getCalendarBlockPosition(slot, calendarRange);

    return {
      top: `${position.top}%`,
      height: `${position.height}%`,
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
                    const timeRange = `${formatTime(
                      block.slot.startHour,
                      block.slot.startMinute
                    )} – ${formatTime(
                      block.slot.endHour,
                      block.slot.endMinute
                    )}`;

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
                        )}\n${block.slot.day} ${timeRange}`}
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
