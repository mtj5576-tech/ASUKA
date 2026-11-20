import assert from "node:assert/strict";
import { test } from "node:test";

import { browserEvidenceComplete, browserEvidenceSummary, createBrowserEvidenceBudget, recordBrowserEvidence } from "../server/native/browser-evidence.mjs";

test("browser evidence becomes complete only after three distinct pages are synced", () => {
  const budget = createBrowserEvidenceBudget();
  for (const url of ["https://www.centralbank.go.ke/", "https://www.knbs.or.ke/", "https://www.kra.go.ke/"]) {
    recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url } });
    recordBrowserEvidence(budget, { toolName: "browser_skill_sync", args: {} });
  }
  assert.equal(browserEvidenceComplete(budget), true);
  assert.deepEqual(browserEvidenceSummary(budget), { requiredPages: 3, requiredHosts: 2, navigatedPages: 3, syncedPages: 3, syncedHosts: 3, rejectedPages: 0, syncs: 3 });
});

test("browser evidence does not count an unsynced or duplicate navigation", () => {
  const budget = createBrowserEvidenceBudget();
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "https://www.knbs.or.ke/" } });
  recordBrowserEvidence(budget, { toolName: "browser_skill_sync", args: {} });
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "https://www.knbs.or.ke/" } });
  recordBrowserEvidence(budget, { toolName: "browser_skill_sync", args: {} });
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "not-a-url" } });
  assert.equal(browserEvidenceComplete(budget), false);
  assert.deepEqual(browserEvidenceSummary(budget), { requiredPages: 3, requiredHosts: 2, navigatedPages: 1, syncedPages: 1, syncedHosts: 1, rejectedPages: 0, syncs: 2 });
});

test("browser evidence ignores failed tool calls", () => {
  const budget = createBrowserEvidenceBudget();
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "https://www.knbs.or.ke/" }, ok: false });
  recordBrowserEvidence(budget, { toolName: "browser_skill_sync", args: {}, ok: false });
  assert.equal(browserEvidenceComplete(budget), false);
  assert.equal(browserEvidenceSummary(budget).syncs, 0);
});

test("browser evidence rejects a synced 404 page", () => {
  const budget = createBrowserEvidenceBudget();
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "https://www.kra.go.ke/missing" } });
  recordBrowserEvidence(budget, {
    toolName: "browser_skill_sync",
    args: {},
    text: 'RootWebArea "Error: 404 - KRA"\nheading "404"\nparagraph "The page you were looking for could not be found!"',
  });
  assert.equal(browserEvidenceComplete(budget), false);
  assert.deepEqual(browserEvidenceSummary(budget), { requiredPages: 3, requiredHosts: 2, navigatedPages: 1, syncedPages: 0, syncedHosts: 0, rejectedPages: 1, syncs: 1 });
});

test("browser evidence rejects a soft 404 page", () => {
  const budget = createBrowserEvidenceBudget();
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "https://www.knbs.or.ke/reports/" } });
  recordBrowserEvidence(budget, {
    toolName: "browser_skill_sync",
    args: {},
    text: 'RootWebArea "Page not found - Kenya National Bureau of Statistics"\nheading "Page not found"',
  });
  assert.equal(browserEvidenceComplete(budget), false);
  assert.equal(browserEvidenceSummary(budget).rejectedPages, 1);
});

test("browser evidence rejects an escaped browser-skill error payload", () => {
  const budget = createBrowserEvidenceBudget();
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "https://www.centralbank.go.ke/missing" } });
  recordBrowserEvidence(budget, {
    toolName: "browser_skill_sync",
    args: {},
    text: '{\\n  \\"observation\\": {\\n    \\"text\\": \\"RootWebArea \\\\\\"404 Not Found | CBK\\\\\\"\\\\n    article \\\\\\"No Results Found\\\\\\"\\"\\n  }\\n}',
  });
  assert.equal(browserEvidenceComplete(budget), false);
  assert.equal(browserEvidenceSummary(budget).rejectedPages, 1);
});

test("browser evidence requires at least two independent official hosts", () => {
  const budget = createBrowserEvidenceBudget();
  for (const url of ["https://www.knbs.or.ke/", "https://www.knbs.or.ke/reports/", "https://www.knbs.or.ke/about/"]) {
    recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url } });
    recordBrowserEvidence(budget, { toolName: "browser_skill_sync", args: {}, text: 'RootWebArea "KENYA NATIONAL BUREAU OF STATISTICS"' });
  }
  assert.equal(browserEvidenceComplete(budget), false);
  recordBrowserEvidence(budget, { toolName: "browser_skill_navigate", args: { url: "https://www.kra.go.ke/" } });
  recordBrowserEvidence(budget, { toolName: "browser_skill_sync", args: {}, text: 'RootWebArea "Home - KRA"' });
  assert.equal(browserEvidenceComplete(budget), true);
  assert.equal(browserEvidenceSummary(budget).syncedHosts, 2);
});
