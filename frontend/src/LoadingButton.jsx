export default function LoadingButton({ state = "idle", children, pendingLabel = "Salvando...", successLabel = "Salvo", errorLabel = "Tentar novamente", ...props }) {
  const labels = { idle: children, pending: pendingLabel, success: successLabel, error: errorLabel };
  const icons = { success: "✓", error: "!" };
  const label = labels[state] ?? children;

  return (
    <button
      type="submit"
      className={`loading-button loading-button--${state}`}
      disabled={state !== "idle"}
      aria-busy={state === "pending"}
      aria-label={label}
      {...props}
    >
      {state === "pending" && <span className="loading-spinner" aria-hidden="true" />}
      {icons[state] && <span className="loading-icon" aria-hidden="true">{icons[state]}</span>}
      <span>{label}</span>
    </button>
  );
}
