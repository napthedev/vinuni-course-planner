"use client";

import { useState, useMemo } from "react";
import {
  Check,
  ChevronsUpDown,
  Clock,
  User,
  Calendar,
  MapPin,
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
import { hasValidSchedule } from "@/lib/schedule-utils";

interface CourseSelectorProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  isCourseSelected: (sectionId: string) => boolean;
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
  onSelectCourse,
  isCourseSelected,
}: CourseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Filter courses based on search value
  const filteredCourses = useMemo(() => {
    if (!searchValue.trim()) {
      return courses.slice(0, 100); // Show first 100 courses when no search
    }

    const search = searchValue.toLowerCase().trim();
    return courses
      .filter((course) => {
        const searchableText =
          `${course.Course} ${course["Course Title"]} ${course.Section} ${course.Instructor}`.toLowerCase();
        return searchableText.includes(search);
      })
      .slice(0, 100); // Limit results for performance
  }, [courses, searchValue]);

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
            placeholder="Search by course code, title, or instructor..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No courses found.</CommandEmpty>
            <CommandGroup>
              {filteredCourses.map((course) => {
                const isSelected = isCourseSelected(course.Section);
                const hasSched = hasValidSchedule(course);

                return (
                  <CommandItem
                    key={course.Section}
                    value={course.Section}
                    onSelect={() => {
                      if (!isSelected) {
                        onSelectCourse(course);
                      }
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                    disabled={isSelected}
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
