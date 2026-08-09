"use client";

import { useState } from "react";
import { CourseSelector } from "@/components/course-selector";
import {
  CourseFilters,
  CourseFiltersContent,
} from "@/components/course-filters";
import { SelectedCourses } from "@/components/selected-courses";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import { CountdownTimer } from "@/components/countdown-timer";
import { useSelectedCourses } from "@/hooks/use-selected-courses";
import { useCourseFilters } from "@/hooks/use-course-filters";
import { Course } from "@/types/course";
import coursesData from "@/data/courses.json";
import coursesMetadata from "@/data/courses.meta.json";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SupportProjectButton } from "@/components/support-project-button";
import { ExportCalendarButton } from "@/components/export-calendar-button";
import { ViewListButton } from "@/components/view-list-button";
import { APP_CONFIG, TERM_NAME } from "@/config";

const courses = coursesData as Course[];

function formatLastUpdatedDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
    .format(date)
    .replace(",", "");
}

const LAST_UPDATED_DATE = formatLastUpdatedDate(coursesMetadata.lastUpdated);

export default function Home() {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const {
    selectedCourses,
    addCourse,
    removeCourse,
    clearAllCourses,
    isCourseSelected,
    isCourseCodeSelected,
    isLoaded,
  } = useSelectedCourses();

  const {
    filters,
    hasActiveFilters,
    getFilterDescription,
    applyPreset,
    updateDays,
    updateTimeRange,
    updateHideConflicts,
    resetFilters,
  } = useCourseFilters();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            <h1 className="text-lg font-semibold">{APP_CONFIG.site.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SupportProjectButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Update Warning */}
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <span className="font-semibold">📋 Course Data Notice:</span> The course schedule was last updated on <span className="font-medium">{LAST_UPDATED_DATE}</span>. Please note that schedules may change at any time. We recommend double-checking course information on SIS before finalizing your registration.
          </p>
        </div>

        {/* Course Selector */}
        <section className="mb-6">
          {/* Title row with filter button at flex-end */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">
              Search Courses for {TERM_NAME}
            </h2>
            <div className="flex items-center gap-2">
              <ViewListButton courses={selectedCourses} />
              <ExportCalendarButton courses={selectedCourses} />
              <CourseFilters
                filters={filters}
                hasActiveFilters={hasActiveFilters}
                getFilterDescription={getFilterDescription}
                applyPreset={applyPreset}
                updateDays={updateDays}
                updateTimeRange={updateTimeRange}
                updateHideConflicts={updateHideConflicts}
                resetFilters={resetFilters}
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                selectedCoursesCount={selectedCourses.length}
              />
            </div>
          </div>

          {/* Filter content - spans full width when open */}
          <CourseFiltersContent
            filters={filters}
            hasActiveFilters={hasActiveFilters}
            applyPreset={applyPreset}
            updateDays={updateDays}
            updateTimeRange={updateTimeRange}
            updateHideConflicts={updateHideConflicts}
            resetFilters={resetFilters}
            open={filtersOpen}
            selectedCoursesCount={selectedCourses.length}
          />

          {/* Add spacing when filters are open */}
          {filtersOpen && <div className="mb-3" />}

          <CourseSelector
            courses={courses}
            selectedCourses={selectedCourses}
            onSelectCourse={addCourse}
            isCourseSelected={isCourseSelected}
            isCourseCodeSelected={isCourseCodeSelected}
            filters={filters}
            hasActiveFilters={hasActiveFilters}
            resetFilters={resetFilters}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Search by course code, title, or instructor name. Click to add to
            your schedule.
          </p>
        </section>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          {/* Calendar Section */}
          <section className="order-2 lg:order-1">
            <WeeklyCalendar courses={selectedCourses} />
            <CountdownTimer />
          </section>

          {/* Selected Courses Sidebar */}
          <aside className="order-1 lg:order-2">
            {isLoaded ? (
              <SelectedCourses
                courses={selectedCourses}
                onRemoveCourse={removeCourse}
                onClearAll={clearAllCourses}
              />
            ) : (
              <div className="h-[500px] flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">
                  Loading saved courses...
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>{APP_CONFIG.site.footerText}</p>
        </div>
      </footer>
    </div>
  );
}
