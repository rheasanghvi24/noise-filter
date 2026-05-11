import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

const API = "http://127.0.0.1:8000";
const CAT_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899"];

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
          {p.name}: {typeof p.value==="number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

function KPI({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:12, padding:"20px 22px",
      borderTop:`2px solid ${color}`,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <div>
          <div style={{
            fontSize:11, color:"var(--text-muted)",
            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6,
          }}>{label}</div>
          <div style={{
            fontSize:28, fontWeight:700, color,
            fontFamily:"'JetBrains Mono',monospace", lineHeight:1,
          }}>{value}</div>
          {sub && <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:6 }}>{sub}</div>}
        </div>
        <div style={{ fontSize:22, opacity:0.6 }}>{icon}</div>
      </div>
    </div>
  );
}

function Badge({ label }) {
  const c = {
    positive:{ bg:"#052e1c", color:"#10b981" },
    negative:{ bg:"#2d0a0a", color:"#ef4444" },
    neutral: { bg:"#1a1f2e", color:"#6b7280" },
  }[label] || { bg:"#1a1f2e", color:"#6b7280" };
  return (
    <span style={{
      background:c.bg, color:c.color,
      padding:"2px 8px", borderRadius:20,
      fontSize:10, fontWeight:600,
      display:"inline-flex", alignItems:"center", gap:4,
    }}>
      <span style={{
        width:5, height:5, borderRadius:"50%",
        background:c.color, display:"inline-block",
      }}/>
      {label}
    </span>
  );
}

export default function Dashboard() {
  const [headlines, setHeadlines]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary]       = useState(null);
  const [prices, setPrices]         = useState([]);
  const [filter, setFilter]         = useState("All");
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/headlines?limit=100`).then(r=>r.json()),
      fetch(`${API}/categories`).then(r=>r.json()),
      fetch(`${API}/summary`).then(r=>r.json()),
      fetch(`${API}/prices/%5ENSEI?days=60`).then(r=>r.json()),
    ]).then(([h,c,s,p]) => {
      setHeadlines(h); setCategories(c);
      setSummary(s); setPrices(p);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  const filtered = filter==="All"
    ? headlines
    : headlines.filter(h=>h.category===filter);

  const pie = summary ? [
    { name:"Positive", value:summary.positive, color:"#10b981" },
    { name:"Negative", value:summary.negative, color:"#ef4444" },
    { name:"Neutral",  value:summary.neutral,  color:"#6b7280" },
  ] : [];

  const cats = ["All",...new Set(headlines.map(h=>h.category))];

  if (loading) return (
    <div style={{
      display:"flex", alignItems:"center",
      justifyContent:"center", height:"60vh",
      color:"var(--text-muted)", flexDirection:"column", gap:12,
    }}>
      <div style={{ fontSize:32 }}>◈</div>
      <div>Loading market intelligence...</div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.5px" }}>
          Market Intelligence Dashboard
        </h1>
        <p style={{ color:"var(--text-muted)", fontSize:13, marginTop:4 }}>
          Real-time signal vs noise classification · Indian financial news
        </p>
      </div>

      {/* KPIs */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(4,1fr)",
        gap:16, marginBottom:24,
      }}>
        <KPI label="Total Headlines"
          value={summary?.total_headlines?.toLocaleString()}
          sub="collected & categorised"
          color="var(--accent-blue)"  />
        <KPI label="Positive Signals"
          value={summary?.positive}
          sub={`${summary?Math.round(summary.positive/summary.scored_headlines*100):0}% of scored`}
          color="var(--accent-green)"/>
        <KPI label="Negative Signals"
          value={summary?.negative}
          sub={`${summary?Math.round(summary.negative/summary.scored_headlines*100):0}% of scored`}
          color="var(--accent-red)"/>
        <KPI label="Price Data Points"
          value={summary?.price_rows?.toLocaleString()}
          sub="3 years · 6 symbols"
          color="var(--accent-purple)"/>
      </div>

      {/* Charts row */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
        gap:16, marginBottom:24,
      }}>
        {/* Nifty chart */}
        <div style={{
          gridColumn:"span 2",
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:12, padding:"20px 22px",
        }}>
          <div style={{
            fontSize:12, fontWeight:600, color:"var(--text-secondary)",
            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16,
          }}>Nifty 50 — 60 Day Price History</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={prices}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/>
              <XAxis dataKey="date"
                tick={{ fill:"var(--text-muted)", fontSize:10 }}
                tickFormatter={d=>d?.slice(5,10)} interval={9}/>
              <YAxis
                tick={{ fill:"var(--text-muted)", fontSize:10 }}
                tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}
                domain={["auto","auto"]} width={55}/>
              <Tooltip content={<Tip/>}/>
              <Line type="monotone" dataKey="close_price" name="Nifty"
                stroke="var(--accent-blue)" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:12, padding:"20px 22px",
        }}>
          <div style={{
            fontSize:12, fontWeight:600, color:"var(--text-secondary)",
            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16,
          }}>Sentiment Split</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={pie} cx="50%" cy="50%"
                innerRadius={40} outerRadius={65}
                dataKey="value" strokeWidth={0}>
                {pie.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip content={<Tip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{
            display:"flex", justifyContent:"center",
            gap:12, marginTop:8, flexWrap:"wrap",
          }}>
            {pie.map(e=>(
              <div key={e.name} style={{
                display:"flex", alignItems:"center", gap:4,
              }}>
                <div style={{
                  width:8, height:8, borderRadius:"50%",
                  background:e.color,
                }}/>
                <span style={{ fontSize:10, color:"var(--text-secondary)" }}>
                  {e.name} ({e.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category bar */}
      <div style={{
        background:"var(--bg-card)", border:"1px solid var(--border)",
        borderRadius:12, padding:"20px 22px", marginBottom:24,
      }}>
        <div style={{
          fontSize:12, fontWeight:600, color:"var(--text-secondary)",
          textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16,
        }}>Headlines by Category</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={categories} barSize={32}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false}/>
            <XAxis dataKey="category" tick={{ fill:"var(--text-muted)", fontSize:11 }}/>
            <YAxis tick={{ fill:"var(--text-muted)", fontSize:11 }}/>
            <Tooltip content={<Tip/>}/>
            <Bar dataKey="sample_count" name="Headlines" radius={[4,4,0,0]}>
              {categories.map((_,i)=>(
                <Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Headlines table */}
      <div style={{
        background:"var(--bg-card)", border:"1px solid var(--border)",
        borderRadius:12, overflow:"hidden",
      }}>
        <div style={{
          padding:"16px 22px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:10,
        }}>
          <div style={{
            fontSize:12, fontWeight:600, color:"var(--text-secondary)",
            textTransform:"uppercase", letterSpacing:"0.08em",
          }}>
            Live Headlines — {filtered.length} shown
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {cats.map(cat=>(
              <button key={cat} onClick={()=>setFilter(cat)} style={{
                padding:"4px 10px", borderRadius:20, border:"1px solid",
                borderColor:filter===cat?"var(--accent-blue)":"var(--border)",
                background:filter===cat?"rgba(59,130,246,0.15)":"transparent",
                color:filter===cat?"var(--accent-blue)":"var(--text-muted)",
                fontSize:11, cursor:"pointer",
                fontWeight:filter===cat?600:400,
              }}>{cat}</button>
            ))}
          </div>
        </div>

        <div style={{ maxHeight:460, overflowY:"auto" }}>
          {filtered.map((h,i)=>(
            <div key={h.id} style={{
              padding:"14px 22px",
              borderBottom:"1px solid var(--border)",
              display:"grid",
              gridTemplateColumns:"1fr 100px 80px",
              gap:16, alignItems:"center",
              background:i%2===0?"transparent":"rgba(255,255,255,0.01)",
            }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"}
              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,0.01)"}
            >
              <div>
                <a href={h.url} target="_blank" rel="noreferrer" style={{
                  color:"var(--text-primary)", textDecoration:"none",
                  fontSize:13, fontWeight:500, lineHeight:1.4,
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
                  <span style={{
                    color:CAT_COLORS[
                      ["General","RBI","FII","Earnings",
                       "Geopolitics","Regulation","Budget"]
                      .indexOf(h.category)%CAT_COLORS.length
                    ],
                  }}>{h.category}</span>
                </div>
              </div>
              <Badge label={h.sentiment_label}/>
              <div style={{
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:13, fontWeight:600,
                color:h.sentiment_score>0.05
                  ?"var(--accent-green)"
                  :h.sentiment_score<-0.05
                  ?"var(--accent-red)"
                  :"var(--text-muted)",
                textAlign:"right",
              }}>
                {h.sentiment_score>0?"+":""}
                {h.sentiment_score?.toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}