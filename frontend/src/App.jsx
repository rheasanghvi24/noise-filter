import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Historical from "./pages/Historical";
import Analyser from "./pages/Analyser";
import "./index.css";

const NAV = [
  { id: "dashboard",  label: "Dashboard",  icon: "⬡" },
  { id: "historical", label: "Historical", icon: "◈" },
  { id: "analyser",   label: "Analyser",   icon: "◎" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/summary")
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Sidebar */}
      <aside style={{
        width: 220, background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        padding: "24px 0", position: "fixed",
        height: "100vh", zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 28px" }}>
          <div style={{
            fontSize: 18, fontWeight: 700,
            color: "var(--accent-blue)", letterSpacing: "-0.5px",
          }}>◈ NoiseFilter</div>
          <div style={{
            fontSize: 11, color: "var(--text-muted)", marginTop: 2,
            fontFamily: "'JetBrains Mono', monospace",
          }}>Indian Market Intelligence</div>
        </div>

        {/* Live indicator */}
        <div style={{
          margin: "0 16px 20px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent-green)",
            boxShadow: "0 0 6px var(--accent-green)",
            animation: "pulse 2s infinite",
          }}/>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            API Live
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 12px" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              width: "100%", textAlign: "left",
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8,
              border: "none", cursor: "pointer", marginBottom: 4,
              background: page === n.id
                ? "linear-gradient(135deg,#1d3a6e,#1e2d45)"
                : "transparent",
              color: page === n.id
                ? "var(--accent-blue)" : "var(--text-secondary)",
              fontWeight: page === n.id ? 600 : 400,
              fontSize: 13,
              borderLeft: page === n.id
                ? "2px solid var(--accent-blue)" : "2px solid transparent",
              transition: "all .15s",
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* DB Stats */}
        {summary && (
          <div style={{
            margin: "0 12px", padding: "12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)", borderRadius: 8,
          }}>
            <div style={{
              fontSize: 10, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: 8,
            }}>Database</div>
            {[
              ["Headlines", summary.total_headlines],
              ["Scored",    summary.scored_headlines],
              ["Price Rows",summary.price_rows],
            ].map(([label, val]) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {label}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: "var(--accent-blue)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {val?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 32px" }}>
        {page === "dashboard"  && <Dashboard />}
        {page === "historical" && <Historical />}
        {page === "analyser"   && <Analyser />}
      </main>

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; } 50% { opacity:0.4; }
        }
      `}</style>
    </div>
  );
}