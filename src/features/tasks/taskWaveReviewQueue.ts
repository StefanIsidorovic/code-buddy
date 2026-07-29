import type { TaskPlanStepRunInfo } from "../../types/domain";

export type TaskWaveReviewVerdict = "pass" | "needs_attention";

export interface TaskWaveReviewQueueItem {
  runId: string;
  planStepId: string;
  stepOrderIndex: number;
  verdict: TaskWaveReviewVerdict;
  summary: string;
  evidence: string[];
}

export interface TaskWaveReviewQueue {
  overall: TaskWaveReviewVerdict;
  recommendation: string;
  items: TaskWaveReviewQueueItem[];
}

interface EvaluationEnvelope {
  runs?: unknown;
  overall?: unknown;
  recommendation?: unknown;
}

const MAX_SUMMARY_LENGTH = 280;
const MAX_EVIDENCE_LENGTH = 220;

export function deriveTaskWaveReviewQueue(
  content: string,
  runs: TaskPlanStepRunInfo[],
): TaskWaveReviewQueue | null {
  const parsed = parseEnvelope(content);
  if (!parsed || !isVerdict(parsed.overall)) return null;
  const recommendation = boundedText(parsed.recommendation, MAX_SUMMARY_LENGTH);
  if (!recommendation || !Array.isArray(parsed.runs)) return null;
  const supported = new Map(runs.map((run) => [run.id, run]));
  const seen = new Set<string>();
  const items: TaskWaveReviewQueueItem[] = [];
  for (const candidate of parsed.runs) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = candidate as Record<string, unknown>;
    const runId = typeof value.runId === "string" ? value.runId.trim() : "";
    const run = supported.get(runId);
    if (!run || seen.has(runId) || !isVerdict(value.verdict)) continue;
    const summary = boundedText(value.summary, MAX_SUMMARY_LENGTH);
    if (!summary) continue;
    const blocked = run.status === "failed" || run.scopeStatus === "out_of_scope"
      || run.scopeStatus === "unavailable" || run.verificationStatus === "unavailable";
    const verdict = blocked ? "needs_attention" : value.verdict;
    seen.add(runId);
    items.push({
      runId,
      planStepId: run.planStepId,
      stepOrderIndex: run.stepOrderIndex,
      verdict,
      summary,
      evidence: observedEvidence(run),
    });
  }
  if (items.length === 0) return null;
  items.sort((left, right) =>
    Number(right.verdict === "needs_attention") - Number(left.verdict === "needs_attention")
    || left.stepOrderIndex - right.stepOrderIndex);
  const overall = items.some(({ verdict }) => verdict === "needs_attention")
    ? "needs_attention" : parsed.overall;
  return { overall, recommendation, items };
}

function observedEvidence(run: TaskPlanStepRunInfo) {
  const evidence = [
    run.status ? `status: ${run.status}` : null,
    run.verificationStatus ? `verification: ${run.verificationStatus}` : null,
    run.scopeStatus ? `scope: ${run.scopeStatus}` : null,
    run.error ? `error: ${run.error}` : null,
  ];
  return evidence.filter((item): item is string => !!item)
    .map((item) => boundedText(item, MAX_EVIDENCE_LENGTH))
    .filter((item): item is string => !!item);
}

function parseEnvelope(content: string): EvaluationEnvelope | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  if (!candidate.trim()) return null;
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return parsed && typeof parsed === "object" ? parsed as EvaluationEnvelope : null;
  } catch {
    return null;
  }
}

function isVerdict(value: unknown): value is TaskWaveReviewVerdict {
  return value === "pass" || value === "needs_attention";
}

function boundedText(value: unknown, limit: number) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1).trimEnd()}…`;
}
