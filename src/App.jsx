import { useState, useRef, useEffect, useCallback } from "react";

const MODES = [
  { id: "cyan",    label: "CYAN"   },
  { id: "fire",    label: "PLASMA" },
  { id: "matrix",  label: "MATRIX" },
  { id: "rainbow", label: "AURORA" },
  { id: "ghost",   label: "GHOST"  },
  { id: "gold",    label: "GOLD"   },
];

function getColor(mode, brightness, phase, baseX, cw, t) {
  const tv = (Math.sin(phase) + 1) / 2;
  const b = brightness;
  switch (mode) {
    case "cyan":
      return `rgba(0,${Math.floor((200+b*55)*(0.6+tv*0.4))},${Math.floor((230+b*25)*(0.6+tv*0.4))},${0.7+tv*0.3})`;
    case "fire":
      return `rgba(${Math.floor(180+b*75)},${Math.floor(b*180*tv)},${Math.floor(20*tv)},${0.8+tv*0.2})`;
    case "matrix": {
      const g = Math.floor(80+b*175);
      return `rgba(0,${g},${Math.floor(g*0.15)},${0.6+tv*0.4})`;
    }
    case "rainbow":
      return `hsla(${((baseX/cw)*280+t*30)%360},100%,${50+b*30}%,${0.7+tv*0.3})`;
    case "ghost": {
      const g = Math.floor(180+b*75);
      return `rgba(${g},${g},${Math.floor(g*1.1)},${0.3+tv*0.4})`;
    }
    case "gold":
      return `rgba(${Math.floor(220+b*35)},${Math.floor(160+b*90)},${Math.floor(10+b*20)},${0.7+tv*0.3})`;
    default:
      return "rgba(0,200,230,0.8)";
  }
}

const fmtTime = s =>
  !s || isNaN(s) ? "0:00" : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

export default function App() {
  const [loaded,  setLoaded]  = useState(false);
  const [running, setRunning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted,   setMuted]   = useState(false);
  const [mode,    setMode]    = useState("cyan");
  const [density, setDensity] = useState(4);
  const [pSize,   setPSize]   = useState(1.8);
  const [drift,   setDrift]   = useState(0.4);
  const [thresh,  setThresh]  = useState(30);
  const [glow,    setGlow]    = useState(0.8);
  const [fps,     setFps]     = useState(0);
  const [pCount,  setPCount]  = useState(0);
  const [prog,    setProg]    = useState(0);
  const [curTime, setCurTime] = useState("0:00");
  const [dur,     setDur]     = useState("—");
  const [res,     setRes]     = useState("—");
  const [fname,   setFname]   = useState("");
  const [logs,    setLogs]    = useState(["System ready.", "Click Choose File to load a video."]);

  const canvasRef = useRef(null);
  const offRef    = useRef(null);
  const vidRef    = useRef(null);
  const animRef   = useRef(null);
  const fpsFrames = useRef(0);
  const fpsLast   = useRef(0);
  const parts     = useRef([]);
  const live      = useRef({ mode:"cyan", density:4, pSize:1.8, drift:0.4, thresh:30, glow:0.8 });

  useEffect(() => {
    live.current = { mode, density:+density, pSize:+pSize, drift:+drift, thresh:+thresh, glow:+glow };
  }, [mode, density, pSize, drift, thresh, glow]);

  const log = useCallback(msg => setLogs(p => [...p.slice(-40), msg]), []);

  const loadFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) { log("Not a video file."); return; }
    const vid = vidRef.current;
    vid.src = URL.createObjectURL(file);
    vid.load();
    log("Loading: " + file.name);
    vid.onloadedmetadata = () => {
      const w = vid.videoWidth, h = vid.videoHeight;
      const cvs = canvasRef.current, off = offRef.current;
      const mw = Math.min(window.innerWidth < 900 ? window.innerWidth - 40 : 620, w);
      const ratio = h / w;
      cvs.width  = mw;
      cvs.height = Math.floor(mw * ratio);
      off.width  = mw;
      off.height = cvs.height;
      setRes(w + " x " + h);
      setDur(fmtTime(vid.duration));
      setLoaded(true);
      setFname(file.name.length > 28 ? file.name.slice(0,26)+"..." : file.name);
      log("Loaded OK");
    };
    vid.onerror = () => log("Could not load video.");
  }, [log]);

  const renderLoop = useCallback((time = 0) => {
    const cvs = canvasRef.current, off = offRef.current, vid = vidRef.current;
    if (!cvs || !off || !vid) return;
    const ctx  = cvs.getContext("2d");
    const octx = off.getContext("2d", { willReadFrequently: true });
    const { mode:m, density:d, pSize:ps, drift:dr, thresh:thr, glow:gl } = live.current;
    const t = time * 0.001;

    fpsFrames.current++;
    if (time - fpsLast.current >= 1000) {
      setFps(fpsFrames.current);
      fpsFrames.current = 0;
      fpsLast.current   = time;
    }

    if (vid.readyState >= 2) {
      octx.drawImage(vid, 0, 0, off.width, off.height);
      const id = octx.getImageData(0, 0, off.width, off.height).data;
      const np = [];
      for (let y = 0; y < off.height; y += d)
        for (let x = 0; x < off.width; x += d) {
          const i  = (y * off.width + x) * 4;
          const br = (id[i] + id[i+1] + id[i+2]) / 765;
          if (br * 255 > thr)
            np.push({ bx:x, by:y, br, ph:Math.random()*Math.PI*2, vx:0, vy:0 });
        }
      parts.current = np;
      setPCount(np.length);
      if (vid.duration) {
        setProg((vid.currentTime / vid.duration) * 100);
        setCurTime(fmtTime(vid.currentTime));
      }
    }

    ctx.fillStyle = "rgba(0,5,8,0.88)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    const sy = (t * 80) % cvs.height;
    const sg = ctx.createLinearGradient(0, sy-20, 0, sy+20);
    sg.addColorStop(0, "transparent");
    sg.addColorStop(0.5, "rgba(0,245,255," + (0.04*gl) + ")");
    sg.addColorStop(1, "transparent");
    ctx.fillStyle = sg;
    ctx.fillRect(0, sy-20, cvs.width, 40);

    parts.current.forEach(p => {
      p.ph += 0.05;
      p.vx += (Math.random()-0.5)*0.15*dr;
      p.vy += (Math.random()-0.5)*0.15*dr;
      p.vx *= 0.92; p.vy *= 0.92;
      const px = p.bx + p.vx*3 + Math.sin(p.ph)*dr*0.5;
      const py = p.by + p.vy*3 + Math.cos(p.ph*0.7)*dr*0.3;
      const sz = ps * (0.5 + p.br * 0.8);
      const c  = getColor(m, p.br, p.ph, p.bx, cvs.width, t);
      ctx.shadowBlur  = gl > 0 ? 8*gl*p.br : 0;
      ctx.shadowColor = c;
      ctx.fillStyle   = c;
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle   = "#000";
    for (let y = 0; y < cvs.height; y += 4) ctx.fillRect(0, y, cvs.width, 2);
    ctx.restore();

    animRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const start = () => {
    vidRef.current.play();
    setPlaying(true); setRunning(true);
    log("Hologram ON - " + mode.toUpperCase());
    animRef.current = requestAnimationFrame(renderLoop);
  };
  const stop = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    vidRef.current?.pause();
    setRunning(false); setPlaying(false); setFps(0); setPCount(0); parts.current = [];
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };
  const reset = () => {
    stop(); setLoaded(false); setFname(""); setRes("—"); setDur("—"); setProg(0); setCurTime("0:00");
    if (vidRef.current) vidRef.current.src = "";
    log("Reset.");
  };
  const togglePlay = () => {
    if (!running) return;
    if (playing) { vidRef.current.pause(); setPlaying(false); }
    else { vidRef.current.play(); setPlaying(true); }
  };
  const toggleMute = () => {
    if (!vidRef.current) return;
    vidRef.current.muted = !muted; setMuted(!muted);
  };
  const seek = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - r.left) / r.width;
    if (vidRef.current?.duration) vidRef.current.currentTime = p * vidRef.current.duration;
  };

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || running) return;
    let id;
    const ctx = cvs.getContext("2d");
    const tick = () => {
      if (running) return;
      const t = Date.now() * 0.001;
      ctx.fillStyle = "rgba(0,5,8,0.3)";
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      for (let i = 0; i < 60; i++) {
        const x = (Math.sin(i*0.618+t*0.3)*0.5+0.5)*cvs.width;
        const y = (Math.cos(i*0.382+t*0.2)*0.5+0.5)*cvs.height;
        const a = (Math.sin(t+i)*0.5+0.5)*0.2;
        ctx.fillStyle = "rgba(0,245,255," + a + ")";
        ctx.shadowBlur = 6; ctx.shadowColor = "#00f5ff";
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.shadowBlur = 0; id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running]);

  const C = "#00f5ff", T = "#00ffd5";
  const box = { background:"rgba(0,3,6,0.9)", border:"1px solid rgba(0,245,255,0.15)", borderRadius:6, padding:16 };
  const sec = { fontSize:8, letterSpacing:3, color:"rgba(0,245,255,0.4)", textTransform:"uppercase", fontFamily:"monospace", borderBottom:"1px solid rgba(0,245,255,0.1)", paddingBottom:6, marginBottom:12 };
  const bigBtn = (danger) => ({ width:"100%", padding:"13px 0", fontFamily:"monospace", fontWeight:700, fontSize:11, letterSpacing:3, textTransform:"uppercase", cursor:"pointer", borderRadius:3, border:"1px solid " + (danger?"#ff3366":C), background:danger?"rgba(255,51,102,0.1)":"rgba(0,245,255,0.08)", color:danger?"#ff3366":C });
  const smBtn = { flex:1, padding:"8px 0", background:"transparent", border:"1px solid rgba(0,245,255,0.18)", color:"rgba(0,245,255,0.55)", fontSize:14, cursor:"pointer", borderRadius:2 };

  return (
    <div style={{ background:"#000508", color:C, fontFamily:"monospace", minHeight:"100vh", padding:"14px 16px", boxSizing:"border-box" }}>
      <style>{`
        body { margin:0; background:#000508; }
        input[type=range] { accent-color:#00f5ff; width:100%; }
        input[type=file] { color:#00ffd5; background:rgba(0,255,213,0.05); border:1px solid rgba(0,245,255,0.35); padding:9px 10px; border-radius:3px; font-family:monospace; font-size:11px; cursor:pointer; width:100%; }
        input[type=file]::file-selector-button { background:rgba(0,245,255,0.12); border:1px solid rgba(0,245,255,0.4); color:#00f5ff; font-family:monospace; font-size:10px; padding:6px 14px; cursor:pointer; margin-right:10px; border-radius:2px; }
      `}</style>

      <video ref={vidRef} style={{display:"none"}} loop />
      <canvas ref={offRef} style={{display:"none"}} />

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, paddingBottom:12, borderBottom:"1px solid rgba(0,245,255,0.18)" }}>
        <span style={{ fontWeight:900, fontSize:22, letterSpacing:5 }}>HOLO<span style={{color:T}}>·</span>MATRIX</span>
        <div style={{display:"flex", gap:20}}>
          {[["PARTICLES", pCount.toLocaleString()],["FPS", fps],["STATUS", running?"ACTIVE":"STANDBY"]].map(([l,v])=>(
            <div key={l} style={{textAlign:"right"}}>
              <div style={{fontSize:7, color:"rgba(0,245,255,0.3)", letterSpacing:2}}>{l}</div>
              <div style={{fontSize:13, color:running?T:C}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"210px 1fr 180px", gap:12, alignItems:"start"}}>
        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          <div style={box}>
            <div style={sec}>① Load Video</div>
            <input type="file" accept="video/*" onChange={e => { if(e.target.files[0]) loadFile(e.target.files[0]); }} />
            {fname && <div style={{marginTop:8, fontSize:9, color:T}}>✓ {fname}</div>}
            <div style={{marginTop:6, fontSize:8, color:"rgba(0,245,255,0.25)"}}>MP4 · MOV · WEBM · AVI</div>
          </div>

          <div style={box}>
            <div style={sec}>② Parameters</div>
            {[
              {l:"Density", v:density, s:setDensity, min:2, max:10, step:1, f:v=>v},
              {l:"Size", v:pSize, s:setPSize, min:1, max:5, step:0.1, f:v=>(+v).toFixed(1)},
              {l:"Drift", v:drift, s:setDrift, min:0, max:2, step:0.1, f:v=>(+v).toFixed(1)},
              {l:"Threshold", v:thresh, s:setThresh, min:5, max:100, step:1, f:v=>v},
              {l:"Glow", v:glow, s:setGlow, min:0, max:2, step:0.1, f:v=>(+v).toFixed(1)},
            ].map(({l,v,s,min,max,step,f})=>(
              <div key={l} style={{marginBottom:11}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
                  <span style={{fontSize:8, color:"rgba(0,245,255,0.5)", textTransform:"uppercase"}}>{l}</span>
                  <span style={{fontSize:11, color:T}}>{f(v)}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={v} onChange={e=>s(e.target.value)} />
              </div>
            ))}
          </div>

          <div style={box}>
            <div style={sec}>③ Mode</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:5}}>
              {[{id:"cyan",label:"CYAN"},{id:"fire",label:"PLASMA"},{id:"matrix",label:"MATRIX"},{id:"rainbow",label:"AURORA"},{id:"ghost",label:"GHOST"},{id:"gold",label:"GOLD"}].map(m=>(
                <button key={m.id} onClick={()=>setMode(m.id)}
                  style={{ padding:"8px 0", fontFamily:"monospace", fontSize:9, cursor:"pointer", textTransform:"uppercase", borderRadius:2,
                    border:"1px solid " + (mode===m.id?T:"rgba(0,245,255,0.2)"),
                    background:mode===m.id?"rgba(0,255,213,0.08)":"transparent",
                    color:mode===m.id?T:"rgba(0,245,255,0.45)"}}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={box}>
            <div style={sec}>④ Activate</div>
            <button style={{...bigBtn(running), opacity:loaded?1:0.3, cursor:loaded?"pointer":"not-allowed"}} disabled={!loaded} onClick={running?stop:start}>
              {running ? "■ STOP" : "▶ START HOLOGRAM"}
            </button>
            <button onClick={reset} style={{marginTop:8, width:"100%", padding:"8px 0", background:"transparent", border:"1px solid rgba(0,245,255,0.15)", color:"rgba(0,245,255,0.35)", fontFamily:"monospace", fontSize:9, cursor:"pointer", borderRadius:2, textTransform:"uppercase"}}>
              RESET
            </button>
          </div>
        </div>

        <div style={{display:"flex", alignItems:"center", justifyContent:"center"}}>
          <div style={{position:"relative", display:"inline-block"}}>
            {[{top:-1,left:-1,borderTop:"2px solid #00f5ff",borderLeft:"2px solid #00f5ff"},
              {top:-1,right:-1,borderTop:"2px solid #00f5ff",borderRight:"2px solid #00f5ff"},
              {bottom:-1,left:-1,borderBottom:"2px solid #00f5ff",borderLeft:"2px solid #00f5ff"},
              {bottom:-1,right:-1,borderBottom:"2px solid #00f5ff",borderRight:"2px solid #00f5ff"}].map((s,i)=>(
              <div key={i} style={{position:"absolute", width:18, height:18, zIndex:2, ...s}} />
            ))}
            <canvas ref={canvasRef} width={620} height={349} style={{display:"block", background:"#000", maxWidth:"100%"}} />
            {!loaded && (
              <div style={{position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, pointerEvents:"none"}}>
                <div style={{fontSize:48, opacity:0.1}}>⬡</div>
                <div style={{fontSize:10, letterSpacing:4, color:"rgba(0,245,255,0.12)", textTransform:"uppercase"}}>No Signal</div>
              </div>
            )}
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          <div style={box}>
            <div style={sec}>Info</div>
            {[["File",fname||"—"],["Res",res],["Dur",dur],["Time",curTime]].map(([l,v])=>(
              <div key={l} style={{padding:"5px 8px", borderLeft:"2px solid rgba(0,245,255,0.12)", marginBottom:7}}>
                <div style={{fontSize:7, color:"rgba(0,245,255,0.28)", textTransform:"uppercase"}}>{l}</div>
                <div style={{fontSize:11, color:T, wordBreak:"break-all"}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={box}>
            <div style={sec}>Transport</div>
            <div style={{display:"flex", gap:5, marginBottom:9}}>
              <button style={smBtn} onClick={()=>{ if(vidRef.current) vidRef.current.currentTime=0; }}>⏮</button>
              <button style={smBtn} onClick={togglePlay}>{playing?"⏸":"▶"}</button>
              <button style={smBtn} onClick={toggleMute}>{muted?"🔇":"🔊"}</button>
            </div>
            <div style={{height:4, background:"rgba(0,245,255,0.1)", borderRadius:2, cursor:"pointer"}} onClick={seek}>
              <div style={{height:"100%", width:prog+"%", background:"linear-gradient(90deg,#00f5ff,#00ffd5)", borderRadius:2, transition:"width 0.1s"}} />
            </div>
          </div>
          <div style={{...box, flex:1}}>
            <div style={sec}>Log</div>
            <div style={{overflowY:"auto", maxHeight:180, display:"flex", flexDirection:"column", gap:3}}>
              {logs.map((l,i)=>(
                <div key={i} style={{fontSize:9, lineHeight:1.6, color:"rgba(0,245,255,0.5)"}}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  }
