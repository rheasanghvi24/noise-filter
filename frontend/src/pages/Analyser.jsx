import { useState } from "react";

const API = "http://127.0.0.1:8000";

const EXAMPLES = [
  "RBI raises repo rate by 25 basis points amid inflation concerns",
  "FII sell off continues as Sensex drops 800 points",
  "Infosys reports 18% jump in quarterly net profit, beats estimates",
  "SEBI bans 3 brokers for market manipulation",
  "Crude oil prices surge on OPEC production cuts",
];

export default function Analyser() {
  const [title, setTitle]     = useState("");
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);

  const analyse = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/analyse`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ title }),
      });
      setResult(await res.json());
    } finally { setLoading(false); }
  };

  const sc = s => s>0.05?"#10b981":s<-0.05?"#ef4444":"#6b7280";

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.5px" }}>
          Real-time Headline Analyser
        </h1>
        <p style={{ color:"var(--text-muted)", fontSize:13, marginTop:4 }}>
          Paste any financial headline — instantly see if it's signal or noise
        </p>
      </div>

      {/* Input box */}
      <div style={{
        background:"var(--bg-card)", border:"1px solid var(--border)",
        borderRadius:12, padding:24, marginBottom:20,
      }}>
        <textarea value={title} onChange={e=>setTitle(e.target.value)}
          placeholder="e.g. RBI holds repo rate steady at 6.5%, signals hawkish stance..."
          rows={3} style={{
            width:"100%", background:"var(--bg-secondary)",
            border:"1px solid var(--border)", borderRadius:8,
            padding:"12px 14px", color:"var(--text-primary)",
            fontSize:14, resize:"vertical", outline:"none",
            fontFamily:"inherit",
          }}
          onFocus={e=>e.target.style.borderColor="var(--accent-blue)"}
          onBlur={e=>e.target.style.borderColor="var(--border)"}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),analyse())}
        />
        <div style={{
          display:"flex", justifyContent:"space-between",
          alignItems:"center", marginTop:12,
        }}>
          <div style={{ fontSize:11, color:"var(--text-muted)" }}>
            Enter to analyse · Shift+Enter for new line
          </div>
          <button onClick={analyse} disabled={loading||!title.trim()} style={{
            background:title.trim()
              ?"linear-gradient(135deg,#1d4ed8,#3b82f6)"
              :"var(--bg-secondary)",
            color:title.trim()?"white":"var(--text-muted)",
            border:"none", borderRadius:8,
            padding:"10px 24px", fontSize:13, fontWeight:600,
            cursor:title.trim()?"pointer":"not-allowed",
          }}>
            {loading?"Analysing...":"Analyse →"}
          </button>
        </div>
      </div>

      {/* Examples */}
      <div style={{
        background:"var(--bg-card)", border:"1px solid var(--border)",
        borderRadius:12, padding:"20px 24px", marginBottom:24,
      }}>
        <div style={{
          fontSize:12, fontWeight:600, color:"var(--text-secondary)",
          textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12,
        }}>Try these examples</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {EXAMPLES.map((ex,i)=>(
            <button key={i}
              onClick={()=>{ setTitle(ex); setResult(null); }}
              style={{
                textAlign:"left", background:"var(--bg-secondary)",
                border:"1px solid var(--border)", borderRadius:8,
                padding:"10px 14px", color:"var(--text-secondary)",
                fontSize:13, cursor:"pointer", transition:"all .15s",
              }}
              onMouseEnter={e=>{
                e.target.style.borderColor="var(--accent-blue)";
                e.target.style.color="var(--text-primary)";
              }}
              onMouseLeave={e=>{
                e.target.style.borderColor="var(--border)";
                e.target.style.color="var(--text-secondary)";
              }}
            >{ex}</button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:12, padding:24,
          borderTop:`3px solid ${sc(result.sentiment_score)}`,
        }}>
          <div style={{
            fontSize:12, fontWeight:600, color:"var(--text-secondary)",
            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16,
          }}>Analysis Result</div>

          <div style={{
            fontSize:14, color:"var(--text-primary)", fontStyle:"italic",
            marginBottom:20, padding:"12px 16px",
            background:"var(--bg-secondary)", borderRadius:8,
            borderLeft:`3px solid ${sc(result.sentiment_score)}`,
          }}>
            "{result.title}"
          </div>

          {/* Score cards */}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(3,1fr)",
            gap:14, marginBottom:20,
          }}>
            {[
              ["Sentiment Score",
                `${result.sentiment_score>0?"+":""}${result.sentiment_score}`,
                sc(result.sentiment_score)],
              ["Label",
                result.sentiment_label?.toUpperCase(),
                sc(result.sentiment_score)],
              ["Verdict",
                result.interpretation,
                "#f59e0b"],
            ].map(([label,val,color])=>(
              <div key={label} style={{
                background:"var(--bg-secondary)",
                borderRadius:10, padding:16, textAlign:"center",
              }}>
                <div style={{
                  fontSize:10, color:"var(--text-muted)",
                  textTransform:"uppercase", letterSpacing:"0.08em",
                  marginBottom:8,
                }}>{label}</div>
                <div style={{
                  fontSize:label==="Verdict"?12:20,
                  fontWeight:700, color, lineHeight:1.3,
                  fontFamily:label!=="Verdict"
                    ?"'JetBrains Mono',monospace":"inherit",
                }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Breakdown bars */}
          <div style={{
            fontSize:12, fontWeight:600, color:"var(--text-secondary)",
            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12,
          }}>Signal Breakdown</div>
          {[
            ["Positive", result.breakdown?.positive, "#10b981"],
            ["Negative", result.breakdown?.negative, "#ef4444"],
            ["Neutral",  result.breakdown?.neutral,  "#6b7280"],
          ].map(([label,val,color])=>(
            <div key={label} style={{
              display:"grid",
              gridTemplateColumns:"90px 1fr 40px",
              alignItems:"center", gap:12, marginBottom:10,
            }}>
              <div style={{ fontSize:12, color:"var(--text-secondary)" }}>
                {label}
              </div>
              <div style={{
                height:8, background:"var(--border)",
                borderRadius:4, overflow:"hidden",
              }}>
                <div style={{
                  width:`${Math.round(val*100)}%`,
                  height:"100%", background:color,
                  borderRadius:4, transition:"width .5s",
                }}/>
              </div>
              <div style={{
                fontSize:12, fontWeight:600, color,
                fontFamily:"'JetBrains Mono',monospace",
                textAlign:"right",
              }}>{Math.round(val*100)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}