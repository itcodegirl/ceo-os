function normalizeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeChiefOutput(payload = {}) {
  const structured = payload?.structured ?? {};

  return {
    title: normalizeText(payload.title, "Executive Action Plan"),
    summary: normalizeText(payload.summary, ""),
    source: normalizeText(payload.source, "proxy"),
    fallbackReason: normalizeText(payload.fallbackReason),
    errorCode: normalizeText(payload.errorCode),
    errorMessage: normalizeText(payload.errorMessage),
    structured: {
      priorities: normalizeArray(structured.priorities)
        .map((item) => ({
          title: normalizeText(item?.title),
          owner: normalizeText(item?.owner, "You"),
          status: normalizeText(item?.status, "Planned"),
          reason: normalizeText(item?.reason)
        }))
        .filter((item) => item.title),

      opportunities: normalizeArray(structured.opportunities)
        .map((item) => ({
          name: normalizeText(item?.name),
          company: normalizeText(item?.company, "Unknown"),
          priority: normalizeText(item?.priority, "Medium"),
          stage: normalizeText(item?.stage, "New"),
          nextStep: normalizeText(item?.nextStep)
        }))
        .filter((item) => item.name),

      contentItems: normalizeArray(structured.contentItems)
        .map((item) => ({
          title: normalizeText(item?.title),
          platform: normalizeText(item?.platform, "LinkedIn"),
          status: normalizeText(item?.status, "Drafting"),
          summary: normalizeText(item?.summary)
        }))
        .filter((item) => item.title),

      tasks: normalizeArray(structured.tasks)
        .map((item) => ({
          title: normalizeText(item?.title),
          type: normalizeText(item?.type, "task"),
          status: normalizeText(item?.status, "Planned")
        }))
        .filter((item) => item.title)
    }
  };
}
