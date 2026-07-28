import type { TaskPlanDraft } from "../../types/domain";

const requirementKinds = new Set(["functional", "constraint", "non_functional", "out_of_scope"]);
const stepKinds = new Set(["implementation", "infrastructure"]);

export function parseTaskPlanDraft(evidence: string): TaskPlanDraft | null {
  const match = evidence.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return null;
  try {
    return validateDraft(JSON.parse(match[1]));
  } catch {
    return null;
  }
}

function validateDraft(value: unknown): TaskPlanDraft | null {
  if (!record(value) || !Array.isArray(value.requirements) || !Array.isArray(value.steps)
    || value.requirements.length === 0 || value.steps.length === 0) return null;
  const requirements = value.requirements.map((item) => {
    if (!record(item) || !text(item.id) || !text(item.text) || !text(item.kind)
      || !requirementKinds.has(item.kind)) return null;
    return { id: item.id.trim(), text: item.text.trim(), kind: item.kind };
  });
  if (requirements.some((item) => !item)) return null;
  const typedRequirements = requirements.filter((item): item is NonNullable<typeof item> => !!item);
  const ids = new Set(typedRequirements.map(({ id }) => id));
  if (ids.size !== typedRequirements.length) return null;
  const steps = value.steps.map((item) => {
    if (!record(item) || !text(item.title) || !text(item.description) || !text(item.kind)
      || !stepKinds.has(item.kind) || typeof item.complexity !== "number"
      || !Number.isInteger(item.complexity) || item.complexity < 1 || item.complexity > 5
      || !strings(item.acceptanceCriteria, true) || !strings(item.expectedPaths)
      || !strings(item.satisfies)) return null;
    const satisfies = item.satisfies.map((entry) => entry.trim());
    if (satisfies.some((id) => !ids.has(id))
      || item.kind !== "infrastructure" && satisfies.length === 0) return null;
    return {
      title: item.title.trim(), description: item.description.trim(), kind: item.kind,
      complexity: item.complexity,
      acceptanceCriteria: item.acceptanceCriteria.map((entry) => entry.trim()),
      expectedPaths: item.expectedPaths.map((entry) => entry.trim()),
      satisfies,
    };
  });
  if (steps.some((item) => !item)) return null;
  return { requirements: typedRequirements,
    steps: steps.filter((item): item is NonNullable<typeof item> => !!item) };
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && !!value.trim();
}
function strings(value: unknown, required = false): value is string[] {
  return Array.isArray(value) && (!required || value.length > 0)
    && value.every((item) => typeof item === "string" && !!item.trim());
}
