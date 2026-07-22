import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type { AcpPermissionRequest } from "../../types/domain";

export function useAcpPermissions(sessionId: string | null, active: boolean,
  reportError: (message: string | null) => void) {
  const [permissions, setPermissions] = useState<AcpPermissionRequest[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    const request = ++requestId.current; setPermissions([]);
    if (!sessionId || !active) return;
    const refresh = async () => { try {
      const value = await invokeCommand<AcpPermissionRequest[]>("list_acp_permissions", { sessionId });
      if (request === requestId.current) setPermissions(Array.isArray(value) ? value : []);
    } catch (reason) { if (request === requestId.current) reportError(errorText(reason)); } };
    void refresh(); const timer = window.setInterval(() => void refresh(), 500);
    return () => window.clearInterval(timer);
  }, [active, sessionId]);

  async function respond(permissionId: string, optionId: string) {
    if (!sessionId) return; reportError(null);
    try { await invokeCommand<void>("respond_acp_permission", {
      request: { sessionId, permissionId, optionId },
    }); setPermissions((current) => current.filter(({ id }) => id !== permissionId)); }
    catch (reason) { reportError(errorText(reason)); }
  }
  return { permissions, respond };
}
