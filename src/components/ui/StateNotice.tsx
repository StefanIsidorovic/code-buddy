export type StateNoticeKind = "prerequisite" | "loading" | "empty" | "success" | "error";

export function StateNotice({
  as = "div",
  description,
  kind,
  title,
}: {
  as?: "div" | "li";
  description: string;
  kind: StateNoticeKind;
  title: string;
}) {
  const Element = as;
  const role = kind === "error" ? "alert" : kind === "loading" || kind === "success" ? "status" : undefined;

  return (
    <Element className="state-notice" data-kind={kind} role={role}>
      <span className="state-notice-indicator" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </Element>
  );
}
