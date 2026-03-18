import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardRounded from "@mui/icons-material/DashboardRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import NotesRounded from "@mui/icons-material/NotesRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import RecordVoiceOverRounded from "@mui/icons-material/RecordVoiceOverRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AltRouteRounded from "@mui/icons-material/AltRouteRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import MonitorHeartRounded from "@mui/icons-material/MonitorHeartRounded";
import PhoneInTalkRounded from "@mui/icons-material/PhoneInTalkRounded";
import theme from "../theme";

const navItems = [
  { to: "/", label: "Dashboard", icon: DashboardRounded },
  { to: "/patients", label: "Patients", icon: GroupsRounded },
  { to: "/followups", label: "Followups", icon: NotesRounded },
  { to: "/alerts", label: "Alerts", icon: WarningAmberRounded },
  { to: "/ai-followup", label: "AI Followup", icon: AutoAwesomeRounded },
  { to: "/workflow-builder", label: "Workflow Builder", icon: AltRouteRounded },
  { to: "/medical-inbox", label: "Medical Inbox", icon: InboxRounded },
  { to: "/disease-detection", label: "Disease Detection", icon: MonitorHeartRounded },
  { to: "/automated-calls", label: "Automated Calls", icon: PhoneInTalkRounded }
];

function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkStyle = (path) => ({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    color: "white",
    textDecoration: "none",
    margin: "8px 0",
    fontSize: "16px",
    fontWeight: "600",
    padding: "12px 14px",
    borderRadius: "16px",
    background: location.pathname === path ? "rgba(255,255,255,0.18)" : "transparent",
    border: "1px solid rgba(255,255,255,0.06)",
    transition: "0.2s ease"
  });

  const brand = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px"
      }}
    >
      <div
        style={{
          width: "54px",
          height: "54px",
          borderRadius: "18px",
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.12)"
        }}
      >
        <RecordVoiceOverRounded sx={{ fontSize: 28 }} />
      </div>

      <div>
        <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.14em", opacity: 0.8 }}>
          PILOT MODE
        </p>
        <h1
          style={{
            margin: "4px 0 0",
            fontSize: "28px",
            lineHeight: "1.05",
            fontWeight: "800"
          }}
        >
          Indic Voice AI
        </h1>
      </div>
    </div>
  );

  const navLinks = (
    <nav>
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            style={linkStyle(item.to)}
          >
            <Icon sx={{ fontSize: 22 }} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside
        className="sidebar sidebar-desktop"
        style={{
          padding: "24px 18px",
          background: theme.gradients.sidebar,
          color: "white",
          boxShadow: "4px 0 18px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div style={{ marginBottom: "24px" }}>{brand}</div>

        <div
          style={{
            padding: "16px",
            borderRadius: theme.radii.xl,
            background: "rgba(12, 10, 18, 0.18)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginBottom: "18px"
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "12px", letterSpacing: "0.08em", opacity: 0.75 }}>
            CARE OPERATIONS
          </p>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: "14px" }}>
            Multilingual voice followups, AI symptom extraction, and smart escalation in one place.
          </p>
        </div>

        {navLinks}

        <div
          style={{
            marginTop: "auto",
            padding: "16px",
            borderRadius: theme.radii.xl,
            background: "rgba(0,0,0,0.15)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "12px", letterSpacing: "0.08em", opacity: 0.75 }}>
            NEXT UP
          </p>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: "14px" }}>
            Workflow builder, outbound voice campaigns, and hospital analytics can plug into this shell next.
          </p>
        </div>
      </aside>

      <div
        className="sidebar-mobile"
        style={{
          background: theme.gradients.sidebar,
          color: "white",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <div
          className="sidebar-mobile-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "16px 18px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.12)"
              }}
            >
              <RecordVoiceOverRounded sx={{ fontSize: 24 }} />
            </div>

            <div>
              <p style={{ margin: 0, fontSize: "11px", letterSpacing: "0.12em", opacity: 0.8 }}>
                PILOT MODE
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: "800" }}>
                Indic Voice AI
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            style={{
              width: "46px",
              height: "46px",
              padding: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.14)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "none"
            }}
          >
            {mobileOpen ? <CloseRounded /> : <MenuRounded />}
          </button>
        </div>

        {mobileOpen && (
          <div
            style={{
              padding: "0 18px 18px"
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderRadius: theme.radii.xl,
                background: "rgba(12, 10, 18, 0.18)",
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "14px"
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: "12px", letterSpacing: "0.08em", opacity: 0.75 }}>
                CARE OPERATIONS
              </p>
              <p style={{ margin: 0, lineHeight: 1.6, fontSize: "14px" }}>
                Multilingual voice followups, AI symptom extraction, and smart escalation in one place.
              </p>
            </div>

            <div className="sidebar-mobile-nav">{navLinks}</div>
          </div>
        )}
      </div>
    </>
  );
}

export default Sidebar;
