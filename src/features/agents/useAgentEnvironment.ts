import { useEffect, useMemo, useRef, useState } from "react";
import { errorText } from "../../lib/presentation";
import { invokeCommand } from "../../lib/tauriGateway";
import type {
  AgentDoctorReport,
  ModelCatalogInfo,
  ModelTier,
  ProjectInitializationSummaryInfo,
} from "../../types/domain";

const defaultProfileId = "openai-gpt-5.6-terra-medium";

interface Options {
  summary: ProjectInitializationSummaryInfo | null;
  notifyError: (message: string) => void;
}

export function useAgentEnvironment({ summary, notifyError }: Options) {
  const [doctorReports, setDoctorReports] = useState<AgentDoctorReport[]>([]);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [catalog, setCatalog] = useState<ModelCatalogInfo | null>(null);
  const [tier, setTier] = useState<ModelTier>("mid");
  const [profileId, setProfileId] = useState(defaultProfileId);
  const doctorRequest = useRef(0);
  const catalogRequest = useRef(0);
  const selectedProfile = useMemo(
    () => catalog?.profiles.find((profile) => profile.id === profileId) ?? null,
    [catalog, profileId],
  );
  const codexReport = doctorReports.find((report) => report.adapter.id === "codex") ?? null;

  useEffect(() => {
    void refreshDoctor();
    void refreshCatalog();
  }, []);

  useEffect(() => {
    if (summary?.requestedModelProfileId && summary.requestedModelTier) {
      setProfileId(summary.requestedModelProfileId);
      setTier(summary.requestedModelTier);
    } else if (!summary) {
      setProfileId(defaultProfileId);
      setTier("mid");
    }
  }, [summary?.requestedModelProfileId, summary?.requestedModelTier]);

  useEffect(() => {
    if (selectedProfile) setTier(selectedProfile.tier);
  }, [selectedProfile]);

  async function refreshDoctor() {
    const request = ++doctorRequest.current;
    setDoctorLoading(true);
    setDoctorError(null);
    try {
      const reports = await invokeCommand<AgentDoctorReport[]>("list_agent_doctor_reports");
      if (request === doctorRequest.current) setDoctorReports(reports);
    } catch (reason) {
      if (request === doctorRequest.current) setDoctorError(errorText(reason));
    } finally {
      if (request === doctorRequest.current) setDoctorLoading(false);
    }
  }

  async function refreshCatalog() {
    const request = ++catalogRequest.current;
    try {
      const value = await invokeCommand<ModelCatalogInfo>("list_model_catalog");
      if (!value || !Array.isArray(value.providers) || !Array.isArray(value.profiles)) {
        throw new Error("Invalid model catalog response.");
      }
      if (request !== catalogRequest.current) return;
      setCatalog(value);
      setProfileId((current) => chooseProfileId(value, current));
    } catch (reason) {
      if (request === catalogRequest.current) notifyError(errorText(reason));
    }
  }

  function changeTier(nextTier: ModelTier) {
    setTier(nextTier);
    const current = catalog?.profiles.find((profile) => profile.id === profileId);
    if (current?.tier === nextTier && current.status === "selectable") return;
    const profiles = catalog?.profiles.filter((profile) => profile.tier === nextTier) ?? [];
    setProfileId(
      profiles.find((profile) => profile.status === "selectable")?.id ?? profiles[0]?.id ?? "",
    );
  }

  return {
    doctorReports,
    doctorError,
    doctorLoading,
    canStartCodex: codexReport?.status === "installed",
    catalog,
    tier,
    profileId,
    selectedProfile,
    refreshDoctor,
    changeTier,
    changeProfile: setProfileId,
  };
}

function chooseProfileId(catalog: ModelCatalogInfo, current: string) {
  const selected = catalog.profiles.find(
    (profile) => profile.id === current && profile.status === "selectable",
  );
  const fallback = catalog.profiles.find(
    (profile) => profile.id === defaultProfileId && profile.status === "selectable",
  ) ?? catalog.profiles.find((profile) => profile.status === "selectable")
    ?? catalog.profiles.find((profile) => profile.id === defaultProfileId)
    ?? catalog.profiles[0];
  return (selected ?? fallback)?.id ?? "";
}
