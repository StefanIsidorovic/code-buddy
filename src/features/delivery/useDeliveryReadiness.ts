import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { GitDeliveryReadinessInfo } from "../../types/domain";

export function useDeliveryReadiness(repositoryPath: string | null | undefined) {
  const [readiness, setReadiness] = useState<GitDeliveryReadinessInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const repositoryPathRef = useRef(repositoryPath?.trim() || null);

  useEffect(() => {
    const nextPath = repositoryPath?.trim() || null;
    repositoryPathRef.current = nextPath;
    setReadiness(null);
    setError(null);
    void refresh(nextPath);
  }, [repositoryPath]);

  async function refresh(path = repositoryPathRef.current) {
    const request = ++requestId.current;
    if (!path) {
      setReadiness(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const value = await invokeCommand<GitDeliveryReadinessInfo>(
        "inspect_git_delivery_readiness",
        { repositoryPath: path },
      );
      if (request === requestId.current && repositoryPathRef.current === path) {
        setReadiness(value);
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

  return { readiness, loading, error, refresh };
}
