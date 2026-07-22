import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { GitDeliveryProvenanceHistoryEntry, GitDeliveryReadinessInfo } from "../../types/domain";

const PROVENANCE_HISTORY_LIMIT = 5;

export function useDeliveryReadiness(repositoryPath: string | null | undefined) {
  const [readiness, setReadiness] = useState<GitDeliveryReadinessInfo | null>(null);
  const [provenanceHistory, setProvenanceHistory] = useState<GitDeliveryProvenanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const repositoryPathRef = useRef(repositoryPath?.trim() || null);

  useEffect(() => {
    const nextPath = repositoryPath?.trim() || null;
    repositoryPathRef.current = nextPath;
    setReadiness(null);
    setProvenanceHistory([]);
    setError(null);
    void refresh(nextPath);
  }, [repositoryPath]);

  async function refresh(path = repositoryPathRef.current) {
    const request = ++requestId.current;
    if (!path) {
      setReadiness(null);
      setProvenanceHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [value, history] = await Promise.all([
        invokeCommand<GitDeliveryReadinessInfo>("inspect_git_delivery_readiness", { repositoryPath: path }),
        invokeCommand<GitDeliveryProvenanceHistoryEntry[]>("list_git_delivery_provenance_history",
          { repositoryPath: path, limit: PROVENANCE_HISTORY_LIMIT }),
      ]);
      if (request === requestId.current && repositoryPathRef.current === path) {
        setReadiness(value);
        setProvenanceHistory(history);
      }
    } catch (reason) {
      if (request === requestId.current && repositoryPathRef.current === path) {
        setError(errorText(reason));
      }
    } finally {
      if (request === requestId.current && repositoryPathRef.current === path) {
        setLoading(false);
      }
    }
  }

  return { readiness, provenanceHistory, loading, error, refresh };
}
