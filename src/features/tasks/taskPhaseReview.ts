import type { TaskPhaseInfo } from "../../types/domain";
export const taskPhaseReviewCriteria: Record<TaskPhaseInfo["phase"], readonly string[]> = {
  analysis: ["Findings name affected boundaries and constraints.", "Risks and unknowns are explicit.", "Claims link to persisted transcript evidence."],
  planning: ["Steps are concrete and ordered.", "Verification and rollback expectations are stated.", "The plan stays inside the Task scope."],
  execution: ["Implemented changes and deviations are identified.", "Verification results are recorded.", "Failures or unverified claims remain explicit."],
  review: ["Correctness and regression risks were checked.", "Remaining limitations are explicit.", "The final evidence supports the completion claim."],
};
