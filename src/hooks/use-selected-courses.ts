"use client";

import { useState, useEffect, useCallback } from "react";
import { Course, SelectedCourse } from "@/types/course";
import { updateCoursesWithConflicts } from "@/lib/schedule-utils";

const STORAGE_KEY = "vinuni-selected-courses";

export function useSelectedCourses() {
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Course[];
        // Recalculate conflicts on load
        setSelectedCourses(updateCoursesWithConflicts(parsed));
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
          ({ id, hasConflict, conflictsWith, ...course }) => course
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
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

  const isCourseSelected = useCallback(
    (sectionId: string) => {
      return selectedCourses.some((c) => c.Section === sectionId);
    },
    [selectedCourses]
  );

  return {
    selectedCourses,
    addCourse,
    removeCourse,
    clearAllCourses,
    isCourseSelected,
    isLoaded,
  };
}
