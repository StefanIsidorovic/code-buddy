import type { TaskContextDispatchReceiptInfo, TaskPhaseRunReceiptInfo } from "../../types/domain";

interface Props {
  contextReceipts: TaskContextDispatchReceiptInfo[];
  currentAcpSessionId: string | null;
  phaseReceipts: TaskPhaseRunReceiptInfo[];
  onReviewContext: (receiptId: string) => void;
  onReviewPhase: (receiptId: string) => void;
}

export function interruptedReceipts<T extends { acpSessionId: string; status: string }>(
  receipts: T[], currentAcpSessionId: string | null,
) {
  return receipts.filter(({ acpSessionId, status }) =>
    status === "pending" && acpSessionId !== currentAcpSessionId);
}

export function TaskRecoveryNotice({ contextReceipts, currentAcpSessionId, phaseReceipts,
  onReviewContext, onReviewPhase }: Props) {
  const contexts = interruptedReceipts(contextReceipts, currentAcpSessionId);
  const phases = interruptedReceipts(phaseReceipts, currentAcpSessionId);
  if (contexts.length === 0 && phases.length === 0) return null;
  return <section className="task-recovery-notice" aria-labelledby="task-recovery-title" role="status">
    <div><span aria-hidden="true">!</span><div><h3 id="task-recovery-title">Interrupted work needs review</h3>
      <p>{phases.length} phase run(s) and {contexts.length} context send(s) have no confirmed outcome.</p></div></div>
    <p>Resuming the conversation does not prove that these earlier requests completed. Inspect the
      agent history, then mark an exact receipt as failed only when you want to treat that attempt as incomplete.</p>
    <div className="task-recovery-actions">
      {phases[0] ? <button type="button" onClick={() => onReviewPhase(phases[0].id)}>
        Review phase run #{phases[0].sequence + 1}</button> : null}
      {contexts[0] ? <button type="button" onClick={() => onReviewContext(contexts[0].id)}>
        Review context send #{contexts[0].sequence + 1}</button> : null}
    </div>
  </section>;
}
