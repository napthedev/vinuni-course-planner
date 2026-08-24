"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { X, AlertTriangle, Clock, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SelectedCourse } from "@/types/course";
import { calculateTotalCredits } from "@/lib/schedule-utils";

interface SelectedCoursesProps {
  courses: SelectedCourse[];
  onRemoveCourse: (sectionId: string) => void;
  onClearAll: () => void;
}

const DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";
const DESKTOP_MIN_LIST_HEIGHT = 500;

function parsePixelValue(value: string): number {
  const parsedValue = Number.parseFloat(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function CourseCard({
  course,
  onRemove,
}: {
  course: SelectedCourse;
  onRemove: () => void;
}) {
  return (
    <div
      className={`w-full max-w-full min-w-0 overflow-hidden rounded-lg border p-3 ${
        course.hasConflict
          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
          : "border-green-500 bg-green-50 dark:bg-green-950/30"
      }`}
    >
      <div className="flex min-w-0 max-w-full items-start justify-between gap-2">
        <div className="min-w-0 max-w-full flex-1">
          <div className="mb-1 flex max-w-full flex-wrap items-center gap-2">
            <Badge
              variant={course.hasConflict ? "destructive" : "default"}
              className="max-w-full whitespace-normal break-words text-left font-mono text-xs [overflow-wrap:anywhere]"
            >
              {course.Course}
            </Badge>
            <Badge
              variant="outline"
              className="max-w-full whitespace-normal break-words text-left text-xs [overflow-wrap:anywhere]"
            >
              {course.Section}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {course.Credits} cr
            </Badge>
          </div>
          <h4 className="mb-2 max-w-full whitespace-normal break-words text-sm font-medium [overflow-wrap:anywhere]">
            {course["Course Title"]}
          </h4>
          <div className="max-w-full space-y-1 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-start gap-1">
              <User className="h-3 w-3 shrink-0" />
              <span className="min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]">
                {course.Instructor}
              </span>
            </div>
            <div className="flex min-w-0 items-start gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]">
                {course.Dates}
              </span>
            </div>
            <div className="flex min-w-0 items-start gap-1">
              <Clock className="h-3 w-3 shrink-0 mt-0.5" />
              <span className="min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]">
                {course.Schedule.map(
                  (s) => `${s.day.slice(0, 3)} ${s.time}`
                ).join(", ")}
              </span>
            </div>
          </div>
          {course.hasConflict && (
            <div className="mt-2 flex min-w-0 items-start gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]">
                Conflicts with: {course.conflictsWith.join(", ")}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove course</span>
        </Button>
      </div>
    </div>
  );
}

export function SelectedCourses({
  courses,
  onRemoveCourse,
  onClearAll,
}: SelectedCoursesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [desktopListHeight, setDesktopListHeight] = useState<number>();
  const totalCredits = calculateTotalCredits(courses);
  const conflictCount = courses.filter((c) => c.hasConflict).length;
  const hasCourses = courses.length > 0;

  useLayoutEffect(() => {
    if (!hasCourses) {
      return;
    }

    const container = containerRef.current;
    const card = cardRef.current;
    const header = headerRef.current;
    const content = contentRef.current;
    const list = listRef.current;

    if (!container || !card || !header || !content || !list) {
      return;
    }

    const desktopMediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

    const updateListHeight = () => {
      if (!desktopMediaQuery.matches) {
        setDesktopListHeight(undefined);
        return;
      }

      const cardStyles = window.getComputedStyle(card);
      const contentStyles = window.getComputedStyle(content);
      const cardChromeHeight =
        parsePixelValue(cardStyles.borderTopWidth) +
        parsePixelValue(cardStyles.borderBottomWidth) +
        parsePixelValue(cardStyles.paddingTop) +
        parsePixelValue(cardStyles.paddingBottom) +
        parsePixelValue(cardStyles.rowGap) +
        header.getBoundingClientRect().height +
        parsePixelValue(contentStyles.paddingTop) +
        parsePixelValue(contentStyles.paddingBottom);
      const maximumListHeight = Math.max(
        0,
        Math.floor(
          container.getBoundingClientRect().height - cardChromeHeight,
        ),
      );
      const contentHeight = Math.ceil(list.scrollHeight);
      const nextListHeight = Math.min(
        maximumListHeight,
        Math.max(DESKTOP_MIN_LIST_HEIGHT, contentHeight),
      );

      setDesktopListHeight((currentHeight) =>
        currentHeight === nextListHeight ? currentHeight : nextListHeight,
      );
    };

    const resizeObserver = new ResizeObserver(updateListHeight);
    resizeObserver.observe(container);
    resizeObserver.observe(header);
    resizeObserver.observe(list);
    desktopMediaQuery.addEventListener("change", updateListHeight);
    const animationFrameId = window.requestAnimationFrame(updateListHeight);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      desktopMediaQuery.removeEventListener("change", updateListHeight);
    };
  }, [hasCourses]);

  if (!hasCourses) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selected Courses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No courses selected. Use the search above to add courses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      ref={containerRef}
      className="lg:absolute lg:inset-x-0 lg:top-0 lg:h-full"
    >
      <Card ref={cardRef} className="lg:max-h-full lg:overflow-hidden">
        <CardHeader ref={headerRef} className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Selected Courses</CardTitle>
            <Button variant="outline" size="sm" onClick={onClearAll}>
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary">
              {courses.length} course{courses.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary">{totalCredits} credits</Badge>
            {conflictCount > 0 && (
              <Badge variant="destructive">
                {conflictCount} conflict{conflictCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent ref={contentRef} className="pt-0">
          <ScrollArea
            className="h-[400px] pr-4 lg:h-[500px]"
            style={
              desktopListHeight === undefined
                ? undefined
                : { height: `${desktopListHeight}px` }
            }
          >
            <div ref={listRef} className="w-full min-w-0 max-w-full space-y-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.Section}
                  course={course}
                  onRemove={() => onRemoveCourse(course.Section)}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
