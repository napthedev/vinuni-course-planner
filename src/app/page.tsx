"use client";

import { CourseSelector } from "@/components/course-selector";
import { SelectedCourses } from "@/components/selected-courses";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import { useSelectedCourses } from "@/hooks/use-selected-courses";
import { Course } from "@/types/course";
import coursesData from "@/data/courses.json";
import { GraduationCap } from "lucide-react";

const courses = coursesData as Course[];

export default function Home() {
  const {
    selectedCourses,
    addCourse,
    removeCourse,
    clearAllCourses,
    isCourseSelected,
    isLoaded,
  } = useSelectedCourses();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            <h1 className="text-lg font-semibold">VinUni Course Planner</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Course Selector */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Search Courses</h2>
          <CourseSelector
            courses={courses}
            onSelectCourse={addCourse}
            isCourseSelected={isCourseSelected}
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
          <p>VinUni Course Planning Tool • Plan your semester schedule</p>
        </div>
      </footer>
    </div>
  );
}
