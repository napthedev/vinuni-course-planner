"use client";

import { useState, useMemo } from "react";
import {
  Check,
  ChevronsUpDown,
  Clock,
  User,
  Calendar,
  MapPin,
  Filter,
  X,
  ChevronDown,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Course,
  DAYS_OF_WEEK,
  CALENDAR_START_HOUR,
  CALENDAR_END_HOUR,
} from "@/types/course";
import {
  hasValidSchedule,
  courseMatchesTimeFilter,
  formatTime,
  coursesConflict,
} from "@/lib/schedule-utils";
import { useCourseFilters, TIME_PRESETS } from "@/hooks/use-course-filters";
import { useIsMobile } from "@/hooks/use-mobile";

interface CourseSelectorProps {
  courses: Course[];
  selectedCourses: Course[];
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
  selectedCourses,
  onSelectCourse,
  isCourseSelected,
}: CourseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useIsMobile();

  const {
    filters,
    hasActiveFilters,
    getFilterDescription,
    applyPreset,
    updateDays,
    updateTimeRange,
    resetFilters,
  } = useCourseFilters();

  // Generate time options for selects (7 AM to 10 PM)
  const timeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let hour = CALENDAR_START_HOUR; hour <= CALENDAR_END_HOUR; hour++) {
      options.push({
        value: hour.toString(),
        label: formatTime(hour),
      });
    }
    return options;
  }, []);

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
        {/* Time Filters Section */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <div className="border-b">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between px-3 py-2 h-auto"
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm">Filters</span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {getFilterDescription()}
                    </Badge>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    filtersOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-3 sm:p-4 space-y-4 border-b bg-muted/30">
              {/* Preset Select */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Quick Presets
                </Label>
                <Select
                  value={filters.preset || ""}
                  onValueChange={(value) => applyPreset(value || null)}
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue placeholder="Select a preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIME_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Day Checkboxes */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Days</Label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`day-${day}`}
                        checked={filters.days[day]}
                        onCheckedChange={(checked) =>
                          updateDays(day, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`day-${day}`}
                        className="text-xs cursor-pointer"
                      >
                        {isMobile ? day.slice(0, 2) : day.slice(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Time Range
                </Label>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      After
                    </span>
                    <Select
                      value={filters.timeRange.startHour?.toString() || "any"}
                      onValueChange={(value) =>
                        updateTimeRange(
                          "startHour",
                          value === "any" ? null : parseInt(value)
                        )
                      }
                    >
                      <SelectTrigger className="w-full sm:w-28" size="sm">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {timeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Before
                    </span>
                    <Select
                      value={filters.timeRange.endHour?.toString() || "any"}
                      onValueChange={(value) =>
                        updateTimeRange(
                          "endHour",
                          value === "any" ? null : parseInt(value)
                        )
                      }
                    >
                      <SelectTrigger className="w-full sm:w-28" size="sm">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {timeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="w-full"
                >
                  <X className="h-3 w-3 mr-1" />
                  Reset Filters
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

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
                const hasSched = hasValidSchedule(course);

                // Check for conflicts with selected courses
                const conflictingCourses = selectedCourses.filter((selected) =>
                  coursesConflict(course, selected)
                );
                const hasConflict = conflictingCourses.length > 0;

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
                    className={cn(
                      "flex flex-col items-start gap-1 py-3 cursor-pointer",
                      hasConflict &&
                        !isSelected &&
                        "bg-yellow-50 dark:bg-yellow-950/30 border-l-2 border-yellow-400"
                    )}
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
