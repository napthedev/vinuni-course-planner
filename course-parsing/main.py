from bs4 import BeautifulSoup
import json
import re

with open("index.html", "r") as file:
    html_content = file.read()
# Note: In a real scenario, you would pass the full HTML string provided in your prompt to the variable above.
# For this script to run effectively on your data, ensure the 'html_content' variable contains the actual HTML block.


def extract_course_data(html_source):
    soup = BeautifulSoup(html_source, "html.parser")
    table = soup.find("table", id="CourseList")

    if not table:
        return []

    # Map headers
    headers = []
    header_row = table.find("thead").find("tr")
    for th in header_row.find_all("th"):
        headers.append(th.get_text(strip=True))

    results = []

    # Day mapping configuration
    day_map = {
        "M": "Monday",
        "T": "Tuesday",
        "W": "Wednesday",
        "H": "Thursday",
        "F": "Friday",
        "S": "Saturday",
        "U": "Sunday",
    }

    rows = table.find("tbody").find_all("tr")

    for row in rows:
        cells = row.find_all("td")
        if not cells:
            continue

        row_data = {}

        # We need to handle the specific columns based on the header indices
        # 1: Course, 2: Course Title, 3: Section, 4: Dates, 5: Credits, 6: Schedule

        row_data["Course"] = cells[1].get_text(strip=True)
        row_data["Course Title"] = cells[2].get_text(strip=True)
        row_data["Section"] = cells[3].get_text(strip=True)
        row_data["Dates"] = cells[4].get_text(strip=True)
        row_data["Credits"] = cells[5].get_text(strip=True)
        row_data["Instructor"] = cells[7].get_text(strip=True)
        row_data["Delivery Method"] = cells[8].get_text(strip=True)

        # --- SPECIAL HANDLING FOR SCHEDULE COLUMN (Index 6) ---
        schedule_cell = cells[6]
        schedule_span = schedule_cell.find("span", id="lnkDetails")

        raw_schedule_text = ""

        # Prioritize the 'title' attribute if it exists, otherwise use text
        if schedule_span:
            if schedule_span.has_attr("title"):
                raw_schedule_text = schedule_span["title"]
            else:
                raw_schedule_text = schedule_span.get_text(strip=True)
        else:
            raw_schedule_text = schedule_cell.get_text(strip=True)

        parsed_schedule = []

        if raw_schedule_text and raw_schedule_text != "No scheduled meetings":
            # Clean up the text (remove newlines, extra spaces)
            # The structure might be "WF 9:00AM... ; M 9:00AM..."
            # We split by semicolon or newlines to handle multiple schedules
            schedule_parts = re.split(r"[;\n]+", raw_schedule_text)

            for part in schedule_parts:
                part = part.strip()
                if not part:
                    continue

                # Regex to separate Day Codes (start of string) from Time
                # Looks for one or more letters [MTWHFSU] at start, followed by space
                match = re.match(r"^([MTWHFSU]+)\s+(.*)", part)

                if match:
                    days_code = match.group(1)
                    time_str = match.group(2).strip()

                    # Clean up time string (remove "to", replace with "-")
                    # Optional cosmetic fix

                    # Iterate through day codes (e.g., "WF" -> W, F)
                    for char in days_code:
                        if char in day_map:
                            parsed_schedule.append(
                                {"day": day_map[char], "time": time_str}
                            )

        row_data["Schedule"] = parsed_schedule
        results.append(row_data)

    return results


# --- execution ---
# Assuming you have the full HTML in a file or variable.
# Since the prompt provided the HTML text, I will assume it is passed to the function.
# For demonstration purposes with the provided snippet:

# To make this runnable with the snippet provided in the prompt,
# you would paste the large HTML block into the `html_content` variable.

data = extract_course_data(html_content)
json_output = json.dumps(data, indent=4)
with open("courses.json", "w") as json_file:
    json_file.write(json_output)
