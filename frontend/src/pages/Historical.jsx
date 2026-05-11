import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
  PieChart, Pie,
} from "recharts";

const API = "http://127.0.0.1:8000";
const COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#f97316","#14b8a6"];

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:8, padding:"10px 14px",
    }}>
      <div style={{ color:"var(--text-muted)", fontSize:11, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, fontSize:13, fontWeight:500 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function Historical() {
  const [categories, setCategories] = useState([]);
  const [headlines,  setHeadlines]  = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/categories`).then(r => r.json()),
      fetch(`${API}/headlines?limit=500`).then(r => r.json()),
    ]).then(([c, h]) => {
      setCategories(c);
      setHeadlines(h);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{
      display:"flex", alignItems:"center",
      justifyContent:"center", height:"60vh",
      color:"var(--text-muted)", flexDirection:"column", gap:12,
    }}>
      <div style={{ fontSize:32 }}>◈</div>
      <div>Loading analysis...</div>
    </div>
  );

  // ── Derived analytics from real headline data ──────────
  const catMap = {};
  headlines.forEach(h => {
    const cat = h.category || "General";
    if (!catMap[cat]) catMap[cat] = { pos:0, neg:0, neu:0, total:0, scores:[] };
    catMap[cat].total++;
    catMap[cat].scores.push(h.sentiment_score || 0);
    if (h.sentiment_label === "positive") catMap[cat].pos++;
    else if (h.sentiment_label === "negative") catMap[cat].neg++;
    else catMap[cat].neu++;
  });

  const catStats = Object.entries(catMap).map(([cat, d]) => ({
    category:    cat,
    total:       d.total,
    positive:    d.pos,
    negative:    d.neg,
    neutral:     d.neu,
    pos_pct:     d.total ? Math.round(d.pos / d.total * 100) : 0,
    neg_pct:     d.total ? Math.round(d.neg / d.total * 100) : 0,
    avg_sent:    d.scores.length
                   ? d.scores.reduce((a,b)=>a+b,0)/d.scores.length
                   : 0,
    risk_score:  d.total
                   ? Math.round(d.neg / d.total * 100)
                   : 0,
  })).sort((a,b) => b.total - a.total);

  // Source breakdown
  const srcMap = {};
  headlines.forEach(h => {
    const s = h.source || "Unknown";
    if (!srcMap[s]) srcMap[s] = 0;
    srcMap[s]++;
  });
  const srcData = Object.entries(srcMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 8);

  // Sentiment over time (by day)
  const dayMap = {};
  headlines.forEach(h => {
    const day = h.published_at?.slice(0,10);
    if (!day) return;
    if (!dayMap[day]) dayMap[day] = { pos:0, neg:0, neu:0 };
    if (h.sentiment_label === "positive") dayMap[day].pos++;
    else if (h.sentiment_label === "negative") dayMap[day].neg++;
    else dayMap[day].neu++;
  });
  const timeData = Object.entries(dayMap)
    .map(([date, d]) => ({ date, ...d }))
    .sort((a,b) => a.date.localeCompare(b.date));

  // Most negative categories for risk radar
  const radarData = catStats.map(c => ({
    category: c.category,
    risk:     c.neg_pct,
    positive: c.pos_pct,
    volume:   Math.min(c.total * 3, 100),
  }));

  const totalHeadlines = headlines.length;
  const totalPos = headlines.filter(h=>h.sentiment_label==="positive").length;
  const totalNeg = headlines.filter(h=>h.sentiment_label==="negative").length;
  const marketMood = totalPos > totalNeg ? "Bullish" : totalNeg > totalPos ? "Bearish" : "Neutral";
  const moodColor  = marketMood === "Bullish" ? "#10b981" : marketMood === "Bearish" ? "#ef4444" : "#6b7280";

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.5px" }}>
          Historical Signal Analysis
        </h1>
        <p style={{ color:"var(--text-muted)", fontSize:13, marginTop:4 }}>
          Sentiment patterns, source analysis and category risk scores
          — built from {totalHeadlines} real headlines
        </p>
      </div>

      {/* Market mood banner */}
      <div style={{
        background:`linear-gradient(135deg, ${moodColor}18, ${moodColor}08)`,
        border:`1px solid ${moodColor}40`,
        borderRadius:12, padding:"16px 22px",
        marginBottom:24,
        display:"flex", alignItems:"center",
        justifyContent:"space-between",
      }}>
        <div>
          <div style={{
            fontSize:11, color:"var(--text-muted)",
            textTransform:"uppercase", letterSpacing:"0.08em",
            marginBottom:4,
          }}>Current Market Mood — based on news sentiment</div>
          <div style={{
            fontSize:28, fontWeight:700, color:moodColor,
            fontFamily:"'JetBrains Mono',monospace",
          }}>{marketMood}</div>
        </div>
        <div style={{
          display:"flex", gap:24, textAlign:"center",
        }}>
          {[
            ["Positive", totalPos, "#10b981"],
            ["Negative", totalNeg, "#ef4444"],
            ["Neutral",  totalHeadlines-totalPos-totalNeg, "#6b7280"],
          ].map(([label, val, color]) => (
            <div key={label}>
              <div style={{
                fontSize:22, fontWeight:700, color,
                fontFamily:"'JetBrains Mono',monospace",
              }}>{val}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category risk cards */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(3,1fr)",
        gap:14, marginBottom:24,
      }}>
        {catStats.map((c,i) => (
          <div key={c.category} style={{
            background:"var(--bg-card)",
            border:"1px solid var(--border)",
            borderRadius:12, padding:"16px 18px",
            borderLeft:`3px solid ${COLORS[i%COLORS.length]}`,
          }}>
            {/* Card header */}
            <div style={{
              display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:12,
            }}>
              <div style={{
                fontSize:14, fontWeight:600,
                color:COLORS[i%COLORS.length],
              }}>{c.category}</div>
              <div style={{
                fontSize:10, color:"var(--text-muted)",
                background:"var(--bg-secondary)",
                padding:"2px 8px", borderRadius:20,
              }}>{c.total} headlines</div>
            </div>

            {/* Sentiment bar */}
            <div style={{ marginBottom:10 }}>
              <div style={{
                display:"flex", height:8, borderRadius:4,
                overflow:"hidden", gap:1,
              }}>
                <div style={{
                  width:`${c.pos_pct}%`,
                  background:"#10b981",
                  transition:"width .5s",
                }}/>
                <div style={{
                  width:`${c.neg_pct}%`,
                  background:"#ef4444",
                  transition:"width .5s",
                }}/>
                <div style={{
                  flex:1, background:"#374151",
                }}/>
              </div>
              <div style={{
                display:"flex", justifyContent:"space-between",
                marginTop:5,
              }}>
                <span style={{ fontSize:10, color:"#10b981" }}>
                  {c.pos_pct}% positive
                </span>
                <span style={{ fontSize:10, color:"#ef4444" }}>
                  {c.neg_pct}% negative
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
              gap:6,
            }}>
              {[
                ["Avg Sentiment",
                  `${c.avg_sent>0?"+":""}${c.avg_sent.toFixed(2)}`,
                  c.avg_sent>0.05?"#10b981":c.avg_sent<-0.05?"#ef4444":"#6b7280"],
                ["Risk Score",
                  `${c.risk_score}%`,
                  c.risk_score>40?"#ef4444":c.risk_score>20?"#f59e0b":"#10b981"],
                ["Headlines", c.total, COLORS[i%COLORS.length]],
              ].map(([label,val,color])=>(
                <div key={label} style={{
                  background:"var(--bg-secondary)",
                  borderRadius:6, padding:"8px 8px",
                  textAlign:"center",
                }}>
                  <div style={{
                    fontSize:9, color:"var(--text-muted)",
                    marginBottom:3,
                    textTransform:"uppercase", letterSpacing:"0.06em",
                  }}>{label}</div>
                  <div style={{
                    fontSize:13, fontWeight:700, color,
                    fontFamily:"'JetBrains Mono',monospace",
                  }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:16, marginBottom:16,
      }}>

        {/* Sentiment by category bar */}
        <div style={{
          background:"var(--bg-card)",
          border:"1px solid var(--border)",
          borderRadius:12, padding:"20px 22px",
        }}>
          <div style={{
            fontSize:12, fontWeight:600,
            color:"var(--text-secondary)",
            textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:16,
          }}>Avg Sentiment Score by Category</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={catStats}
              barSize={28}
              layout="vertical"
            >
              <XAxis type="number" domain={[-1,1]}
                tick={{ fill:"var(--text-muted)", fontSize:10 }}
                tickFormatter={v => v.toFixed(1)}
              />
              <YAxis type="category" dataKey="category" width={80}
                tick={{ fill:"var(--text-muted)", fontSize:10 }}
              />
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="avg_sent" name="Avg Sentiment" radius={[0,4,4,0]}>
                {catStats.map((c,i) => (
                  <Cell key={i} fill={
                    c.avg_sent > 0.05 ? "#10b981"
                    : c.avg_sent < -0.05 ? "#ef4444"
                    : "#6b7280"
                  }/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source distribution */}
        <div style={{
          background:"var(--bg-card)",
          border:"1px solid var(--border)",
          borderRadius:12, padding:"20px 22px",
        }}>
          <div style={{
            fontSize:12, fontWeight:600,
            color:"var(--text-secondary)",
            textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:16,
          }}>Headlines by Source</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={srcData} barSize={24} layout="vertical">
              <XAxis type="number"
                tick={{ fill:"var(--text-muted)", fontSize:10 }}/>
              <YAxis type="category" dataKey="source" width={110}
                tick={{ fill:"var(--text-muted)", fontSize:9 }}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="count" name="Headlines" radius={[0,4,4,0]}>
                {srcData.map((_,i) => (
                  <Cell key={i} fill={COLORS[i%COLORS.length]}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:16, marginBottom:16,
      }}>

        {/* Sentiment over time */}
        <div style={{
          background:"var(--bg-card)",
          border:"1px solid var(--border)",
          borderRadius:12, padding:"20px 22px",
        }}>
          <div style={{
            fontSize:12, fontWeight:600,
            color:"var(--text-secondary)",
            textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:16,
          }}>Sentiment Volume Over Time</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeData} barSize={20}>
              <XAxis dataKey="date"
                tick={{ fill:"var(--text-muted)", fontSize:9 }}
                tickFormatter={d => d?.slice(5)}
              />
              <YAxis tick={{ fill:"var(--text-muted)", fontSize:10 }}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="pos" name="Positive"
                stackId="a" fill="#10b981"/>
              <Bar dataKey="neg" name="Negative"
                stackId="a" fill="#ef4444"/>
              <Bar dataKey="neu" name="Neutral"
                stackId="a" fill="#374151" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk radar */}
        <div style={{
          background:"var(--bg-card)",
          border:"1px solid var(--border)",
          borderRadius:12, padding:"20px 22px",
        }}>
          <div style={{
            fontSize:12, fontWeight:600,
            color:"var(--text-secondary)",
            textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:16,
          }}>Category Risk Radar</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)"/>
              <PolarAngleAxis dataKey="category"
                tick={{ fill:"var(--text-muted)", fontSize:9 }}/>
              <Radar name="Risk %" dataKey="risk"
                stroke="#ef4444" fill="#ef4444" fillOpacity={0.2}/>
              <Radar name="Positive %" dataKey="positive"
                stroke="#10b981" fill="#10b981" fillOpacity={0.15}/>
              <Tooltip content={<Tip/>}/>
            </RadarChart>
          </ResponsiveContainer>
          <div style={{
            display:"flex", justifyContent:"center",
            gap:16, marginTop:8,
          }}>
            {[["Risk %","#ef4444"],["Positive %","#10b981"]].map(([l,c])=>(
              <div key={l} style={{
                display:"flex", alignItems:"center", gap:4,
              }}>
                <div style={{
                  width:8, height:8, borderRadius:"50%", background:c,
                }}/>
                <span style={{ fontSize:10, color:"var(--text-secondary)" }}>
                  {l}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Most negative headlines */}
      <div style={{
        background:"var(--bg-card)",
        border:"1px solid var(--border)",
        borderRadius:12, overflow:"hidden",
      }}>
        <div style={{
          padding:"16px 22px",
          borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between",
          alignItems:"center",
        }}>
          <div style={{
            fontSize:12, fontWeight:600,
            color:"var(--text-secondary)",
            textTransform:"uppercase", letterSpacing:"0.08em",
          }}>Top Risk Headlines — Highest Negative Sentiment</div>
          <div style={{
            fontSize:11, color:"var(--text-muted)",
            background:"var(--bg-secondary)",
            padding:"3px 10px", borderRadius:20,
          }}>sorted by sentiment score</div>
        </div>
        <div>
          {headlines
            .filter(h => h.sentiment_label === "negative")
            .sort((a,b) => a.sentiment_score - b.sentiment_score)
            .slice(0, 8)
            .map((h, i) => (
              <div key={h.id} style={{
                padding:"12px 22px",
                borderBottom:"1px solid var(--border)",
                display:"grid",
                gridTemplateColumns:"1fr 90px 80px",
                gap:16, alignItems:"center",
                background: i%2===0
                  ? "transparent" : "rgba(255,255,255,0.01)",
              }}
                onMouseEnter={e =>
                  e.currentTarget.style.background="var(--bg-hover)"}
                onMouseLeave={e =>
                  e.currentTarget.style.background= i%2===0
                  ? "transparent" : "rgba(255,255,255,0.01)"}
              >
                <div>
                  <a href={h.url} target="_blank" rel="noreferrer"
                    style={{
                      color:"var(--text-primary)",
                      textDecoration:"none",
                      fontSize:13, fontWeight:500,
                    }}>
                    {h.title}
                  </a>
                  <div style={{
                    fontSize:11, color:"var(--text-muted)",
                    marginTop:3, display:"flex", gap:8,
                  }}>
                    <span>{h.source}</span>
                    <span>·</span>
                    <span>{h.published_at?.slice(0,10)}</span>
                    <span>·</span>
                    <span style={{ color:"#ef4444" }}>{h.category}</span>
                  </div>
                </div>
                <div style={{
                  fontSize:11,
                  background:"#2d0a0a",
                  color:"#ef4444",
                  padding:"3px 8px",
                  borderRadius:20,
                  textAlign:"center",
                  fontWeight:600,
                }}>HIGH RISK</div>
                <div style={{
                  fontSize:13, fontWeight:700,
                  color:"#ef4444",
                  fontFamily:"'JetBrains Mono',monospace",
                  textAlign:"right",
                }}>
                  {h.sentiment_score?.toFixed(3)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}