import json


def modify_schedule_times(input_file: str, output_file: str) -> None:
    """
    Read courses from JSON, modify schedule time formats, and write to a new file.

    - Replaces "- " with " to " in time fields
    - Splits combined times (separated by ", ") into separate schedule objects
    """
    # Load data
    with open(input_file, "r", encoding="utf-8") as f:
        courses = json.load(f)

    # Process each course
    for course in courses:
        # Skip if Schedule is missing or empty
        if not course.get("Schedule"):
            continue

        new_schedule = []
        for item in course["Schedule"]:
            # Skip items without a time field
            if "time" not in item:
                continue

            # Replace "- " with " to "
            time_str = item["time"].replace("- ", " to ")

            # Split on ", " if present (e.g., "9:00AM to 12:00PM, 3:30PM to 5:20PM")
            if ", " in time_str:
                times = time_str.split(", ")
                for t in times:
                    new_schedule.append({"day": item.get("day", ""), "time": t})
            else:
                new_schedule.append({"day": item.get("day", ""), "time": time_str})

        course["Schedule"] = new_schedule

    # Write to new file
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(courses, f, indent=4, ensure_ascii=False)

    print(f"Modified data written to {output_file}")


if __name__ == "__main__":
    modify_schedule_times("courses.json", "courses_modified.json")
