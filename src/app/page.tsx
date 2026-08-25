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

function formatLastUpdated(timestamp: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(new Date(timestamp))
      .map(({ type, value }) => [type, value]),
  );

  return `${parts.month} ${parts.day} ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

const LAST_UPDATED = formatLastUpdated(coursesMetadata.lastUpdated);

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
            <span className="font-semibold">📋 Course Data Notice:</span> The course schedule was last updated on <span className="font-medium">{LAST_UPDATED} (Vietnam time)</span>. Please note that schedules may change at any time. We recommend double-checking course information on VinUniDigi before finalizing your registration.
          </p>
        </div>

        {/* Course Selector */}
        <section className="mb-6">
          {/* Stack actions below the title on narrow screens */}
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold">
              Search Courses for {TERM_NAME}{" "}
              <span className="text-muted-foreground">
                (Total: {courses.length} courses)
              </span>
            </h2>
            <div className="flex items-center justify-end gap-2">
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          {/* Calendar Section */}
          <section className="min-w-0 order-2 lg:order-1">
            <WeeklyCalendar courses={selectedCourses} />
            <CountdownTimer />
          </section>

          {/* Selected Courses Sidebar */}
          <aside className="order-1 lg:relative lg:min-h-0 lg:order-2">
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
          <p className="mx-auto mt-3 max-w-3xl text-xs leading-relaxed">
            {APP_CONFIG.site.disclaimer}
          </p>
        </div>
      </footer>
    </div>
  );
}
