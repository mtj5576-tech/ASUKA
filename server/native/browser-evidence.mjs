export const DEFAULT_BROWSER_EVIDENCE_PAGES = 3;
export const DEFAULT_BROWSER_EVIDENCE_HOSTS = 2;

function normalizedUrl(value) {
  try {
    return new URL(String(value || "").trim()).toString();
  } catch {
    return "";
  }
}

export function createBrowserEvidenceBudget({
  requiredPages = DEFAULT_BROWSER_EVIDENCE_PAGES,
  requiredHosts = DEFAULT_BROWSER_EVIDENCE_HOSTS,
} = {}) {
  return {
    requiredPages: Math.max(1, Number(requiredPages) || DEFAULT_BROWSER_EVIDENCE_PAGES),
    requiredHosts: Math.max(1, Number(requiredHosts) || DEFAULT_BROWSER_EVIDENCE_HOSTS),
    navigatedUrls: new Set(),
    syncedUrls: new Set(),
    rejectedUrls: new Set(),
    syncs: 0,
    pendingUrl: "",
    finalized: false,
  };
}

export function recordBrowserEvidence(budget, { toolName = "", args = {}, ok = true, text = "" } = {}) {
  if (!budget || !ok) return budget;
  if (toolName === "browser_skill_navigate") {
    const url = normalizedUrl(args.url);
    if (url) {
      budget.navigatedUrls.add(url);
      budget.pendingUrl = url;
    }
  } else if (toolName === "browser_skill_sync") {
    budget.syncs += 1;
    const invalidPage = /404\s+Not\s+Found|Page\s+not\s+found|The page you were looking for could not be found|No Results Found|page you requested could not be found|HTTP\s+404\b/i.test(String(text || ""));
    if (budget.pendingUrl && invalidPage) budget.rejectedUrls.add(budget.pendingUrl);
    else if (budget.pendingUrl) budget.syncedUrls.add(budget.pendingUrl);
    budget.pendingUrl = "";
  }
  return budget;
}

export function browserEvidenceComplete(budget) {
  if (!budget) return false;
  const hosts = new Set([...budget.syncedUrls].map((url) => new URL(url).hostname).filter(Boolean));
  return budget.syncedUrls.size >= budget.requiredPages && hosts.size >= budget.requiredHosts;
}

export function browserEvidenceSummary(budget) {
  return {
    requiredPages: budget?.requiredPages || DEFAULT_BROWSER_EVIDENCE_PAGES,
    requiredHosts: budget?.requiredHosts || DEFAULT_BROWSER_EVIDENCE_HOSTS,
    navigatedPages: budget?.navigatedUrls?.size || 0,
    syncedPages: budget?.syncedUrls?.size || 0,
    syncedHosts: new Set([...(budget?.syncedUrls || [])].map((url) => new URL(url).hostname).filter(Boolean)).size,
    rejectedPages: budget?.rejectedUrls?.size || 0,
    syncs: budget?.syncs || 0,
  };
}
