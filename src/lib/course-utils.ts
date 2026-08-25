const UNASSIGNED_INSTRUCTOR_LABEL = "Unassigned";

export function getInstructorDisplayName(instructor: string): string {
  return instructor || UNASSIGNED_INSTRUCTOR_LABEL;
}
