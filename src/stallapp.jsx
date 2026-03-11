import React, { useState, useEffect } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

// ── Seed Data ──────────────────────────────────────────────────────────────
const INITIAL_MEMBERS = [
  { id:1, name:"Anna Müller",    horse:"Estrella", type:"admin",           pin:"1234", paid:true,  phone:"0171-111111", einstellerId:null },
  { id:2, name:"Ben Schneider",  horse:"Thunder",  type:"einsteller",      pin:"2222", paid:false, phone:"0172-222222", einstellerId:null },
  { id:3, name:"Clara Hoffmann", horse:"Bella",    type:"einsteller",      pin:"3333", paid:true,  phone:"0173-333333", einstellerId:null },
  { id:4, name:"David Koch",     horse:"Thunder",  type:"reitbeteiligung", pin:"4444", paid:null,  phone:"0174-444444", einstellerId:2 },
  { id:5, name:"Eva Braun",      horse:"Bella",    type:"reitbeteiligung", pin:"5555", paid:null,  phone:"0175-555555", einstellerId:3 },
  { id:6, name:"Felix Sommer",   horse:"Bella",    type:"reitbeteiligung", pin:"6666", paid:null,  phone:"0176-666666", einstellerId:3 },
];

const today = new Date();
const INITIAL_EVENTS = [
  { id:1, type:"Tierarzt",   date:new Date(today.getFullYear(),today.getMonth(),today.getDate()+3).toISOString().slice(0,10),  time:"10:00", note:"Jährliche Gesundheitskontrolle", color:"#c0392b" },
  { id:2, type:"Hufschmied", date:new Date(today.getFullYear(),today.getMonth(),today.getDate()+7).toISOString().slice(0,10),  time:"09:00", note:"Alle Pferde",                    color:"#8B6914" },
  { id:3, type:"Impfen",     date:new Date(today.getFullYear(),today.getMonth(),today.getDate()+14).toISOString().slice(0,10), time:"14:00", note:"Influenza + Herpes",             color:"#27ae60" },
];
const EVENT_TYPES  = ["Tierarzt","Hufschmied","Impfen","Sonstiges"];
const EVENT_COLORS = { Tierarzt:"#c0392b", Hufschmied:"#8B6914", Impfen:"#27ae60", Sonstiges:"#7f8c8d" };

// ── Date helpers ───────────────────────────────────────────────────────────
const getWeekDates = (offset=0) => {
  const now=new Date(); const day=now.getDay()||7;
  const mon=new Date(now); mon.setDate(now.getDate()-day+1+offset*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
};
const dk    = d => d.toISOString().slice(0,10);
const fmt   = d => d.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"});
const fmtD  = d => d.toLocaleDateString("de-DE",{day:"2-digit",month:"long",year:"numeric"});
const fmtSh = d => d.toLocaleDateString("de-DE",{day:"2-digit",month:"short"});

// Get all Mondays in a month
const getWeeksInMonth = (year, month) => {
  const weeks = [];
  const d = new Date(year, month, 1);
  while(d.getMonth()===month){
    const day=d.getDay()||7;
    const mon=new Date(d); mon.setDate(d.getDate()-day+1);
    const monKey=dk(mon);
    if(!weeks.find(w=>w===monKey)) weeks.push(monKey);
    d.setDate(d.getDate()+7);
  }
  return weeks;
};

// ── Quota helpers ──────────────────────────────────────────────────────────
// Base: 2× per week per "Pferd-Gruppe", split evenly
const getBaseGroupQuota = (einsteller, allMembers) => {
  const beteiligungen = allMembers.filter(m=>m.einstellerId===einsteller.id);
  const groupSize = 1 + beteiligungen.length;
  return Math.max(1, Math.round(2/groupSize));
};

// Get effective weekly quota for a member in a specific week,
// considering vacation: if a member is on vacation that week, their quota = 0
// and their missed slots are redistributed to remaining group members (carried to later weeks)
const getMemberWeekQuota = (member, weekMon, allMembers, vacations) => {
  const weekEnd = new Date(weekMon); weekEnd.setDate(new Date(weekMon).getDate()+6);
  const weekEndKey = dk(weekEnd);
  const isOnVacation = (vacations[member.id]||[]).some(v => v.from <= weekEndKey && v.to >= weekMon);
  if(isOnVacation) return 0;

  // Find group root (einsteller)
  const root = member.type==="reitbeteiligung"
    ? allMembers.find(m=>m.id===member.einstellerId)
    : member;
  if(!root) return getBaseGroupQuota(member, allMembers);

  const baseQuota = getBaseGroupQuota(root, allMembers);
  return baseQuota;
};

// Count mist for a member across an entire month, excluding vacation weeks
const countMistMonth = (mistData, memberId, year, month) => {
  const weeks = getWeeksInMonth(year, month);
  let count=0;
  weeks.forEach(monKey=>{
    getWeekDates(0).forEach(()=>{}); // just iterate
    for(let i=0;i<7;i++){
      const d=new Date(monKey); d.setDate(d.getDate()+i);
      if(d.getMonth()===month) count += ((mistData[dk(d)]||[]).includes(memberId)?1:0);
    }
  });
  return count;
};

// Required mist for a member this month (accounting for vacation weeks)
const getMonthlyQuota = (member, allMembers, vacations, year, month) => {
  const weeks = getWeeksInMonth(year, month);
  let total = 0;
  weeks.forEach(monKey => {
    total += getMemberWeekQuota(member, monKey, allMembers, vacations);
  });
  return total;
};

// Check if a day is in a vacation period for a member
const isOnVacationDay = (memberId, dayKey, vacations) => {
  return (vacations[memberId]||[]).some(v => v.from <= dayKey && v.to >= dayKey);
};

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  root:      { fontFamily:"'DM Sans',sans-serif", background:"#f5f0e8", minHeight:"100vh", color:"#2c2416", maxWidth:430, margin:"0 auto", paddingBottom:90 },
  header:    { background:"linear-gradient(160deg,#3d2b1f 0%,#6b4c2a 100%)", padding:"20px 20px 14px", position:"sticky", top:0, zIndex:100 },
  hTitle:    { fontFamily:"'Playfair Display',serif", fontSize:20, color:"#f5e6c8", margin:0 },
  hSub:      { color:"#b89060", fontSize:11, marginTop:2, fontWeight:300 },
  nav:       { display:"flex", overflowX:"auto", background:"#2c1e0f" },
  navBtn:    a=>({ flex:"0 0 auto", padding:"10px 13px", fontSize:11, fontWeight:500, border:"none", cursor:"pointer", background:a?"#c8913a":"transparent", color:a?"#fff":"#a07848", borderBottom:a?"3px solid #f5c842":"3px solid transparent", whiteSpace:"nowrap" }),
  card:      { background:"#fff", borderRadius:14, margin:"14px 16px 0", padding:"16px", boxShadow:"0 2px 12px rgba(0,0,0,.07)" },
  cTitle:    { fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, marginBottom:12, color:"#3d2b1f" },
  btn:       v=>({ padding:"10px 18px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13, background:v==="primary"?"#c8913a":v==="danger"?"#c0392b":v==="green"?"#27ae60":v==="teal"?"#16a085":"#f0e6d3", color:v==="light"?"#3d2b1f":"#fff" }),
  input:     { width:"100%", padding:"10px 12px", borderRadius:9, border:"1.5px solid #e2d5c0", background:"#faf6f0", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#2c2416", boxSizing:"border-box", marginBottom:8 },
  label:     { fontSize:11, fontWeight:600, color:"#8b6040", marginBottom:3, display:"block" },
  row:       { display:"flex", gap:8, alignItems:"center" },
  divider:   { height:1, background:"#ede5d5", margin:"10px 0" },
  modal:     { position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:300, display:"flex", alignItems:"flex-end" },
  mBox:      { background:"#fff", width:"100%", maxWidth:430, margin:"0 auto", borderRadius:"18px 18px 0 0", padding:24, boxSizing:"border-box", maxHeight:"90vh", overflowY:"auto" },
  bNav:      { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"#fff", borderTop:"1.5px solid #ede5d5", display:"flex", zIndex:200 },
  bBtn:      a=>({ flex:1, padding:"10px 0 8px", border:"none", background:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:a?"#c8913a":"#a09080" }),
  ava:       bg=>({ width:38, height:38, borderRadius:"50%", background:bg||"linear-gradient(135deg,#c8913a,#8b6040)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:15, flexShrink:0 }),
};

// ── Icons ──────────────────────────────────────────────────────────────────
const Ic = ({ n, s=20 }) => {
  const p = { width:s, height:s, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" };
  const map = {
    cal:    <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    mist:   <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="7" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="18" r="1.5" fill="currentColor"/></svg>,
    users:  <svg {...p}><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4"/><circle cx="17" cy="17" r="4"/></svg>,
    money:  <svg {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>,
    home:   <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    plus:   <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    check:  <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>,
    x:      <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    warn:   <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    lock:   <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    logout: <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    shield: <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    palm:   <svg {...p}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    trash:  <svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  };
  return map[n]||null;
};

// ══════════════════════════════════════════════════════════════════════════
export default function StallApp() {
  const [members,    setMembers]    = useState(INITIAL_MEMBERS);
  const [events,     setEvents]     = useState(INITIAL_EVENTS);
  const [mistData,   setMistData]   = useState({});
  // vacations: { [memberId]: [{id, from, to, note}] }
  const [vacations,  setVacations]  = useState({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab,        setTab]        = useState("home");
  const [currentUser,setCurrentUser]= useState(null);
  const [loginStep,  setLoginStep]  = useState("select");
  const [selName,    setSelName]    = useState("");
  const [pinInput,   setPinInput]   = useState("");
  const [pinError,   setPinError]   = useState(false);
  // modals
  const [showAddEvent,   setShowAddEvent]   = useState(false);
  const [showAddMember,  setShowAddMember]  = useState(false);
  const [showAddVacation,setShowAddVacation]= useState(false);
  const [vacTargetId,    setVacTargetId]    = useState(null); // member id for vacation
  const [newEvent,   setNewEvent]   = useState({type:"Tierarzt",date:"",time:"",note:""});
  const [newMember,  setNewMember]  = useState({name:"",horse:"",type:"einsteller",pin:"",phone:"",einstellerId:""});
  const [newVac,     setNewVac]     = useState({from:"",to:"",note:""});
  // toast
  const [toast,      setToast]      = useState(null);

  const weekDates = getWeekDates(weekOffset);
  const isAdmin   = currentUser?.type==="admin";

  const showToast = (msg, color="#c8913a") => {
    setToast({msg,color});
    setTimeout(()=>setToast(null),2800);
  };

  useEffect(()=>{
    setMistData(prev=>{
      const next={...prev};
      getWeekDates(weekOffset).forEach(d=>{ const k=dk(d); if(!next[k]) next[k]=[]; });
      return next;
    });
  },[weekOffset]);

  // ── Login ────────────────────────────────────────────────────────────────
  const handlePinDigit = k => {
    if(k==="⌫"){ setPinInput(p=>p.slice(0,-1)); setPinError(false); return; }
    if(k===""||pinInput.length>=4) return;
    const np=pinInput+k; setPinInput(np);
    if(np.length===4){
      const mem=members.find(m=>m.name===selName);
      if(mem?.pin===np){ setCurrentUser(mem); setPinError(false); setPinInput(""); }
      else { setPinError(true); setTimeout(()=>setPinInput(""),500); }
    }
  };
  const handleLogout = () => { setCurrentUser(null); setLoginStep("select"); setSelName(""); setPinInput(""); setTab("home"); };

  // ── Mist toggle (with double-booking guard) ───────────────────────────────
  const toggleMist = (dayKey, memberId) => {
    if(!currentUser) return;
    if(!isAdmin && currentUser.id!==memberId) return;

    const daySlots = mistData[dayKey]||[];
    const alreadyChecked = daySlots.includes(memberId);

    if(!alreadyChecked){
      // Check: is this day already taken by ANYONE in the stall?
      const alreadyBooked = daySlots.length > 0;

      if(alreadyBooked){
        showToast("⚠️ Dieser Tag ist bereits vergeben – wer zuerst kommt, mahlt zuerst!", "#c0392b");
        return;
      }

      // Check: is member on vacation this day?
      if(isOnVacationDay(memberId, dayKey, vacations)){
        showToast("🌴 Urlaub eingetragen – kein Misten möglich.", "#16a085");
        return;
      }
    }

    setMistData(prev=>{
      const day=prev[dayKey]||[];
      return { ...prev, [dayKey]: day.includes(memberId)?day.filter(x=>x!==memberId):[...day,memberId] };
    });
  };

  // ── Vacations ─────────────────────────────────────────────────────────────
  const openAddVacation = (memberId) => { setVacTargetId(memberId); setNewVac({from:"",to:"",note:""}); setShowAddVacation(true); };
  const addVacation = () => {
    if(!newVac.from||!newVac.to||newVac.from>newVac.to) { showToast("Bitte gültiges Datum wählen","#c0392b"); return; }
    setVacations(prev=>{
      const existing=prev[vacTargetId]||[];
      return { ...prev, [vacTargetId]: [...existing, {id:Date.now(), from:newVac.from, to:newVac.to, note:newVac.note}] };
    });
    setShowAddVacation(false);
    showToast("🌴 Urlaub eingetragen!");
  };
  const deleteVacation = (memberId, vacId) => {
    setVacations(prev=>({ ...prev, [memberId]:(prev[memberId]||[]).filter(v=>v.id!==vacId) }));
  };

  // ── Events ────────────────────────────────────────────────────────────────
  const addEvent = () => {
    if(!newEvent.date) return;
    setEvents(p=>[...p,{...newEvent,id:Date.now(),color:EVENT_COLORS[newEvent.type]||"#7f8c8d"}]);
    setNewEvent({type:"Tierarzt",date:"",time:"",note:""}); setShowAddEvent(false);
  };

  // ── Members ───────────────────────────────────────────────────────────────
  const addMember = () => {
    if(!newMember.name||!newMember.pin) return;
    setMembers(p=>[...p,{...newMember,id:Date.now(),paid:newMember.type==="reitbeteiligung"?null:false,einstellerId:newMember.einstellerId?parseInt(newMember.einstellerId):null}]);
    setNewMember({name:"",horse:"",type:"einsteller",pin:"",phone:"",einstellerId:""}); setShowAddMember(false);
  };
  const deleteMember = id => setMembers(p=>p.filter(m=>m.id!==id));
  const togglePaid   = id => setMembers(p=>p.map(m=>m.id===id?{...m,paid:!m.paid}:m));
  const deleteEvent  = id => setEvents(p=>p.filter(e=>e.id!==id));

  // ── Derived ───────────────────────────────────────────────────────────────
  const einstellerList = members.filter(m=>m.type==="einsteller"||m.type==="admin");
  const upcomingEvents = [...events].sort((a,b)=>a.date.localeCompare(b.date)).filter(e=>e.date>=dk(today)).slice(0,5);
  const unpaid         = members.filter(m=>m.type!=="reitbeteiligung"&&!m.paid);

  // Monthly quota summary for current month
  const curYear=today.getFullYear(); const curMonth=today.getMonth();
  const mistWarnings = einstellerList.filter(m=>{
    const monthQ = getMonthlyQuota(m, members, vacations, curYear, curMonth);
    const monthC = countMistMonth(mistData, m.id, curYear, curMonth);
    return monthC < monthQ;
  });

  // ── Vacation label ────────────────────────────────────────────────────────
  const getVacationLabel = (memberId) => {
    const vacs = (vacations[memberId]||[]);
    const now = dk(today);
    const active = vacs.find(v=>v.from<=now&&v.to>=now);
    if(active) return `🌴 Urlaub bis ${fmtSh(new Date(active.to+"T00:00:00"))}`;
    const upcoming = vacs.filter(v=>v.from>now).sort((a,b)=>a.from.localeCompare(b.from))[0];
    if(upcoming) return `🌴 Urlaub ab ${fmtSh(new Date(upcoming.from+"T00:00:00"))}`;
    return null;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════════════════
  if(!currentUser) return (
    <div style={{...S.root,display:"flex",flexDirection:"column"}}>
      <div style={{background:"linear-gradient(160deg,#3d2b1f,#7a5230)",padding:"50px 24px 36px",textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:10}}>🐴</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:"#f5e6c8"}}>Stallbuch</div>
        <div style={{color:"#b89060",fontSize:12,marginTop:4}}>Stallgemeinschaft · Anmelden</div>
      </div>
      <div style={{padding:"28px 20px"}}>
        {loginStep==="select"?(
          <>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"#3d2b1f",marginBottom:14}}>Wer bist du?</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {members.map(m=>(
                <button key={m.id} onClick={()=>{setSelName(m.name);setLoginStep("pin");setPinError(false);}}
                  style={{...S.btn("light"),textAlign:"left",padding:"14px 16px",borderRadius:12,display:"flex",alignItems:"center",gap:12,fontSize:14}}>
                  <div style={S.ava(m.type==="admin"?"linear-gradient(135deg,#c8913a,#f5c842)":undefined)}>{m.name.charAt(0)}</div>
                  <div>
                    <div style={{fontWeight:600}}>{m.name}</div>
                    <div style={{fontSize:11,color:"#8b6040",fontWeight:400}}>
                      {m.type==="admin"?"👑 Admin":m.type==="einsteller"?"🐴 Einsteller":"🤝 Reitbeteiligung"}
                      {m.horse?` · ${m.horse}`:""}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ):(
          <>
            <button onClick={()=>{setLoginStep("select");setPinError(false);setPinInput("");}} style={{...S.btn("light"),padding:"6px 14px",fontSize:12,marginBottom:18}}>← Zurück</button>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#3d2b1f",marginBottom:2}}>Hallo, {selName.split(" ")[0]}!</div>
            <div style={{fontSize:12,color:"#8b6040",marginBottom:24}}>Bitte gib deinen PIN ein.</div>
            <div style={{display:"flex",gap:14,justifyContent:"center",marginBottom:28}}>
              {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",background:pinInput.length>i?"#c8913a":"#e2d5c0",transition:"background .15s"}}/>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:240,margin:"0 auto"}}>
              {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
                <button key={i} onClick={()=>handlePinDigit(k)}
                  style={{height:58,borderRadius:12,border:"none",background:k===""?"transparent":"#fff",cursor:k===""?"default":"pointer",fontSize:k==="⌫"?18:22,fontWeight:500,color:"#3d2b1f",boxShadow:k===""?"none":"0 2px 8px rgba(0,0,0,.08)"}}>
                  {k}
                </button>
              ))}
            </div>
            {pinError&&<div style={{color:"#c0392b",textAlign:"center",fontSize:12,marginTop:16,fontWeight:600}}>❌ Falscher PIN – bitte nochmal</div>}
          </>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // HOME
  // ══════════════════════════════════════════════════════════════════════════
  const HomeScreen = () => {
    const isEinsteller = currentUser.type==="einsteller"||(currentUser.type==="admin"&&currentUser.horse);
    const monthQ = isEinsteller ? getMonthlyQuota(currentUser,members,vacations,curYear,curMonth) : 0;
    const monthC = isEinsteller ? countMistMonth(mistData,currentUser.id,curYear,curMonth) : 0;
    const myVacLabel = getVacationLabel(currentUser.id);
    return (
      <div>
        <div style={{background:"linear-gradient(135deg,#3d2b1f,#7a5230)",margin:"14px 16px 0",borderRadius:16,padding:"20px 18px",color:"#f5e6c8",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:-10,top:-10,opacity:.1,fontSize:90}}>🐴</div>
          <div style={{fontSize:11,color:"#c8913a",marginBottom:2}}>{fmtD(today)}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:21,lineHeight:1.2}}>Hallo, {currentUser.name.split(" ")[0]}!</div>
          <div style={{fontSize:11,color:"#d4b88a",marginTop:6}}>
            {currentUser.type==="admin"?"👑 Admin":currentUser.type==="einsteller"?"🐴 Einsteller":"🤝 Reitbeteiligung"}
            {currentUser.horse?` · ${currentUser.horse}`:""}
          </div>
          {myVacLabel&&<div style={{marginTop:8,background:"rgba(22,160,133,.25)",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#a8e6cf"}}>{myVacLabel}</div>}
        </div>

        {isAdmin&&mistWarnings.length>0&&(
          <div style={{...S.card,background:"#fff8ec",border:"1.5px solid #f5c842"}}>
            <div style={S.row}><Ic n="warn"/><div>
              <div style={{fontSize:12,fontWeight:700,color:"#8B6914"}}>⚠️ Mist-Erinnerung (dieser Monat)</div>
              <div style={{fontSize:11,color:"#6b4c2a",marginTop:2}}>{mistWarnings.map(m=>m.name).join(", ")} — Monatspflicht noch nicht erfüllt</div>
            </div></div>
          </div>
        )}

        {isAdmin&&unpaid.length>0&&(
          <div style={{...S.card,background:"#fff5f5",border:"1.5px solid #f5c0c0"}}>
            <div style={S.row}><span style={{color:"#c0392b"}}><Ic n="warn"/></span><div>
              <div style={{fontSize:12,fontWeight:700,color:"#922b21"}}>💰 Offene Zahlungen</div>
              <div style={{fontSize:11,color:"#7b241c",marginTop:2}}>{unpaid.map(m=>m.name).join(", ")} — Stallgebühr ausstehend</div>
            </div></div>
          </div>
        )}

        {isEinsteller&&(
          <div style={S.card}>
            <div style={S.cTitle}>Mein Mistdienst</div>
            <div style={{...S.row,justifyContent:"space-between",marginBottom:8}}>
              <div>
                <div style={{fontSize:13}}>Dieser Monat: <b style={{color:monthC>=monthQ?"#27ae60":"#c0392b"}}>{monthC}/{monthQ}×</b></div>
                <div style={{fontSize:11,color:"#aaa",marginTop:2}}>
                  {(vacations[currentUser.id]||[]).length>0
                    ? "Urlaubswochen werden nicht gezählt"
                    : `Aufgeteilt mit ${members.filter(m=>m.einstellerId===currentUser.id).length} Reitbet.`}
                </div>
              </div>
              {monthC>=monthQ
                ? <span style={{color:"#27ae60",fontWeight:700,fontSize:12}}>✓ Erledigt!</span>
                : <span style={{color:"#c0392b",fontWeight:700,fontSize:12}}>Noch offen</span>}
            </div>
            <button style={{...S.btn("teal"),padding:"8px 14px",fontSize:11,marginTop:4}} onClick={()=>{ setVacTargetId(currentUser.id); setNewVac({from:"",to:"",note:""}); setShowAddVacation(true); }}>
              🌴 Urlaub eintragen
            </button>
          </div>
        )}

        <div style={S.card}>
          <div style={S.cTitle}>Nächste Termine</div>
          {upcomingEvents.length===0&&<div style={{fontSize:12,color:"#aaa"}}>Keine Termine geplant</div>}
          {upcomingEvents.map(e=>(
            <div key={e.id} style={{...S.row,marginBottom:10}}>
              <div style={{width:4,height:36,borderRadius:4,background:e.color,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{e.type}</div>
                <div style={{fontSize:11,color:"#8b6040"}}>{fmtSh(new Date(e.date+"T00:00:00"))}{e.time?` · ${e.time} Uhr`:""}{e.note?` · ${e.note}`:""}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Vacation modal */}
        {showAddVacation&&(
          <div style={S.modal}><div style={S.mBox}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:4,color:"#3d2b1f"}}>🌴 Urlaub eintragen</div>
            <div style={{fontSize:11,color:"#8b6040",marginBottom:16}}>
              {members.find(m=>m.id===vacTargetId)?.name} — Pflicht wird in verbleibenden Wochen nachgeholt
            </div>
            <label style={S.label}>Von</label>
            <input type="date" style={S.input} value={newVac.from} onChange={e=>setNewVac(p=>({...p,from:e.target.value}))}/>
            <label style={S.label}>Bis</label>
            <input type="date" style={S.input} value={newVac.to} onChange={e=>setNewVac(p=>({...p,to:e.target.value}))}/>
            <label style={S.label}>Notiz (optional)</label>
            <input style={S.input} placeholder="z.B. Sommerurlaub" value={newVac.note} onChange={e=>setNewVac(p=>({...p,note:e.target.value}))}/>
            <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
              <button style={S.btn("light")} onClick={()=>setShowAddVacation(false)}>Abbrechen</button>
              <button style={S.btn("teal")} onClick={addVacation}>Eintragen</button>
            </div>
          </div></div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CALENDAR
  // ══════════════════════════════════════════════════════════════════════════
  const CalendarScreen = () => (
    <div>
      <div style={S.card}>
        <div style={{...S.row,justifyContent:"space-between",marginBottom:14}}>
          <div style={S.cTitle}>Termine</div>
          {isAdmin&&<button style={{...S.btn("primary"),padding:"8px 12px"}} onClick={()=>setShowAddEvent(true)}><Ic n="plus" s={16}/></button>}
        </div>
        {!isAdmin&&<div style={{background:"#f5f0e8",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#8b6040",marginBottom:12}}>📅 Termine werden vom Admin verwaltet</div>}
        {[...events].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>(
          <div key={e.id} style={{display:"flex",gap:10,marginBottom:12,alignItems:"flex-start"}}>
            <div style={{width:5,borderRadius:4,background:e.color,alignSelf:"stretch",flexShrink:0,minHeight:40}}/>
            <div style={{flex:1}}>
              <div style={{...S.row,justifyContent:"space-between"}}>
                <span style={{fontWeight:600,fontSize:14}}>{e.type}</span>
                <span style={{fontSize:10,color:"#8b6040"}}>{new Date(e.date+"T00:00:00").toLocaleDateString("de-DE",{day:"2-digit",month:"short",year:"numeric"})}</span>
              </div>
              {e.time&&<div style={{fontSize:11,color:"#8b6040",marginTop:2}}>🕐 {e.time} Uhr</div>}
              {e.note&&<div style={{fontSize:11,color:"#666",marginTop:2}}>{e.note}</div>}
            </div>
            {isAdmin&&<button onClick={()=>deleteEvent(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",padding:4}}><Ic n="x" s={14}/></button>}
          </div>
        ))}
      </div>
      {showAddEvent&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:16,color:"#3d2b1f"}}>Neuer Termin</div>
          <label style={S.label}>Typ</label>
          <select style={S.input} value={newEvent.type} onChange={e=>setNewEvent(p=>({...p,type:e.target.value}))}>
            {EVENT_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <label style={S.label}>Datum</label>
          <input type="date" style={S.input} value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))}/>
          <label style={S.label}>Uhrzeit</label>
          <input type="time" style={S.input} value={newEvent.time} onChange={e=>setNewEvent(p=>({...p,time:e.target.value}))}/>
          <label style={S.label}>Notiz</label>
          <input style={S.input} placeholder="z.B. Alle Pferde" value={newEvent.note} onChange={e=>setNewEvent(p=>({...p,note:e.target.value}))}/>
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btn("light")} onClick={()=>setShowAddEvent(false)}>Abbrechen</button>
            <button style={S.btn("primary")} onClick={addEvent}>Speichern</button>
          </div>
        </div></div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // MIST
  // ══════════════════════════════════════════════════════════════════════════
  const MistScreen = () => {
    const rows = [];
    einstellerList.forEach(e=>{
      rows.push({member:e,isChild:false});
      members.filter(m=>m.einstellerId===e.id).forEach(rb=>rows.push({member:rb,isChild:true}));
    });

    return (
      <div>
        {/* Vacation management card */}
        <div style={S.card}>
          <div style={{...S.row,justifyContent:"space-between",marginBottom:10}}>
            <div style={S.cTitle}>🌴 Urlaube</div>
            <button style={{...S.btn("teal"),padding:"7px 12px",fontSize:11}} onClick={()=>openAddVacation(currentUser.id)}>
              + Eigenen eintragen
            </button>
          </div>
          {[...einstellerList,...members.filter(m=>m.type==="reitbeteiligung")].map(m=>{
            const vacs=vacations[m.id]||[];
            const canEdit=isAdmin||currentUser.id===m.id;
            if(vacs.length===0&&!canEdit) return null;
            return (
              <div key={m.id}>
                {vacs.length>0&&vacs.map(v=>(
                  <div key={v.id} style={{...S.row,justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5f0e8"}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:600}}>{m.name.split(" ")[0]}</span>
                      <span style={{fontSize:11,color:"#8b6040"}}> · {fmtSh(new Date(v.from+"T00:00:00"))} – {fmtSh(new Date(v.to+"T00:00:00"))}</span>
                      {v.note&&<span style={{fontSize:10,color:"#aaa"}}> · {v.note}</span>}
                    </div>
                    {canEdit&&<button onClick={()=>deleteVacation(m.id,v.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",padding:4}}><Ic n="trash" s={13}/></button>}
                  </div>
                ))}
              </div>
            );
          })}
          {isAdmin&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:11,color:"#aaa",marginBottom:6}}>Urlaub für andere eintragen:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {[...einstellerList,...members.filter(m=>m.type==="reitbeteiligung")].filter(m=>m.id!==currentUser.id).map(m=>(
                  <button key={m.id} style={{...S.btn("light"),padding:"5px 10px",fontSize:11,borderRadius:8}} onClick={()=>openAddVacation(m.id)}>
                    + {m.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Weekly grid */}
        <div style={S.card}>
          <div style={{...S.row,justifyContent:"space-between",marginBottom:12}}>
            <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setWeekOffset(w=>w-1)}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:"#3d2b1f"}}>{fmt(weekDates[0])} – {fmt(weekDates[6])}</div>
              {weekOffset===0&&<div style={{fontSize:10,color:"#c8913a",fontWeight:600}}>DIESE WOCHE</div>}
            </div>
            <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setWeekOffset(w=>w+1)}>›</button>
          </div>
          <div style={S.divider}/>

          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"96px repeat(7,1fr)",gap:2,marginBottom:6}}>
            <div/>
            {weekDates.map(d=>(
              <div key={dk(d)} style={{textAlign:"center",fontSize:9,color:"#8b6040",fontWeight:600,lineHeight:1.3}}>
                {d.toLocaleDateString("de-DE",{weekday:"short"})}<br/>{d.getDate()}
              </div>
            ))}
          </div>

          {rows.map(({member:m,isChild})=>{
            // Monthly count & quota shown next to name
            const mYear  = weekDates[0].getFullYear();
            const mMonth = weekDates[0].getMonth();
            const monthQ = getMonthlyQuota(m, members, vacations, mYear, mMonth);
            const monthC = countMistMonth(mistData, m.id, mYear, mMonth);
            const ok     = monthC >= monthQ;

            // Vacation this whole week?
            const weekMonKey = dk(weekDates[0]);
            const onVacWeek  = getMemberWeekQuota(m, weekMonKey, members, vacations) === 0;

            const isMe    = currentUser.id===m.id;
            const allowed = isAdmin||isMe;

            return (
              <div key={m.id} style={{marginBottom:4}}>
                <div style={{display:"grid",gridTemplateColumns:"96px repeat(7,1fr)",gap:2,alignItems:"center"}}>
                  <div style={{paddingLeft:isChild?10:0}}>
                    {isChild&&<div style={{fontSize:8,color:"#b89060",marginBottom:1}}>↳ Beteil.</div>}
                    <div style={{fontSize:11,fontWeight:isMe?700:500,color:isMe?"#c8913a":"#2c2416",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {m.name.split(" ")[0]}
                    </div>
                    {onVacWeek
                      ? <div style={{fontSize:9,color:"#16a085",fontWeight:600}}>🌴 Urlaub</div>
                      : <div style={{fontSize:9,color:ok?"#27ae60":"#c0392b",fontWeight:600}}>{monthC}/{monthQ}Mo</div>}
                  </div>
                  {weekDates.map(d=>{
                    const k           = dk(d);
                    const checked     = (mistData[k]||[]).includes(m.id);
                    const isPast      = d < new Date(dk(today));
                    const onVac       = isOnVacationDay(m.id, k, vacations);
                    const takenByOther= (mistData[k]||[]).some(id => id!==m.id);

                    return (
                      <div key={k} onClick={()=>allowed&&!onVac&&toggleMist(k,m.id)}
                        style={{height:30,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",
                          cursor:(allowed&&!onVac)?"pointer":"default",
                          background:onVac?"#e8f8f5":checked?"#c8913a":takenByOther?"#fdecea":isPast?"#f5f0e8":"#faf6f0",
                          border:checked?"2px solid #a07030":onVac?"2px solid #a8e6cf":takenByOther?"2px solid #f5c0c0":isMe&&!isPast?"2px solid #c8913a55":"2px solid #e2d5c0",
                          opacity:allowed?1:0.7,transition:"all .15s"}}>
                        {onVac&&<span style={{fontSize:10}}>🌴</span>}
                        {!onVac&&checked&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
                        {!onVac&&!checked&&takenByOther&&<span style={{fontSize:9,color:"#c0392b"}}>✗</span>}
                        {!onVac&&!checked&&!takenByOther&&!allowed&&<span style={{fontSize:8,color:"#ccc"}}>🔒</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:8,fontSize:10,color:"#aaa"}}>
            <span>✓ = Eingetragen</span>
            <span>🌴 = Urlaub</span>
            <span style={{color:"#c0392b"}}>✗ = Tag bereits vergeben</span>
            <span>🔒 = Nur eigener</span>
            <span style={{color:"#c8913a",fontWeight:600}}>Mo = Monatssoll</span>
          </div>
        </div>

        {/* Monthly summary */}
        <div style={S.card}>
          <div style={S.cTitle}>Monatsübersicht – {today.toLocaleDateString("de-DE",{month:"long",year:"numeric"})}</div>
          {einstellerList.map(e=>{
            const mQ=getMonthlyQuota(e,members,vacations,curYear,curMonth);
            const mC=countMistMonth(mistData,e.id,curYear,curMonth);
            const beteiligungen=members.filter(m=>m.einstellerId===e.id);
            const vacCount=(vacations[e.id]||[]).length;
            return (
              <div key={e.id} style={{marginBottom:14,paddingBottom:14,borderBottom:"1px solid #f0e8d8"}}>
                <div style={{...S.row,justifyContent:"space-between",marginBottom:4}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{e.name} <span style={{fontSize:10,color:"#8b6040"}}>({e.horse})</span></div>
                    <div style={{fontSize:10,color:"#aaa"}}>Pflicht: {mQ}× diesen Monat{vacCount>0?` · 🌴 ${vacCount} Urlaub(e)`:""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:700,fontSize:20,color:mC>=mQ?"#27ae60":"#c0392b"}}>{mC}</div>
                    <div style={{fontSize:9,color:"#aaa"}}>/{mQ}×</div>
                  </div>
                </div>
                {beteiligungen.map(rb=>{
                  const rbQ=getMonthlyQuota(rb,members,vacations,curYear,curMonth);
                  const rbC=countMistMonth(mistData,rb.id,curYear,curMonth);
                  const rbVac=(vacations[rb.id]||[]).length;
                  return (
                    <div key={rb.id} style={{...S.row,justifyContent:"space-between",paddingLeft:12,marginTop:4}}>
                      <div style={{fontSize:11,color:"#8b6040"}}>↳ {rb.name} {rbVac>0&&"🌴"} <span style={{fontSize:9}}>({rbQ}×)</span></div>
                      <div style={{fontSize:12,fontWeight:700,color:rbC>=rbQ?"#27ae60":"#c0392b"}}>{rbC}/{rbQ}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {showAddVacation&&(
          <div style={S.modal}><div style={S.mBox}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:4,color:"#3d2b1f"}}>🌴 Urlaub eintragen</div>
            <div style={{fontSize:11,color:"#8b6040",marginBottom:16}}>
              für: <b>{members.find(m=>m.id===vacTargetId)?.name}</b>
            </div>
            <label style={S.label}>Von</label>
            <input type="date" style={S.input} value={newVac.from} onChange={e=>setNewVac(p=>({...p,from:e.target.value}))}/>
            <label style={S.label}>Bis</label>
            <input type="date" style={S.input} value={newVac.to} onChange={e=>setNewVac(p=>({...p,to:e.target.value}))}/>
            <label style={S.label}>Notiz (optional)</label>
            <input style={S.input} placeholder="z.B. Sommerurlaub" value={newVac.note} onChange={e=>setNewVac(p=>({...p,note:e.target.value}))}/>
            <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
              <button style={S.btn("light")} onClick={()=>setShowAddVacation(false)}>Abbrechen</button>
              <button style={S.btn("teal")} onClick={addVacation}>Eintragen</button>
            </div>
          </div></div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MEMBERS
  // ══════════════════════════════════════════════════════════════════════════
  const MembersScreen = () => {
    const [editId,   setEditId]   = useState(null);
    const [editData, setEditData] = useState({});

    const startEdit = (m) => {
      setEditId(m.id);
      setEditData({ name:m.name, horse:m.horse, phone:m.phone||"", pin:m.pin, type:m.type, einstellerId:m.einstellerId||"" });
    };
    const cancelEdit = () => setEditId(null);
    const saveEdit = (id) => {
      if(!editData.name||!editData.pin) return;
      setMembers(p=>p.map(m=>m.id===id ? {
        ...m,
        name:  editData.name,
        horse: editData.horse,
        phone: editData.phone,
        pin:   editData.pin,
        type:  editData.type,
        paid:  editData.type==="reitbeteiligung" ? null : (m.paid ?? false),
        einstellerId: editData.einstellerId ? parseInt(editData.einstellerId) : null,
      } : m));
      setEditId(null);
      showToast("✅ Daten gespeichert!");
    };

    const inStyle = { ...S.input, marginBottom:6, padding:"8px 10px", fontSize:12 };
    const lStyle  = { ...S.label, marginBottom:2 };

    const MemberRow = ({m, isChild}) => {
      const isEditing = isAdmin && editId===m.id;
      const avatarBg  = m.type==="admin"
        ? "linear-gradient(135deg,#c8913a,#f5c842)"
        : isChild ? "linear-gradient(135deg,#7f8c8d,#aaa)" : undefined;
      const avatarSz  = isChild ? {width:30,height:30,fontSize:12} : {};

      return (
        <div style={isChild ? {paddingLeft:14,paddingTop:10,borderTop:"1px dashed #f0e8d8"} : {}}>
          {!isEditing ? (
            /* ── VIEW MODE ── */
            <div style={{...S.row,justifyContent:"space-between"}}>
              <div style={{...S.row,gap:10}}>
                <div style={{...S.ava(avatarBg),...avatarSz}}>{m.name.charAt(0)}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:isChild?12:13}}>
                    {m.name} {m.type==="admin"&&<span style={{fontSize:10,color:"#c8913a"}}>👑</span>}
                  </div>
                  <div style={{fontSize:11,color:"#8b6040"}}>
                    {m.type==="reitbeteiligung"?"🤝 Reitbeteiligung":m.type==="admin"?"👑 Admin":"🐴 Einsteller"}
                    {m.horse?` · ${m.horse}`:""}
                  </div>
                  {isAdmin&&<>
                    {m.phone&&<div style={{fontSize:10,color:"#aaa"}}>📞 {m.phone}</div>}
                    <div style={{fontSize:10,color:"#b89060"}}>PIN: {m.pin}</div>
                  </>}
                  {getVacationLabel(m.id)&&<div style={{fontSize:10,color:"#16a085",marginTop:2}}>{getVacationLabel(m.id)}</div>}
                </div>
              </div>
              {isAdmin&&(
                <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                  <button onClick={()=>startEdit(m)}
                    style={{background:"#f5f0e8",border:"none",cursor:"pointer",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:600,color:"#8b6040"}}>
                    ✏️ Bearbeiten
                  </button>
                  {m.type!=="admin"&&(
                    <button onClick={()=>deleteMember(m.id)}
                      style={{background:"none",border:"none",cursor:"pointer",color:"#ddd",padding:"2px 4px"}}>
                      <Ic n="x" s={13}/>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── EDIT MODE ── */
            <div style={{background:"#faf6f0",borderRadius:10,padding:12,border:"1.5px solid #c8913a"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#c8913a",marginBottom:10}}>✏️ Bearbeiten: {m.name}</div>

              <label style={lStyle}>Name</label>
              <input style={inStyle} value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))}/>

              <label style={lStyle}>Pferd</label>
              <input style={inStyle} placeholder="Pferdename" value={editData.horse} onChange={e=>setEditData(p=>({...p,horse:e.target.value}))}/>

              <label style={lStyle}>Telefon</label>
              <input style={inStyle} placeholder="Optional" value={editData.phone} onChange={e=>setEditData(p=>({...p,phone:e.target.value}))}/>

              <label style={lStyle}>PIN zurücksetzen</label>
              <input style={inStyle} placeholder="4-stellig" maxLength={4} value={editData.pin}
                onChange={e=>setEditData(p=>({...p,pin:e.target.value.replace(/\D/,"")}))}/>

              {m.type!=="admin"&&<>
                <label style={lStyle}>Typ</label>
                <select style={inStyle} value={editData.type} onChange={e=>setEditData(p=>({...p,type:e.target.value,einstellerId:""}))}>
                  <option value="einsteller">🐴 Einsteller</option>
                  <option value="reitbeteiligung">🤝 Reitbeteiligung</option>
                </select>
              </>}

              {editData.type==="reitbeteiligung"&&<>
                <label style={lStyle}>Gehört zu Einsteller</label>
                <select style={inStyle} value={editData.einstellerId} onChange={e=>setEditData(p=>({...p,einstellerId:e.target.value}))}>
                  <option value="">— bitte wählen —</option>
                  {einstellerList.filter(x=>x.id!==m.id).map(x=>(
                    <option key={x.id} value={x.id}>{x.name} ({x.horse})</option>
                  ))}
                </select>
              </>}

              <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
                <button style={{...S.btn("light"),padding:"7px 14px",fontSize:12}} onClick={cancelEdit}>Abbrechen</button>
                <button style={{...S.btn("primary"),padding:"7px 14px",fontSize:12}} onClick={()=>saveEdit(m.id)}>💾 Speichern</button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        {!isAdmin&&(
          <div style={{...S.card,background:"#f5f0e8",border:"1.5px solid #e2d5c0"}}>
            <div style={{...S.row,gap:8}}><Ic n="lock" s={16}/><div style={{fontSize:12,color:"#8b6040"}}>Mitgliederverwaltung ist nur für Admins. Du siehst alle in der Übersicht.</div></div>
          </div>
        )}

        {einstellerList.map(e=>{
          const beteiligungen=members.filter(m=>m.einstellerId===e.id);
          return (
            <div key={e.id} style={S.card}>
              <MemberRow m={e} isChild={false}/>
              {beteiligungen.map(rb=>(
                <MemberRow key={rb.id} m={rb} isChild={true}/>
              ))}
            </div>
          );
        })}

        {isAdmin&&(
          <div style={{margin:"14px 16px 0"}}>
            <button style={{...S.btn("primary"),width:"100%",padding:14}} onClick={()=>setShowAddMember(true)}>+ Mitglied hinzufügen</button>
          </div>
        )}

        {showAddMember&&(
          <div style={S.modal}><div style={S.mBox}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:16,color:"#3d2b1f"}}>Neues Mitglied</div>
            <label style={S.label}>Name</label>
            <input style={S.input} placeholder="Vor- und Nachname" value={newMember.name} onChange={e=>setNewMember(p=>({...p,name:e.target.value}))}/>
            <label style={S.label}>Pferd</label>
            <input style={S.input} placeholder="Name des Pferdes" value={newMember.horse} onChange={e=>setNewMember(p=>({...p,horse:e.target.value}))}/>
            <label style={S.label}>Typ</label>
            <select style={S.input} value={newMember.type} onChange={e=>setNewMember(p=>({...p,type:e.target.value,einstellerId:""}))}>
              <option value="einsteller">Einsteller</option>
              <option value="reitbeteiligung">Reitbeteiligung</option>
              <option value="admin">Admin</option>
            </select>
            {newMember.type==="reitbeteiligung"&&(
              <>
                <label style={S.label}>Gehört zu Einsteller</label>
                <select style={S.input} value={newMember.einstellerId} onChange={e=>setNewMember(p=>({...p,einstellerId:e.target.value}))}>
                  <option value="">— bitte wählen —</option>
                  {einstellerList.map(m=><option key={m.id} value={m.id}>{m.name} ({m.horse})</option>)}
                </select>
              </>
            )}
            <label style={S.label}>PIN (4-stellig)</label>
            <input style={S.input} placeholder="z.B. 1234" maxLength={4} value={newMember.pin} onChange={e=>setNewMember(p=>({...p,pin:e.target.value.replace(/\D/,"")}))}/>
            <label style={S.label}>Telefon</label>
            <input style={S.input} placeholder="Optional" value={newMember.phone} onChange={e=>setNewMember(p=>({...p,phone:e.target.value}))}/>
            <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
              <button style={S.btn("light")} onClick={()=>setShowAddMember(false)}>Abbrechen</button>
              <button style={S.btn("primary")} onClick={addMember}>Hinzufügen</button>
            </div>
          </div></div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FINANZEN
  // ══════════════════════════════════════════════════════════════════════════
  const FinanzenScreen = () => {
    if(!isAdmin) return (
      <div style={S.card}>
        <div style={{...S.row,gap:10,marginBottom:10}}><Ic n="shield"/><div style={S.cTitle}>Nur für Admins</div></div>
        <div style={{fontSize:13,color:"#8b6040",lineHeight:1.6}}>Der Finanzbereich wird ausschließlich vom Admin verwaltet.</div>
      </div>
    );
    const zahlungsMitglieder=members.filter(m=>m.type!=="reitbeteiligung");
    const paid=zahlungsMitglieder.filter(m=>m.paid);
    const notPaid=zahlungsMitglieder.filter(m=>!m.paid);
    return (
      <div>
        <div style={{...S.card,background:"linear-gradient(135deg,#27ae60,#1e8449)",color:"#fff"}}>
          <div style={{fontSize:11,opacity:.8,marginBottom:4}}>Bezahlt diese Periode</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:42,fontWeight:700}}>{paid.length}<span style={{fontSize:20,opacity:.6}}>/{zahlungsMitglieder.length}</span></div>
          <div style={{fontSize:11,opacity:.8,marginTop:4}}>Einsteller haben gezahlt · Reitbeteiligungen separat</div>
        </div>
        <div style={S.card}>
          <div style={S.cTitle}>Zahlungsstatus</div>
          <div style={{fontSize:11,color:"#aaa",marginBottom:10}}>ℹ️ Reitbeteiligungen nicht aufgeführt – Abrechnung über Einsteller</div>
          {zahlungsMitglieder.map(m=>(
            <div key={m.id} style={{...S.row,justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f0e8d8"}}>
              <div style={{...S.row,gap:10}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:m.paid?"#d5f5e3":"#fdecea",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{color:m.paid?"#27ae60":"#c0392b"}}>{m.paid?<Ic n="check" s={16}/>:<Ic n="x" s={16}/>}</span>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{m.name}</div>
                  <div style={{fontSize:11,color:"#8b6040"}}>{m.type==="admin"?"👑 Admin":"🐴 Einsteller"} · {m.horse}</div>
                </div>
              </div>
              <button onClick={()=>togglePaid(m.id)} style={{...S.btn(m.paid?"light":"green"),padding:"6px 12px",fontSize:11}}>
                {m.paid?"↩ Reset":"✓ Bezahlt"}
              </button>
            </div>
          ))}
        </div>
        {notPaid.length>0&&(
          <div style={{...S.card,background:"#fff8f8",border:"1.5px solid #f5c0c0"}}>
            <div style={{fontWeight:700,fontSize:13,color:"#c0392b",marginBottom:10}}>📲 WhatsApp-Erinnerung</div>
            {notPaid.map(m=>(
              <div key={m.id} style={{...S.row,justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontSize:12}}>{m.name}</div>
                {m.phone&&(
                  <a href={`https://wa.me/${m.phone.replace(/[^0-9]/g,"")}?text=Hallo%20${encodeURIComponent(m.name.split(" ")[0])}%2C%20bitte%20vergiss%20nicht%20die%20Stallgeb%C3%BChr!%20%F0%9F%90%B4`}
                    style={{...S.btn("primary"),textDecoration:"none",padding:"5px 12px",fontSize:11,display:"inline-block"}}>
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const screens={home:<HomeScreen/>,calendar:<CalendarScreen/>,mist:<MistScreen/>,members:<MembersScreen/>,finanzen:<FinanzenScreen/>};
  const tabs=[
    {id:"home",    label:"Start",      icon:"home"},
    {id:"calendar",label:"Termine",    icon:"cal"},
    {id:"mist",    label:"Mist",       icon:"mist"},
    {id:"members", label:"Mitglieder", icon:"users"},
    {id:"finanzen",label:"Finanzen",   icon:"money"},
  ];

  return (
    <div style={S.root}>
      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#fff",padding:"10px 20px",borderRadius:12,zIndex:500,fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,.2)",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}
      <div style={S.header}>
        <div style={{...S.row,justifyContent:"space-between"}}>
          <div>
            <div style={S.hTitle}>🐴 Stallbuch</div>
            <div style={S.hSub}>{currentUser.name} · {currentUser.type==="admin"?"👑 Admin":currentUser.type==="einsteller"?"Einsteller":"Reitbeteiligung"}</div>
          </div>
          <button onClick={handleLogout} style={{background:"none",border:"none",cursor:"pointer",color:"#b89060",padding:6}}><Ic n="logout" s={18}/></button>
        </div>
      </div>
      <div style={S.nav}>
        {tabs.map(t=><button key={t.id} style={S.navBtn(tab===t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>
      <div style={{paddingBottom:16}}>{screens[tab]}</div>
      <div style={S.bNav}>
        {tabs.map(t=>(
          <button key={t.id} style={S.bBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
            <Ic n={t.icon} s={20}/>
            <span style={{fontSize:9,fontWeight:600}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
