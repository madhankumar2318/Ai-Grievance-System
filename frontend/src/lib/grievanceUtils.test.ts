import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  maskEmail,
  parseEmbeddedTag,
  stripEmbeddedTags,
  mapRoleToDepartment,
  computeDepartmentClearancePct,
  parseDeadlineHours,
  computeDirectiveSlaStatus,
  findDuplicateComplaint,
  findMatchingAreaComplaints,
} from "./grievanceUtils.ts";

describe("maskEmail (PII Protection)", () => {
  it("masks standard email addresses while keeping first/last local char and domain", () => {
    assert.equal(maskEmail("rajan.kumar@gmail.com"), "r***r@gmail.com");
    assert.equal(maskEmail("skmadhan1823@gmail.com"), "s***3@gmail.com");
  });

  it("handles single-character local part safely", () => {
    assert.equal(maskEmail("a@example.org"), "a***@example.org");
  });

  it("returns fallback label for invalid or empty emails", () => {
    assert.equal(maskEmail(""), "Registered Citizen");
    assert.equal(maskEmail("not-an-email"), "Registered Citizen");
  });
});

describe("parseEmbeddedTag & stripEmbeddedTags", () => {
  it("parses COLLECTOR_DIRECTIVE JSON safely", () => {
    const desc =
      'Pipe burst near hospital. [COLLECTOR_DIRECTIVE:{"directiveId":"DIR-2026-1042","priorityTarget":"Within 24 Hours (Expedite)","directiveNote":"Restore water immediately","issuedBy":"District Collector"}]';
    const parsed = parseEmbeddedTag<{ directiveId: string; priorityTarget: string }>(
      desc,
      "COLLECTOR_DIRECTIVE"
    );
    assert.ok(parsed);
    assert.equal(parsed.directiveId, "DIR-2026-1042");
    assert.equal(parsed.priorityTarget, "Within 24 Hours (Expedite)");
  });

  it("returns null on malformed JSON without throwing", () => {
    const desc = "Broken tag [COLLECTOR_DIRECTIVE:{bad json}]";
    assert.equal(parseEmbeddedTag(desc, "COLLECTOR_DIRECTIVE"), null);
  });

  it("strips all internal metadata tags from citizen-visible descriptions", () => {
    const desc =
      'Streetlight broken [EVIDENCE_PHOTO:https://example.com/a.jpg] [COLLECTOR_DIRECTIVE:{"directiveId":"DIR-1"}] [CLAIMED_BY:{"officerName":"Madhan"}] [ACTION_TAKEN_REPORT:{"officerName":"Ravi"}]';
    assert.equal(stripEmbeddedTags(desc), "Streetlight broken");
  });
});

describe("mapRoleToDepartment", () => {
  it("routes all 5 core departmental designations accurately", () => {
    assert.equal(mapRoleToDepartment("Environment Protection Officer"), "Environment");
    assert.equal(mapRoleToDepartment("Infrastructure & PWD Engineer"), "Infrastructure");
    assert.equal(mapRoleToDepartment("Health & Sanitation Inspector"), "Public Health");
    assert.equal(mapRoleToDepartment("Cyber Crime Police Officer"), "Safety");
    assert.equal(mapRoleToDepartment("Tahsildar (Revenue Administration)"), "Administrative");
  });
});

describe("computeDepartmentClearancePct", () => {
  it("calculates rounded clearance percentage", () => {
    assert.equal(computeDepartmentClearancePct(0, 2), 100);
    assert.equal(computeDepartmentClearancePct(2, 1), 33);
    assert.equal(computeDepartmentClearancePct(3, 1), 25);
    assert.equal(computeDepartmentClearancePct(2, 0), 0);
  });

  it("defaults to 100% when a department has 0 cases", () => {
    assert.equal(computeDepartmentClearancePct(0, 0), 100);
  });
});

describe("parseDeadlineHours & computeDirectiveSlaStatus", () => {
  it("parses preset and custom hour/day targets and clamps to 30 days (720h)", () => {
    assert.equal(parseDeadlineHours("🚨 24-Hour Expedite"), 24);
    assert.equal(parseDeadlineHours("⏱️ 48-Hour Priority Directive"), 48);
    assert.equal(parseDeadlineHours("📅 3 Days — Standard Repair"), 72);
    assert.equal(parseDeadlineHours("🛠️ 7 Days — Heavy Repair"), 168);
    assert.equal(parseDeadlineHours("🏗️ 15 Days — Major Work"), 360);
    assert.equal(parseDeadlineHours("📆 30 Days — Reconstruction"), 720);
    assert.equal(parseDeadlineHours("Max Clamp", 9999), 720);
  });

  it("reports remaining time when within SLA and overdue when past deadline", () => {
    const issued = "2026-11-26T10:00:00.000Z";
    const sixHoursLater = new Date("2026-11-26T16:00:00.000Z").getTime();
    const thirtyHoursLater = new Date("2026-11-27T16:00:00.000Z").getTime();

    const active = computeDirectiveSlaStatus(issued, "24-Hour Expedite", "Pending", 24, sixHoursLater);
    assert.equal(active.isOverdue, false);
    assert.equal(active.label, "⏳ 18h left");

    const overdue = computeDirectiveSlaStatus(issued, "24-Hour Expedite", "In Progress", 24, thirtyHoursLater);
    assert.equal(overdue.isOverdue, true);
    assert.equal(overdue.label, "🚨 OVERDUE by 6h");

    const resolved = computeDirectiveSlaStatus(issued, "24-Hour Expedite", "Resolved", 24, thirtyHoursLater);
    assert.equal(resolved.isResolved, true);
    assert.equal(resolved.isOverdue, false);
  });
});

describe("findDuplicateComplaint", () => {
  const openList = [
    {
      id: "GRV-19821",
      subject: "Water pipe broken on main street",
      description: "Drinking water pipe leaking badly near bus stop",
      location: "Kaikatti, Tiruchirappalli",
      status: "Pending",
    },
    {
      id: "GRV-10005",
      subject: "Factory releasing black smoke",
      description: "Smoke pollution",
      location: "Industrial Area, Tiruchirappalli",
      status: "Resolved",
    },
  ];

  it("blocks exact duplicate active complaints", () => {
    const dup = findDuplicateComplaint(
      "Water pipe broken on main street!",
      "Same pipe issue",
      "Kaikatti",
      openList
    );
    assert.ok(dup);
    assert.equal(dup.id, "GRV-19821");
  });

  it("blocks differently worded duplicate complaints for the same problem", () => {
    const dup = findDuplicateComplaint(
      "Drinking water leaking near bus stop",
      "Pipe burst wasting water",
      "Kaikatti, Tiruchirappalli",
      openList
    );
    assert.ok(dup);
    assert.equal(dup.id, "GRV-19821");
  });

  it("allows different problems at the same location and allows re-filing resolved issues", () => {
    const differentProblem = findDuplicateComplaint(
      "Streetlight fused and dark at night",
      "Pole light not glowing",
      "Kaikatti, Tiruchirappalli",
      openList
    );
    assert.equal(differentProblem, null);

    const resolvedIssue = findDuplicateComplaint(
      "Factory releasing black smoke",
      "Smoke started again",
      "Industrial Area, Tiruchirappalli",
      openList
    );
    assert.equal(resolvedIssue, null);
  });
});

describe("findMatchingAreaComplaints (Auto-Cascade Resolve)", () => {
  it("matches only open complaints in the same department, same area, and same issue", () => {
    const resolved = {
      id: "GRV-10001",
      subject: "Water pipe burst on main road",
      description: "Drinking water pipe leaking badly",
      location: "Kaikatti, Tiruchirappalli",
      category: "Infrastructure",
    };

    const candidates = [
      {
        id: "GRV-10001",
        subject: "Water pipe burst on main road",
        location: "Kaikatti, Tiruchirappalli",
        category: "Infrastructure",
        status: "In Progress",
      },
      {
        id: "GRV-10002",
        subject: "Drinking water pipe leaking near Kaikatti",
        description: "Water wasted on road",
        location: "Kaikatti Junction, Tiruchirappalli",
        category: "Infrastructure",
        status: "Pending",
      },
      {
        id: "GRV-10003",
        subject: "Streetlight not working",
        description: "Dark road at night",
        location: "Kaikatti, Tiruchirappalli",
        category: "Infrastructure",
        status: "Pending",
      },
      {
        id: "GRV-10004",
        subject: "Water pipe burst on main road",
        description: "Drinking water leaking",
        location: "Cantonment, Tiruchirappalli",
        category: "Infrastructure",
        status: "Pending",
      },
      {
        id: "GRV-10005",
        subject: "Water pipe burst on main road",
        description: "Drinking water leaking",
        location: "Kaikatti, Tiruchirappalli",
        category: "Environment",
        status: "Pending",
      },
    ];

    const matches = findMatchingAreaComplaints(resolved, candidates);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, "GRV-10002");
  });

  it("matches nearby GPS coordinates and compound words like Streetlight vs Street light", () => {
    const resolved = {
      id: "GRV-20001",
      subject: "Streetlight not working",
      description: "Dark road",
      location: "10.95181, 78.44000",
      category: "Infrastructure",
    };

    const nearby = [
      {
        id: "GRV-20002",
        subject: "Street light not working",
        description: "Pole light off",
        location: "10.95195, 78.44012",
        category: "Infrastructure",
        status: "Pending",
      },
    ];

    const matches = findMatchingAreaComplaints(resolved, nearby);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, "GRV-20002");
  });
});
