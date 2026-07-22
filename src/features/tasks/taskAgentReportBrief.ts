import type { TaskAgentReportInfo, TaskAgentRole } from "../../types/domain";

export type TaskAgentFindingKind = "risk" | "check" | "suggestion" | "note";

export interface TaskAgentFinding {
  id: string;
  role: TaskAgentRole;
  phase: TaskAgentReportInfo["phase"];
  sequence: number;
  kind: TaskAgentFindingKind;
  content: string;
  transcriptSessionId: string;
  provenanceEventCount: number;
}

const MAX_FINDINGS = 6;
const MAX_LINES_PER_REPORT = 3;
const MAX_CONTENT_LENGTH = 220;

export function deriveTaskAgentFindings(reports: TaskAgentReportInfo[]): TaskAgentFinding[] {
  const findings: TaskAgentFinding[] = [];
  const orderedReports = [...reports].sort((left, right) => right.sequence - left.sequence);
  for (const report of orderedReports) {
    const lines = extractCandidateLines(report.content).slice(0, MAX_LINES_PER_REPORT);
    for (const [index, line] of lines.entries()) {
      findings.push({
        id: `${report.id}:${index}`,
        role: report.role,
        phase: report.phase,
        sequence: report.sequence,
        kind: classifyFinding(line),
        content: line,
        transcriptSessionId: report.transcriptSessionId,
        provenanceEventCount: report.sourceTranscriptEventIds.length,
      });
      if (findings.length >= MAX_FINDINGS) return findings;
    }
  }
  return findings;
}

function extractCandidateLines(content: string) {
  const lines = content.split(/\r?\n/)
    .map((line) => normalizeFindingLine(line))
    .filter((line) => line.length > 0);
  if (lines.length > 0) return uniqueLines(lines).map(trimLongContent);
  const fallback = content.replace(/\s+/g, " ").trim();
  return fallback ? [trimLongContent(fallback)] : [];
}

function normalizeFindingLine(line: string) {
  return line.trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .trim();
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function trimLongContent(content: string) {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  return `${content.slice(0, MAX_CONTENT_LENGTH - 1).trimEnd()}…`;
}

function classifyFinding(line: string): TaskAgentFindingKind {
  if (/\b(risk|blocker|bug|fail|failing|regression|missing|unsafe|security|data loss|incorrect)\b/i.test(line)) {
    return "risk";
  }
  if (/\b(test|verify|check|review|confirm|validate)\b/i.test(line)) return "check";
  if (/\b(should|consider|add|fix|use|need|next|recommend)\b/i.test(line)) return "suggestion";
  return "note";
}
