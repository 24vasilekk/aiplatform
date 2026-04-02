import { describe, expect, it } from "vitest";
import { getCompletedCourseIdsForLoyalty } from "@/lib/loyalty";

describe("getCompletedCourseIdsForLoyalty", () => {
  it("returns only completed courses and removes duplicates", () => {
    const completed = getCompletedCourseIdsForLoyalty({
      courses: [
        { courseId: "math-base", status: "completed" },
        { courseId: "physics-base", status: "in_progress" },
        { courseId: "math-base", status: "completed" },
        { courseId: "chem-base", status: "not_started" },
        { courseId: "bio-base", status: "completed" },
      ] as Array<{ courseId: string; status: "not_started" | "in_progress" | "completed" }>,
    });

    expect(completed).toEqual(["math-base", "bio-base"]);
  });
});
