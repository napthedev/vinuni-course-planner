"use client";

import { useState, useEffect, useCallback } from "react";
import { Course, SelectedCourse } from "@/types/course";
import { updateCoursesWithConflicts } from "@/lib/schedule-utils";
import coursesData from "@/data/courses.json";
import { APP_CONFIG } from "@/config";
import { toast } from "sonner";

// Master course data from courses.json
const masterCourses = coursesData as Course[];

/**
 * Validates stored courses against the master course data from courses.json.
 * Courses are identified by Course (code) and Section (section code).
 * If a course's data doesn't match the master data, it will be filtered out.
 */
function validateStoredCourses(storedCourses: Course[]): Course[] {
  return storedCourses.filter((storedCourse) => {
    // Find the corresponding course in master data by Course code and Section code
    const masterCourse = masterCourses.find(
      (mc) =>
        mc.Course === storedCourse.Course &&
        mc.Section === storedCourse.Section,
    );

    // If course doesn't exist in master data, remove it
    if (!masterCourse) {
      console.warn(
        `Course ${storedCourse.Course} section ${storedCourse.Section} not found in master data. Removing from saved courses.`,
      );
      return false;
    }

    // Compare all relevant fields to check if data matches
    const dataMatches =
      masterCourse["Course Title"] === storedCourse["Course Title"] &&
      masterCourse.Dates === storedCourse.Dates &&
      masterCourse.Credits === storedCourse.Credits &&
      masterCourse.Instructor === storedCourse.Instructor &&
      masterCourse["Delivery Method"] === storedCourse["Delivery Method"] &&
      JSON.stringify(masterCourse.Schedule) ===
        JSON.stringify(storedCourse.Schedule);

    if (!dataMatches) {
      console.warn(
        `Course ${storedCourse.Course} section ${storedCourse.Section} data has changed. Removing from saved courses.`,
      );
      return false;
    }

    return true;
  });
}

export function useSelectedCourses() {
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(
        APP_CONFIG.storageKeys.selectedCourses,
      );
      if (stored) {
        const parsed = JSON.parse(stored) as Course[];
        // Validate stored courses against master data
        const validatedCourses = validateStoredCourses(parsed);

        // If any courses were removed, update localStorage
        if (validatedCourses.length !== parsed.length) {
          const removedCount = parsed.length - validatedCourses.length;

          localStorage.setItem(
            APP_CONFIG.storageKeys.selectedCourses,
            JSON.stringify(validatedCourses),
          );
          console.info(
            `Removed ${removedCount} outdated course(s) from saved selection.`,
          );
          window.setTimeout(() => {
            toast.warning("Saved course data changed", {
              id: "outdated-saved-courses",
              description: `${removedCount} outdated ${
                removedCount === 1 ? "course was" : "courses were"
              } removed from your saved selection. Please review your schedule.`,
              duration: 8000,
              closeButton: true,
            });
          }, 0);
        }

        // Recalculate conflicts on load
        setSelectedCourses(updateCoursesWithConflicts(validatedCourses));
      }
    } catch (error) {
      console.error("Failed to load courses from localStorage:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever selectedCourses changes
  useEffect(() => {
    if (isLoaded) {
      try {
        // Store without conflict info (will be recalculated on load)
        const toStore = selectedCourses.map(
          ({ id, hasConflict, conflictsWith, ...course }) => course,
        );
        localStorage.setItem(
          APP_CONFIG.storageKeys.selectedCourses,
          JSON.stringify(toStore),
        );
      } catch (error) {
        console.error("Failed to save courses to localStorage:", error);
      }
    }
  }, [selectedCourses, isLoaded]);

  const addCourse = useCallback((course: Course) => {
    setSelectedCourses((prev) => {
      // Check if already selected (by Section)
      if (prev.some((c) => c.Section === course.Section)) {
        return prev;
      }
      // Add course and recalculate conflicts
      const newCourses = [...prev, course];
      return updateCoursesWithConflicts(newCourses);
    });
  }, []);

  const removeCourse = useCallback((sectionId: string) => {
    setSelectedCourses((prev) => {
      const filtered = prev.filter((c) => c.Section !== sectionId);
      // Recalculate conflicts after removal
      return updateCoursesWithConflicts(filtered);
    });
  }, []);

  const clearAllCourses = useCallback(() => {
    setSelectedCourses([]);
  }, []);

  const replaceAllCourses = useCallback((courses: Course[]) => {
    setSelectedCourses(updateCoursesWithConflicts(courses));
  }, []);

  const isCourseSelected = useCallback(
    (sectionId: string) => {
      return selectedCourses.some((c) => c.Section === sectionId);
    },
    [selectedCourses],
  );

  const isCourseCodeSelected = useCallback(
    (courseCode: string) => {
      return selectedCourses.some((c) => c.Course === courseCode);
    },
    [selectedCourses],
  );

  return {
    selectedCourses,
    addCourse,
    removeCourse,
    clearAllCourses,
    replaceAllCourses,
    isCourseSelected,
    isCourseCodeSelected,
    isLoaded,
  };
}
