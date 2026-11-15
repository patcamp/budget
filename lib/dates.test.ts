import { describe, expect, it } from "vitest";
import { addDaysLocal, parseLocalDate, toLocalDateString } from "./dates";

describe("toLocalDateString", () => {
  it("formats a local Date as YYYY-MM-DD without UTC shifting", () => {
    // Construct via local components so the test is timezone-stable.
    const d = new Date(2026, 2, 8, 23, 30); // Mar 8 2026, 11:30pm local
    expect(toLocalDateString(d)).toBe("2026-03-08");
  });
});

describe("parseLocalDate / addDaysLocal", () => {
  it("parses YYYY-MM-DD as local midnight", () => {
    const d = parseLocalDate("2026-03-08");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(8);
  });

  it("adds days across a US spring DST boundary without losing a day", () => {
    // 2026-03-08 + 1 day must be 2026-03-09 (DST spring-forward is Mar 8 2026 in US).
    expect(addDaysLocal("2026-03-08", 1)).toBe("2026-03-09");
    // 14-day period: start + 13 = end
    expect(addDaysLocal("2026-03-08", 13)).toBe("2026-03-21");
  });

  it("adds days across a US fall DST boundary", () => {
    // 2026-11-01 is the fall-back Sunday in US.
    expect(addDaysLocal("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysLocal("2026-11-01", 1)).toBe("2026-11-02");
  });
});
