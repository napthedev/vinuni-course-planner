"use client";

import { useState, useMemo } from "react";
import {
  Check,
  ChevronsUpDown,
  Clock,
  User,
  Calendar,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Course } from "@/types/course";
import {
  hasValidSchedule,
  courseMatchesTimeFilter,
  coursesConflict,
} from "@/lib/schedule-utils";
import { CourseFilters as CourseFiltersType } from "@/hooks/use-course-filters";

interface CourseSelectorProps {
  courses: Course[];
  selectedCourses: Course[];
  onSelectCourse: (course: Course) => void;
  isCourseSelected: (sectionId: string) => boolean;
  isCourseCodeSelected: (courseCode: string) => boolean;
  filters: CourseFiltersType;
  hasActiveFilters: boolean;
  resetFilters: () => void;
}

function formatSchedule(course: Course): string {
  if (!hasValidSchedule(course)) {
    return "TBA";
  }
  return course.Schedule.map((s) => `${s.day.slice(0, 3)} ${s.time}`).join(
    ", "
  );
}

export function CourseSelector({
  courses,
  selectedCourses,
  onSelectCourse,
  isCourseSelected,
  isCourseCodeSelected,
  filters,
  hasActiveFilters,
  resetFilters,
}: CourseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Filter courses based on search value and time filters
  const filteredCourses = useMemo(() => {
    let result = courses;

    // Apply time filters first
    if (hasActiveFilters) {
      result = result.filter((course) =>
        courseMatchesTimeFilter(course, {
          days: filters.days,
          timeRange: filters.timeRange,
          hasActiveFilters,
        })
      );
    }

    // Then apply text search
    if (searchValue.trim()) {
      const search = searchValue.toLowerCase().trim();
      result = result.filter((course) => {
        // Include schedule in searchable text
        const scheduleText = course.Schedule.map(
          (s) => `${s.day} ${s.time}`
        ).join(" ");
        const searchableText =
          `${course.Course} ${course["Course Title"]} ${course.Section} ${course.Instructor} ${scheduleText}`.toLowerCase();
        return searchableText.includes(search);
      });
    }

    return result.slice(0, 100); // Limit results for performance
  }, [courses, searchValue, filters, hasActiveFilters]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10 py-2"
        >
          <span className="text-muted-foreground">Search for courses...</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by course code, title, instructor, or time..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              {hasActiveFilters ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    No courses match your filters.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={resetFilters}
                    className="text-primary"
                  >
                    Reset filters
                  </Button>
                </div>
              ) : (
                "No courses found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredCourses.map((course) => {
                const isSelected = isCourseSelected(course.Section);
                const isCourseCodeAlreadyAdded = isCourseCodeSelected(
                  course.Course
                );
                const hasSched = hasValidSchedule(course);

                // Check for conflicts with selected courses
                const conflictingCourses = selectedCourses.filter((selected) =>
                  coursesConflict(course, selected)
                );
                const hasConflict = conflictingCourses.length > 0;

                // Disable if this exact section is selected OR if any section of this course is already added
                const isDisabled = isSelected || isCourseCodeAlreadyAdded;

                return (
                  <CommandItem
                    key={course.Section}
                    value={course.Section}
                    onSelect={() => {
                      if (!isDisabled) {
                        onSelectCourse(course);
                      }
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className={cn(
                      "flex flex-col items-start gap-1 py-3 cursor-pointer",
                      hasConflict &&
                        !isDisabled &&
                        "bg-yellow-50 dark:bg-yellow-950/30 border-l-2 border-yellow-400"
                    )}
                    disabled={isDisabled}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {course.Course}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {course.Section}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {course.Credits} credits
                        </Badge>
                        {!hasSched && (
                          <Badge variant="destructive" className="text-xs">
                            TBA
                          </Badge>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <span className="font-medium text-sm line-clamp-1">
                      {course["Course Title"]}
                    </span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {course.Instructor}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {course.Dates}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {course["Delivery Method"]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="line-clamp-1">
                        {formatSchedule(course)}
                      </span>
                    </div>
                    {hasConflict && !isSelected && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>
                          Conflicts with:{" "}
                          {conflictingCourses.map((c) => c.Section).join(", ")}
                        </span>
                      </div>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
