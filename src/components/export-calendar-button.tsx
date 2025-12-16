"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SelectedCourse } from "@/types/course";
import { downloadICS, canExportCourses } from "@/lib/ics-generator";

interface ExportCalendarButtonProps {
  courses: SelectedCourse[];
}

export function ExportCalendarButton({ courses }: ExportCalendarButtonProps) {
  const canExport = canExportCourses(courses);
  const hasConflicts = courses.some((c) => c.hasConflict);
  const noCourses = courses.length === 0;

  const getTooltipMessage = () => {
    if (noCourses) return "Add courses to export";
    if (hasConflicts) return "Resolve conflicts before exporting";
    return "Download calendar file (.ics)";
  };

  const handleExport = () => {
    if (canExport) {
      downloadICS(courses);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExport}
              disabled={!canExport}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipMessage()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
