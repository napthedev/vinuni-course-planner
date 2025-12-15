"use client";

import { X, AlertTriangle, Clock, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SelectedCourse } from "@/types/course";
import { hasValidSchedule, calculateTotalCredits } from "@/lib/schedule-utils";

interface SelectedCoursesProps {
  courses: SelectedCourse[];
  onRemoveCourse: (sectionId: string) => void;
  onClearAll: () => void;
}

function CourseCard({
  course,
  onRemove,
}: {
  course: SelectedCourse;
  onRemove: () => void;
}) {
  const hasSched = hasValidSchedule(course);

  return (
    <div
      className={`p-3 rounded-lg border ${
        course.hasConflict
          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
          : "border-green-500 bg-green-50 dark:bg-green-950/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge
              variant={course.hasConflict ? "destructive" : "default"}
              className="font-mono text-xs"
            >
              {course.Course}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {course.Section}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {course.Credits} cr
            </Badge>
          </div>
          <h4 className="font-medium text-sm line-clamp-2 mb-2">
            {course["Course Title"]}
          </h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{course.Instructor}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>{course.Dates}</span>
            </div>
            <div className="flex items-start gap-1">
              <Clock className="h-3 w-3 shrink-0 mt-0.5" />
              <span>
                {hasSched
                  ? course.Schedule.map(
                      (s) => `${s.day.slice(0, 3)} ${s.time}`
                    ).join(", ")
                  : "TBA"}
              </span>
            </div>
          </div>
          {course.hasConflict && (
            <div className="flex items-center gap-1 mt-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              <span>Conflicts with: {course.conflictsWith.join(", ")}</span>
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
  const scheduledCourses = courses.filter(hasValidSchedule);
  const tbaCourses = courses.filter((c) => !hasValidSchedule(c));
  const totalCredits = calculateTotalCredits(courses);
  const conflictCount = courses.filter((c) => c.hasConflict).length;

  if (courses.length === 0) {
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
    <Card>
      <CardHeader className="pb-3">
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
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] lg:h-[500px] pr-4">
          <div className="space-y-3">
            {scheduledCourses.length > 0 && (
              <>
                <h5 className="text-sm font-medium text-muted-foreground">
                  Scheduled ({scheduledCourses.length})
                </h5>
                {scheduledCourses.map((course) => (
                  <CourseCard
                    key={course.Section}
                    course={course}
                    onRemove={() => onRemoveCourse(course.Section)}
                  />
                ))}
              </>
            )}
            {tbaCourses.length > 0 && (
              <>
                {scheduledCourses.length > 0 && <Separator className="my-4" />}
                <h5 className="text-sm font-medium text-muted-foreground">
                  Schedule TBA ({tbaCourses.length})
                </h5>
                {tbaCourses.map((course) => (
                  <CourseCard
                    key={course.Section}
                    course={course}
                    onRemove={() => onRemoveCourse(course.Section)}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
