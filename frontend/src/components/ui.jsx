import theme from "../theme";

const toneMap = {
  primary: {
    color: theme.colors.primary,
    background: "rgba(255, 141, 161, 0.12)",
    border: "rgba(255, 141, 161, 0.18)"
  },
  secondary: {
    color: theme.colors.secondary,
    background: "rgba(255, 194, 186, 0.12)",
    border: "rgba(255, 194, 186, 0.18)"
  },
  accent: {
    color: theme.colors.accent,
    background: "rgba(255, 156, 233, 0.12)",
    border: "rgba(255, 156, 233, 0.18)"
  },
  success: {
    color: theme.colors.success,
    background: "rgba(99, 230, 190, 0.12)",
    border: "rgba(99, 230, 190, 0.18)"
  },
  warning: {
    color: theme.colors.warning,
    background: "rgba(255, 209, 102, 0.12)",
    border: "rgba(255, 209, 102, 0.18)"
  },
  info: {
    color: theme.colors.info,
    background: "rgba(122, 199, 255, 0.12)",
    border: "rgba(122, 199, 255, 0.18)"
  }
};

const getTone = (tone) => toneMap[tone] ?? toneMap.accent;

export function PageHeader({ badge, title, subtitle, actions }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "20px",
        flexWrap: "wrap",
        marginBottom: "28px"
      }}
    >
      <div style={{ maxWidth: "840px" }}>
        {badge && <StatusPill tone="info">{badge}</StatusPill>}
        <h1
          style={{
            fontSize: "clamp(34px, 5vw, 60px)",
            lineHeight: 1.05,
            margin: "16px 0 14px"
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: 0,
              maxWidth: "860px",
              color: theme.colors.mutedText,
              fontSize: "17px",
              lineHeight: 1.75
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export function StatusPill({ children, tone = "accent" }) {
  const palette = getTone(tone);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        borderRadius: theme.radii.pill,
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: "13px",
        fontWeight: "700",
        letterSpacing: "0.04em",
        textTransform: "uppercase"
      }}
    >
      {children}
    </span>
  );
}

export function MetricCard({ icon: Icon, label, value, helper, tone = "accent" }) {
  const palette = getTone(tone);

  return (
    <div
      style={{
        padding: "22px",
        borderRadius: theme.radii.xl,
        background: theme.gradients.panel,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: theme.shadows.soft,
        minHeight: "170px"
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "16px",
          display: "grid",
          placeItems: "center",
          background: palette.background,
          color: palette.color,
          border: `1px solid ${palette.border}`,
          marginBottom: "18px"
        }}
      >
        {Icon ? <Icon sx={{ fontSize: 24 }} /> : null}
      </div>

      <p style={{ margin: 0, color: theme.colors.mutedText, fontSize: "14px" }}>{label}</p>
      <h3 style={{ margin: "12px 0 8px", fontSize: "34px", lineHeight: 1.1 }}>{value}</h3>
      {helper && <p style={{ margin: 0, color: palette.color, fontSize: "14px" }}>{helper}</p>}
    </div>
  );
}

export function GlassPanel({ title, subtitle, action, children, style }) {
  return (
    <section
      style={{
        padding: "24px",
        borderRadius: theme.radii.xl,
        background: theme.gradients.panelStrong,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: theme.shadows.panel,
        ...style
      }}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "18px"
          }}
        >
          <div>
            {title && <h2 style={{ margin: 0, fontSize: "24px" }}>{title}</h2>}
            {subtitle && (
              <p style={{ margin: "8px 0 0", color: theme.colors.mutedText, lineHeight: 1.7 }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div
      style={{
        padding: "28px",
        borderRadius: theme.radii.xl,
        border: `1px dashed ${theme.colors.border}`,
        background: "rgba(255,255,255,0.03)"
      }}
    >
      <h3 style={{ margin: "0 0 10px" }}>{title}</h3>
      <p style={{ margin: 0, color: theme.colors.mutedText, lineHeight: 1.7 }}>{description}</p>
    </div>
  );
}
