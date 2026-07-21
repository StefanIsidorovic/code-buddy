export function CloseIcon() {
  return (
    <svg aria-hidden="true" className="close-icon" viewBox="0 0 16 16">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden="true" className="chevron-icon" viewBox="0 0 16 16">
      <path d={expanded ? "M3.5 10.25 8 5.75l4.5 4.5" : "M3.5 5.75 8 10.25l4.5-4.5"} />
    </svg>
  );
}
