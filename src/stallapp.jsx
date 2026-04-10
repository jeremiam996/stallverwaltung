import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

const SUPA_URL = "https://yyinsnpbqiiohkdfpyxq.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5aW5zbnBicWlpb2hrZGZweXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjQxMzcsImV4cCI6MjA4ODgwMDEzN30.ZpjwPDVEVbgYGNfnYEaX9AelW47Ch0V42u8aliqL3tc";
const sb = createClient(SUPA_URL, SUPA_KEY);

const SEED_MEMBERS = [
  { id:1, name:"Anna Müller",    horse:"Estrella", type:"admin",           pin:"1234", paid:true,  phone:"0171-111111", einsteller_id:null },
  { id:2, name:"Ben Schneider",  horse:"Thunder",  type:"einsteller",      pin:"2222", paid:false, phone:"0172-222222", einsteller_id:null },
  { id:3, name:"Clara Hoffmann", horse:"Bella",    type:"einsteller",      pin:"3333", paid:true,  phone:"0173-333333", einsteller_id:null },
  { id:4, name:"David Koch",     horse:"Thunder",  type:"reitbeteiligung", pin:"4444", paid:null,  phone:"0174-444444", einsteller_id:2 },
  { id:5, name:"Eva Braun",      horse:"Bella",    type:"reitbeteiligung", pin:"5555", paid:null,  phone:"0175-555555", einsteller_id:3 },
  { id:6, name:"Felix Sommer",   horse:"Bella",    type:"reitbeteiligung", pin:"6666", paid:null,  phone:"0176-666666", einsteller_id:3 },
];
const today = new Date();
const SEED_EVENTS = [
  { id:1, type:"Tierarzt",   date:new Date(today.getFullYear(),today.getMonth(),today.getDate()+3).toISOString().slice(0,10),  time:"10:00", note:"Jährliche Gesundheitskontrolle", color:"#c0392b" },
  { id:2, type:"Hufschmied", date:new Date(today.getFullYear(),today.getMonth(),today.getDate()+7).toISOString().slice(0,10),  time:"09:00", note:"Alle Pferde",                    color:"#8B6914" },
  { id:3, type:"Impfen",     date:new Date(today.getFullYear(),today.getMonth(),today.getDate()+14).toISOString().slice(0,10), time:"14:00", note:"Influenza + Herpes",             color:"#27ae60" },
];

const dbToMember = r => ({ id:r.id, name:r.name, horse:r.horse||"", type:r.type, pin:r.pin, paid:r.paid, phone:r.phone||"", einstellerId:r.einsteller_id, mistShare:r.mist_share??50, mistMode:r.mist_mode||"percent" });
const dbToEvent  = r => ({ id:r.id, type:r.type, date:r.date, time:r.time||"", note:r.note||"", color:r.color, createdBy:r.created_by||"" });
const dbToVac    = r => ({ id:r.id, from:r.from_date, to:r.to_date, note:r.note||"", mustCover:r.must_cover||false });

const getWeekDates = (offset=0) => {
  const now=new Date(); const day=now.getDay()||7;
  const mon=new Date(now); mon.setDate(now.getDate()-day+1+offset*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
};
const dk    = d => d.toISOString().slice(0,10);
const dkl   = d => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; };
const fmt   = d => d.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"});
const fmtD  = d => d.toLocaleDateString("de-DE",{day:"2-digit",month:"long",year:"numeric"});
const fmtSh = d => d.toLocaleDateString("de-DE",{day:"2-digit",month:"short"});

const getWeeksInMonth = (year, month) => {
  const weeks = [];
  const d = new Date(year, month, 1);
  while(d.getMonth() === month) {
    const dow = d.getDay() || 7;
    const mon = new Date(d); mon.setDate(d.getDate() - dow + 1);
    const thu = new Date(mon); thu.setDate(mon.getDate() + 3);
    const monKey = dk(mon);
    if(thu.getFullYear()===year && thu.getMonth()===month && !weeks.includes(monKey)) weeks.push(monKey);
    d.setDate(d.getDate() + 1);
  }
  return weeks;
};

const getBaseGroupQuota = (einsteller, allMembers, year, month) => {
  const beteiligungen = allMembers.filter(m=>m.einstellerId===einsteller.id);
  if(beteiligungen.length===0) return 2; // solo: 2 per week
  const mode = einsteller.mistMode||"percent";
  const weeks = year!==undefined ? getWeeksInMonth(year,month).length : 4;
  if(mode==="percent") {
    const share = (einsteller.mistShare??50) / 100;
    return Math.max(0, Math.round(2 * share));
  }
  if(mode==="fixed_e") {
    // mistShare = fixed monthly count for Einsteller → per week = monthly / weeks
    const monthly = einsteller.mistShare??4;
    return Math.max(0, Math.round(monthly / weeks));
  }
  if(mode==="fixed_rb") {
    // mistShare = fixed monthly count per RB → Einsteller gets remainder
    const rbMonthly = einsteller.mistShare??2;
    const totalMonthly = weeks * 2;
    const rbTotal = rbMonthly * beteiligungen.length;
    const eMonthly = Math.max(0, totalMonthly - rbTotal);
    return Math.max(0, Math.round(eMonthly / weeks));
  }
  return 1;
};
const getRbWeekQuota = (root, allMembers, year, month) => {
  const beteiligungen = allMembers.filter(m=>m.einstellerId===root.id);
  if(beteiligungen.length===0) return 0;
  const mode = root.type==="admin" ? "fixed_rb" : (root.mistMode||"percent");
  const weeks = year!==undefined ? getWeeksInMonth(year,month).length : 4;
  if(mode==="percent") {
    const rootShare = (root.mistShare??50) / 100;
    const rbShare = (1 - rootShare) / beteiligungen.length;
    return Math.max(0, Math.round(2 * rbShare));
  }
  if(mode==="fixed_e") {
    const eMonthly = root.mistShare??4;
    const totalMonthly = weeks * 2;
    const rbTotal = Math.max(0, totalMonthly - eMonthly);
    return Math.max(0, Math.round(rbTotal / beteiligungen.length / weeks));
  }
  if(mode==="fixed_rb") {
    // Return monthly value divided by weeks for week-view display
    const rbMonthly = root.mistShare??2;
    return rbMonthly / weeks; // keep as float so getMonthlyQuota sums correctly
  }
  return 1;
};
const getRbMonthlyQuota = (root, allMembers, vacations, year, month) => {
  const mode = root.type==="admin" ? "fixed_rb" : (root.mistMode||"percent");
  if(mode==="fixed_rb") {
    // Return direct monthly value — vacation does NOT reduce quota
    return root.mistShare??2;
  }
  return null; // signals to use normal path
};
const getMemberWeekQuota = (member, weekMon, allMembers, vacations) => {
  // Note: vacation does NOT reduce quota - it only affects scheduling
  const wDate = new Date(weekMon); const yr = wDate.getFullYear(); const mo = wDate.getMonth();
  if(member.type==="reitbeteiligung") {
    const root = allMembers.find(m=>m.id===member.einstellerId);
    if(!root) return 1;
    return getRbWeekQuota(root, allMembers, yr, mo);
  }
  return getBaseGroupQuota(member, allMembers, yr, mo);
};
const getMonthlyQuota = (member, allMembers, vacations, year, month) => {
  // Special case: RB of admin with fixed_rb mode → use direct monthly value
  if(member.type==="reitbeteiligung") {
    const root = allMembers.find(m=>m.id===member.einstellerId);
    if(root) {
      const monthly = getRbMonthlyQuota(root, allMembers, vacations, year, month);
      if(monthly !== null) return monthly;
    }
  }
  // Default: sum weekly quotas (vacation does NOT reduce quota)
  let total = 0;
  getWeeksInMonth(year, month).forEach(monKey => { total += getMemberWeekQuota(member, monKey, allMembers, vacations); });
  return Math.round(total);
};
const countMistMonth = (mistData, memberId, year, month) => {
  let count = 0;
  getWeeksInMonth(year, month).forEach(monKey => {
    for(let i=0;i<7;i++){
      const d = new Date(monKey); d.setDate(d.getDate()+i);
      count += (mistData[dk(d)]||[]).includes(memberId) ? 1 : 0;
    }
  });
  return count;
};
const isOnVacationDay = (memberId, dayKey, vacations) =>
  (vacations[memberId]||[]).some(v=>v.from<=dayKey&&v.to>=dayKey);
const getVacCoverDay = (dayKey, vacations, allMembers, excludeId) => {
  // Returns 'must' | 'soft' | null — whether any Einsteller/Admin is on vacation on this day
  let must = false, soft = false;
  allMembers.filter(m=>(m.type==="einsteller"||m.type==="admin")&&m.id!==excludeId).forEach(m=>{
    const vac = (vacations[m.id]||[]).find(v=>v.from<=dayKey&&v.to>=dayKey);
    if(vac) { if(vac.mustCover) must=true; else soft=true; }
  });
  return must?"must":soft?"soft":null;
};

const EVENT_TYPES  = ["Tierarzt","Hufschmied","Impfen","Sonstiges"];
const EVENT_COLORS = { Tierarzt:"#c0392b", Hufschmied:"#8B6914", Impfen:"#27ae60", Sonstiges:"#7f8c8d" };

const S = {
  root:    { fontFamily:"'DM Sans',sans-serif", background:"#f5f0e8", minHeight:"100vh", color:"#2c2416", maxWidth:430, margin:"0 auto", paddingBottom:90 },
  header:  { background:"linear-gradient(160deg,#3d2b1f 0%,#6b4c2a 100%)", padding:"20px 20px 14px", position:"sticky", top:0, zIndex:100 },
  hTitle:  { fontFamily:"'Playfair Display',serif", fontSize:20, color:"#f5e6c8", margin:0 },
  hSub:    { color:"#b89060", fontSize:11, marginTop:2, fontWeight:300 },
  nav:     { display:"flex", overflowX:"auto", background:"#2c1e0f" },
  navBtn:  a=>({ flex:"0 0 auto", padding:"10px 13px", fontSize:11, fontWeight:500, border:"none", cursor:"pointer", background:a?"#c8913a":"transparent", color:a?"#fff":"#a07848", borderBottom:a?"3px solid #f5c842":"3px solid transparent", whiteSpace:"nowrap" }),
  card:    { background:"#fff", borderRadius:14, margin:"14px 16px 0", padding:"16px", boxShadow:"0 2px 12px rgba(0,0,0,.07)" },
  cTitle:  { fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, marginBottom:12, color:"#3d2b1f" },
  btn:     v=>({ padding:"10px 18px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13, background:v==="primary"?"#c8913a":v==="danger"?"#c0392b":v==="green"?"#27ae60":v==="teal"?"#16a085":"#f0e6d3", color:v==="light"?"#3d2b1f":"#fff" }),
  input:   { width:"100%", padding:"10px 12px", borderRadius:9, border:"1.5px solid #e2d5c0", background:"#faf6f0", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#2c2416", boxSizing:"border-box", marginBottom:8 },
  label:   { fontSize:11, fontWeight:600, color:"#8b6040", marginBottom:3, display:"block" },
  row:     { display:"flex", gap:8, alignItems:"center" },
  divider: { height:1, background:"#ede5d5", margin:"10px 0" },
  modal:   { position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:300, display:"flex", alignItems:"flex-end" },
  mBox:    { background:"#fff", width:"100%", maxWidth:430, margin:"0 auto", borderRadius:"18px 18px 0 0", padding:24, boxSizing:"border-box", maxHeight:"90vh", overflowY:"auto" },
  bNav:    { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"#fff", borderTop:"1.5px solid #ede5d5", display:"flex", zIndex:200 },
  bBtn:    a=>({ flex:1, padding:"10px 0 8px", border:"none", background:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:a?"#c8913a":"#a09080" }),
  ava:     bg=>({ width:38, height:38, borderRadius:"50%", background:bg||"linear-gradient(135deg,#c8913a,#8b6040)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:15, flexShrink:0 }),
};

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
    trash:  <svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
    sync:   <svg {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  };
  return map[n]||null;
};

// ══════════════════════════════════════════════════════════════════════════
// SCREEN COMPONENTS — defined outside StallApp so React never remounts them
// ══════════════════════════════════════════════════════════════════════════

function HomeScreen({ currentUser, isAdmin, members, events, mistData, vacations, finMonths, finAccounts, selDay, setSelDay, upcomingEvents, unpaid, mistWarnings, getVacationLabel, calcTotal, getFinMonth, rbVisits, blockedDays }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const viewDate  = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const viewYear  = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const isThisMonth = monthOffset === 0;

  const isE = currentUser.type==="einsteller";
  const mQ  = isE ? getMonthlyQuota(currentUser,members,vacations,viewYear,viewMonth) : 0;
  const mC  = isE ? countMistMonth(mistData,currentUser.id,viewYear,viewMonth) : 0;
  const myVacLabel = getVacationLabel(currentUser.id);

  const calDays = [];
  const cd = new Date(viewYear, viewMonth, 1);
  while(cd.getMonth()===viewMonth){ calDays.push(new Date(cd)); cd.setDate(cd.getDate()+1); }
  const leadingBlanks = (new Date(viewYear,viewMonth,1).getDay()||7)-1;
  const monthLabel = viewDate.toLocaleDateString("de-DE",{month:"long",year:"numeric"});

  const getDayInfo = (day) => {
    const k = dkl(day);
    const myMist   = (mistData[k]||[]).includes(currentUser.id);
    const myVac    = isOnVacationDay(currentUser.id, k, vacations);
    const dayEvts  = events.filter(e=>e.date===k);
    const otherVacs = members
      .filter(m => {
        if(m.id===currentUser.id) return false;
        if(isAdmin) return true;
        if(m.type==="admin") return true;
        if(currentUser.type==="einsteller" && m.einstellerId===currentUser.id) return true;
        if(currentUser.type==="reitbeteiligung" && m.id===currentUser.einstellerId) return true;
        return false;
      })
      .flatMap(m=>(vacations[m.id]||[]).filter(v=>v.from<=k&&v.to>=k).map(v=>({...v, memberName:m.name.split(" ")[0]})));
    // RB visits: Einsteller sees their RBs' visits; RB sees own visits; Admin sees their RBs' visits
    const myRbVisits = (rbVisits||[]).filter(v => {
      if(v.date!==k) return false;
      if(v.memberId===currentUser.id) return true;
      const rb = members.find(m=>m.id===v.memberId);
      if(!rb) return false;
      if(currentUser.type==="einsteller" && rb.einstellerId===currentUser.id) return true;
      if(isAdmin && rb.einstellerId===currentUser.id) return true;
      return false;
    }).map(v=>({...v, memberName: members.find(m=>m.id===v.memberId)?.name.split(" ")[0]||""}));
    // Blocked days: RB sees blocks from their admin/einsteller; admin/einsteller see their own blocks
    const isBlocked = (blockedDays||[]).some(b => {
      if(b.date!==k) return false;
      if(isAdmin && b.adminId===currentUser.id) return true;
      if(currentUser.type==="reitbeteiligung") {
        const einsteller = members.find(m=>m.id===currentUser.einstellerId);
        return einsteller && b.adminId===einsteller.id;
      }
      return false;  // Einsteller sehen keine gesperrten Tage im Kalender
    });
    const blockedLevel = isBlocked ? (isAdmin ? "admin" : "rb") : null;
    return { k, myMist, myVac, dayEvts, adminVacs: otherVacs, myRbVisits, isBlocked: blockedLevel };
  };
  const getIndicators = (info, isSelected) => {
    // Returns up to 3 colored bars shown below the date
    const bars = [];
    if(info.myVac)  bars.push("#16a085");
    if(info.myMist) bars.push("#c8913a");
    info.dayEvts.slice(0,2).forEach(e=>bars.push(e.color));
    if(info.adminVacs?.length>0) bars.push("#b0b0b0");
    if(info.myRbVisits?.length>0) bars.push(info.myRbVisits.some(v=>v.isLesson)?"#8e44ad":"#9b59b6");
    // deduplicate and cap at 3
    const unique = [...new Set(bars)].slice(0,3);
    if(unique.length===0) return null;
    return (
      <div style={{display:"flex",gap:2,justifyContent:"center",marginTop:1}}>
        {unique.map((c,i)=>(
          <div key={i} style={{
            width: unique.length===1 ? 16 : unique.length===2 ? 8 : 5,
            height:3, borderRadius:2,
            background:isSelected?"rgba(255,255,255,0.7)":c,
            flexShrink:0
          }}/>
        ))}
      </div>
    );
  };
  // Keep getDots as alias for compatibility
  const getDots = getIndicators;
  const selInfo = selDay ? getDayInfo(selDay) : null;

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
            <div style={{fontSize:12,fontWeight:700,color:"#8B6914"}}>⚠️ Mist-Erinnerung</div>
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

      {/* Month navigator */}
      <div style={{...S.row,justifyContent:"space-between",alignItems:"center",padding:"8px 16px 0"}}>
        <button onClick={()=>setMonthOffset(o=>o-1)} style={{background:"#f0e8d8",border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16,color:"#3d2b1f",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#3d2b1f"}}>{monthLabel}</div>
          {!isThisMonth&&<div style={{fontSize:10,color:"#c8913a",cursor:"pointer",marginTop:1}} onClick={()=>setMonthOffset(0)}>Heute</div>}
        </div>
        <button onClick={()=>setMonthOffset(o=>o+1)} style={{background:"#f0e8d8",border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16,color:"#3d2b1f",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>

      {isAdmin&&(
        <div style={S.card}>
          <div style={S.cTitle}>💰 Zahlungsübersicht</div>
          {members.filter(m=>m.type==="einsteller").map(m=>{
            const fm=getFinMonth(m.id,viewYear,viewMonth);
            const total=calcTotal(m.id,viewYear,viewMonth);
            const paid=fm.payment!==null&&fm.payment!==undefined;
            return (
              <div key={m.id} style={{...S.row,justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f0e8d8"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{m.name}</div>
                  <div style={{fontSize:10,color:"#8b6040"}}>🐴 {m.horse} · {total.toFixed(2)}€</div>
                </div>
                {paid
                  ? <span style={{background:"#e8f0e8",color:"#555",fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:20}}>✓ {Number(fm.payment).toFixed(2)}€</span>
                  : <span style={{background:"#fdecea",color:"#c0392b",fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:20}}>⚠️ Offen</span>}
              </div>
            );
          })}
          {(()=>{
            const adminRbs = members.filter(m=>m.type==="reitbeteiligung"&&members.some(a=>a.type==="admin"&&a.id===m.einstellerId));
            if(adminRbs.length===0) return null;
            return (<>
              <div style={{fontSize:10,color:"#8b6040",fontWeight:700,marginTop:8,marginBottom:2}}>🤝 Reitbet. von {members.find(a=>a.type==="admin")?.name.split(" ")[0]}</div>
              {adminRbs.map(m=>{
                const fm=getFinMonth(m.id,viewYear,viewMonth);
                const total=calcTotal(m.id,viewYear,viewMonth);
                const paid=fm.payment!==null&&fm.payment!==undefined;
                return (
                  <div key={m.id} style={{...S.row,justifyContent:"space-between",padding:"7px 0",paddingLeft:10,borderBottom:"1px solid #f0e8d8"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:500}}>{m.name}</div>
                      <div style={{fontSize:10,color:"#8b6040"}}>🤝{m.horse?` ${m.horse}`:""} · {total.toFixed(2)}€</div>
                    </div>
                    {paid
                      ? <span style={{background:"#e8f0e8",color:"#555",fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:20}}>✓ {Number(fm.payment).toFixed(2)}€</span>
                      : <span style={{background:"#fdecea",color:"#c0392b",fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:20}}>⚠️ Offen</span>}
                  </div>
                );
              })}
            </>);
          })()}
        </div>
      )}
      {isE&&(
        <div style={S.card}>
          <div style={S.cTitle}>Mein Überblick</div>
          <div style={{...S.row,justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontSize:13}}>🧹 Mistdienst: <b style={{color:mC>=mQ?"#27ae60":"#c0392b"}}>{mC}/{mQ}×{mC>mQ?" 🌟":""}</b></div>
              <div style={{fontSize:11,color:"#aaa",marginTop:2}}>Aufgeteilt mit {members.filter(m=>m.einstellerId===currentUser.id).length} Reitbet.</div>
            </div>
            {mC>=mQ?<span style={{color:"#27ae60",fontWeight:700,fontSize:12}}>✓ Erledigt!</span>:<span style={{color:"#c0392b",fontWeight:700,fontSize:12}}>Noch offen</span>}
          </div>
          {currentUser.type!=="reitbeteiligung"&&(()=>{
            const hFm    = getFinMonth(currentUser.id, viewYear, viewMonth);
            const hTotal = calcTotal(currentUser.id, viewYear, viewMonth);
            const hPaid  = hFm.payment!==null&&hFm.payment!==undefined;
            return (
              <div style={{...S.row,justifyContent:"space-between",marginTop:4,paddingTop:10,borderTop:"1px solid #f0e8d8"}}>
                <div>
                  <div style={{fontSize:13}}>💰 Stallgebühr {viewDate.toLocaleDateString("de-DE",{month:"long"})}</div>
                  <div style={{fontSize:11,color:"#aaa",marginTop:1}}>{hTotal.toFixed(2)}€ fällig</div>
                </div>
                {hPaid
                  ? <span style={{background:"#e8f0e8",color:"#555",fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:20}}>✓ {Number(hFm.payment).toFixed(2)}€</span>
                  : <span style={{background:"#fdecea",color:"#c0392b",fontWeight:700,fontSize:11,padding:"4px 10px",borderRadius:20}}>⚠️ Ausstehend</span>}
              </div>
            );
          })()}
        </div>
      )}

      {/* Mini Month Calendar */}
      <div style={S.card}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
          {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=>(
            <div key={d} style={{textAlign:"center",fontSize:9,color:"#8b6040",fontWeight:700}}>{d}</div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {Array.from({length:leadingBlanks}).map((_,i)=><div key={"b"+i}/>)}
          {calDays.map(day=>{
            const info        = getDayInfo(day);
            const isToday     = info.k===dkl(today);
            const isSelected  = selDay && dkl(day)===dkl(selDay);
            const hasAdminVac = info.adminVacs?.length>0;
            const hasMustCover= info.adminVacs?.some(v=>v.mustCover);
            const hasVisit    = info.myRbVisits?.length>0;
            const hasLesson   = info.myRbVisits?.some(v=>v.isLesson);
            const blockedRb   = info.isBlocked==="rb";
            const blockedAdmin= info.isBlocked==="admin";
            const hasContent  = info.myMist||info.myVac||info.dayEvts.length>0||hasAdminVac||hasVisit||info.isBlocked;

            // Mist = primary background. Visits/blocked = shown via border + corner badge.
            let bg, border;
            if(isSelected)       { bg="#3d2b1f"; border="2px solid #3d2b1f"; }
            else if(info.myMist && blockedRb)  { bg="#c8913a"; border="2px dashed #c0392b"; }
            else if(info.myMist && blockedAdmin){ bg="#c8913a"; border="1.5px dashed #e0b0b0"; }
            else if(info.myMist && hasLesson)  { bg="#c8913a"; border="2px solid #8e44ad"; }
            else if(info.myMist && hasVisit)   { bg="#c8913a"; border="2px solid #9b59b6"; }
            else if(info.myMist)               { bg="#c8913a"; border="2px solid #a07030"; }
            else if(info.myVac) { bg="#e8f8f5"; border="1px solid #a8e6cf"; }
            else if(hasMustCover){bg="#fff";    border="1.5px dashed #e74c3c"; }
            else if(hasAdminVac){ bg="#f7f7f7"; border="1px dashed #ccc"; }
            else if(blockedRb)  { bg="#fdf2f2"; border="2px dashed #c0392b"; }
            else if(blockedAdmin){ bg="#fff";   border="1px dashed #e0b0b0"; }
            else if(hasLesson)  { bg="#f0e8fa"; border="2px solid #8e44ad"; }
            else if(hasVisit)   { bg="#f3eafa"; border="1.5px solid #9b59b6"; }
            else                { bg="#fff";    border="1px solid #ede5d5"; }
            if(isToday&&!isSelected) border="2px solid #c8913a";

            return (
              <div key={info.k}
                onClick={()=>hasContent&&setSelDay(prev=>prev&&dkl(prev)===info.k?null:day)}
                style={{aspectRatio:"1",borderRadius:7,display:"flex",flexDirection:"column",
                  alignItems:"center",justifyContent:"space-between",padding:"3px 2px 3px",
                  position:"relative",cursor:hasContent?"pointer":"default",
                  background:bg,border,transition:"all .15s"}}>
                {/* Date number */}
                <div style={{fontSize:10,fontWeight:isToday?700:400,lineHeight:1,
                  color:isSelected?"#fff":info.myMist?"#fff":blockedRb?"#c0392b":hasLesson?"#8e44ad":hasVisit?"#7d3c98":blockedAdmin?"#c8a0a0":"#2c2416"}}>
                  {day.getDate()}
                </div>
                {/* Middle icon */}
                <div style={{fontSize:8,lineHeight:1,minHeight:8}}>
                  {info.myMist&&!isSelected&&<span style={{color:"#fff"}}>✓</span>}
                  {!info.myMist&&blockedRb&&<span style={{color:"#c0392b"}}>🚫</span>}
                  {!info.myMist&&blockedAdmin&&<span style={{color:"#c8a0a0",fontSize:7}}>⛔</span>}
                  {!info.myMist&&!info.isBlocked&&hasLesson&&<span>🎓</span>}
                  {!info.myMist&&!info.isBlocked&&hasVisit&&!hasLesson&&<span>🐎</span>}
                </div>
                {/* Corner badge when mist overlaps */}
                {info.myMist&&(hasVisit||info.isBlocked)&&(
                  <div style={{position:"absolute",top:1,right:2,fontSize:9,lineHeight:1,
                    textShadow:"0 0 3px rgba(0,0,0,0.4)"}}>
                    {blockedRb?"🚫":blockedAdmin?"⛔":hasLesson?"🎓":"🐎"}
                  </div>
                )}
                {/* Bottom bar — always shown when there's content */}
                <div style={{width:"80%",height:3,borderRadius:2,overflow:"hidden",display:"flex",gap:1}}>
                  {(()=>{
                    const bars=[];
                    if(info.myMist) bars.push("rgba(255,255,255,0.5)");
                    if(info.myVac)  bars.push("#16a085");
                    info.dayEvts.slice(0,2).forEach(e=>bars.push(e.color));
                    if(hasLesson||hasVisit) bars.push("#9b59b6");
                    if(blockedRb)   bars.push("#c0392b");
                    if(info.adminVacs?.length>0) bars.push("#b0b0b0");
                    const unique=[...new Set(bars)].slice(0,3);
                    if(unique.length===0) return null;
                    return unique.map((c,i)=>(
                      <div key={i} style={{flex:1,height:3,borderRadius:2,background:c}}/>
                    ));
                  })()}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:10,marginTop:10,fontSize:10,color:"#aaa",flexWrap:"wrap"}}>
          <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:14,height:3,borderRadius:2,background:"#c8913a",display:"inline-block"}}/> Mein Mist</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:14,height:3,borderRadius:2,background:"#16a085",display:"inline-block"}}/> Urlaub</span>
          <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:14,height:3,borderRadius:2,background:"#c0392b",display:"inline-block"}}/> Termin</span>
          {(currentUser.type==="einsteller"||isAdmin)&&(rbVisits||[]).some(v=>members.find(m=>m.id===v.memberId&&m.einstellerId===currentUser.id))&&(
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:14,height:3,borderRadius:2,background:"#9b59b6",display:"inline-block"}}/> RB-Besuch</span>
          )}
          {currentUser.type==="reitbeteiligung"&&(rbVisits||[]).some(v=>v.memberId===currentUser.id)&&(
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:14,height:3,borderRadius:2,background:"#9b59b6",display:"inline-block"}}/> Mein Besuch</span>
          )}
          {(isAdmin||(currentUser.type==="reitbeteiligung"))&&(blockedDays||[]).length>0&&(
            <span style={{display:"flex",alignItems:"center",gap:3}}>
              {currentUser.type==="reitbeteiligung"?"🚫":"⛔"} Gesperrt für RB
            </span>
          )}
          {(()=>{
            const othersWithVac = members
              .filter(m => {
                if(m.id===currentUser.id) return false;
                if(isAdmin) return true;
                if(m.type==="admin") return true;
                if(currentUser.type==="einsteller" && m.einstellerId===currentUser.id) return true;
                if(currentUser.type==="reitbeteiligung" && m.id===currentUser.einstellerId) return true;
                return false;
              })
              .filter(m=>(vacations[m.id]||[]).some(v=>{
                const vFrom=new Date(v.from+"T00:00:00"); const vTo=new Date(v.to+"T00:00:00");
                const mStart=new Date(viewYear,viewMonth,1); const mEnd=new Date(viewYear,viewMonth+1,0);
                return vFrom<=mEnd && vTo>=mStart;
              }));
            if(othersWithVac.length===0) return null;
            return <span style={{display:"flex",alignItems:"center",gap:3}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#ccc",display:"inline-block"}}/>
              {" Urlaub: "}{othersWithVac.map(m=>m.name.split(" ")[0]).join(", ")}
            </span>;
          })()}
        </div>
        {selInfo&&(
          <div style={{marginTop:12,background:"#faf6f0",borderRadius:10,padding:"10px 14px",border:"1px solid #e2d5c0"}}>
            <div style={{fontWeight:700,fontSize:12,color:"#3d2b1f",marginBottom:8}}>
              {selDay.toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"long"})}
            </div>
            {selInfo.myVac&&(
              <div style={{...S.row,gap:8,marginBottom:6}}>
                <span style={{fontSize:14}}>🌴</span>
                <span style={{fontSize:12,color:"#16a085",fontWeight:600}}>Dein Urlaub</span>
              </div>
            )}
            {selInfo.myMist&&(
              <div style={{...S.row,gap:8,marginBottom:6}}>
                <span style={{width:10,height:10,borderRadius:"50%",background:"#c8913a",flexShrink:0}}/>
                <span style={{fontSize:12,color:"#c8913a",fontWeight:600}}>🧹 Dein Mistdienst</span>
              </div>
            )}
            {selInfo.myRbVisits?.map((v,i)=>(
              <div key={i} style={{...S.row,gap:8,marginBottom:6,padding:"6px 8px",background:v.isLesson?"#f0e8fa":"#f3eafa",borderRadius:7,border:`1px solid ${v.isLesson?"#8e44ad":"#c9a0dc"}`}}>
                <span style={{fontSize:14}}>{v.isLesson?"🎓":"🐎"}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:"#7d3c98"}}>
                    {v.memberId===currentUser.id ? (v.isLesson?"Reitunterricht":"Mein Besuch") : `${v.memberName} – ${v.isLesson?"Reitunterricht":"Besuch"}`}
                  </div>
                  {v.note&&<div style={{fontSize:10,color:"#aaa"}}>{v.note}</div>}
                </div>
              </div>
            ))}
            {selInfo.isBlocked==="rb"&&(
              <div style={{...S.row,gap:8,marginBottom:6,padding:"6px 8px",background:"#fdf2f2",borderRadius:7,border:"2px dashed #c0392b"}}>
                <span style={{fontSize:14}}>🚫</span>
                <div style={{fontSize:11,fontWeight:600,color:"#c0392b"}}>Gesperrter Tag – kein Besuch möglich</div>
              </div>
            )}
            {selInfo.isBlocked==="admin"&&(
              <div style={{...S.row,gap:8,marginBottom:6,padding:"6px 8px",background:"#fdf8f8",borderRadius:7,border:"1px dashed #e0b0b0"}}>
                <span style={{fontSize:12}}>⛔</span>
                <div style={{fontSize:11,color:"#b07070"}}>Gesperrter Tag</div>
              </div>
            )}
            {selInfo.adminVacs?.map((v,i)=>(
              <div key={i} style={{...S.row,gap:8,marginBottom:6,padding:"6px 8px",background:v.mustCover?"#fdf0ee":"#f5f5f5",borderRadius:7,border:v.mustCover?"1px solid #f5c6c0":"1px solid #e8e8e8"}}>
                <span style={{fontSize:12}}>{v.mustCover?"🔴":"🌴"}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:v.mustCover?"#c0392b":"#555"}}>{v.memberName} – Urlaub{v.mustCover?" · Vertretung nötig":""}</div>
                  {v.note&&<div style={{fontSize:10,color:"#aaa"}}>{v.note}</div>}
                </div>
              </div>
            ))}
            {selInfo.dayEvts.map(e=>(
              <div key={e.id} style={{...S.row,gap:8,marginBottom:6}}>
                <span style={{width:10,height:10,borderRadius:"50%",background:e.color,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#2c2416"}}>{e.type}</div>
                  <div style={{fontSize:10,color:"#8b6040"}}>
                    {e.time?`🕐 ${e.time} Uhr · `:""}
                    {e.note||""}
                    {e.createdBy?` · 👤 ${e.createdBy}`:""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}

function CalendarScreen({ currentUser, isAdmin, members, events, vacations, einstellerList, showAddVacation, setShowAddVacation, newVac, setNewVac, vacTargetId, openAddVacation, addVacation, deleteVacation, updateVacation, deleteEvent, updateEvent, setShowAddEvent, rbVisits, showAddVisit, setShowAddVisit, newVisit, setNewVisit, addRbVisit, deleteRbVisit, updateRbVisit, blockedDays, addBlockedDay, deleteBlockedDay }) {
  const [editVac, setEditVac] = useState(null);
  const [editForm, setEditForm] = useState({from:"",to:"",note:"",mustCover:false});
  const [editEvt, setEditEvt] = useState(null);
  const [editEvtForm, setEditEvtForm] = useState({type:"",date:"",time:"",note:""});
  const [editVisit, setEditVisit] = useState(null);
  const [editVisitForm, setEditVisitForm] = useState({date:"",note:"",isLesson:false});
  const [showPastVacations, setShowPastVacations] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [blockDate, setBlockDate] = useState("");

  const openEditVac = (memberId, vac) => { setEditVac({memberId,vac}); setEditForm({from:vac.from,to:vac.to,note:vac.note,mustCover:vac.mustCover||false}); };
  const saveEditVac = async () => {
    if(!editForm.from||!editForm.to||editForm.from>editForm.to) return;
    await updateVacation(editVac.memberId, editVac.vac.id, editForm);
    setEditVac(null);
  };
  const openEditEvt = (e) => { setEditEvt(e); setEditEvtForm({type:e.type,date:e.date,time:e.time||"",note:e.note||""}); };
  const saveEditEvt = async () => {
    if(!editEvtForm.date) return;
    await updateEvent(editEvt.id, editEvtForm);
    setEditEvt(null);
  };
  const openEditVisit = (v) => { setEditVisit(v); setEditVisitForm({date:v.date,note:v.note,isLesson:v.isLesson}); };
  const saveEditVisit = async () => {
    if(!editVisitForm.date) return;
    await updateRbVisit(editVisit.id, editVisitForm);
    setEditVisit(null);
  };

  // Which visits to show: RB sees own; Einsteller/Admin sees their RBs' visits
  const visibleVisits = (rbVisits||[]).filter(v => {
    if(v.memberId===currentUser.id) return true;
    const rb = members.find(m=>m.id===v.memberId);
    if(!rb) return false;
    if(currentUser.type==="einsteller" && rb.einstellerId===currentUser.id) return true;
    if(isAdmin && rb.einstellerId===currentUser.id) return true;
    return false;
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const canAdd = isAdmin || currentUser.type==="einsteller";
  const todayKey = dk(today);
  return (
    <div>
      <div style={S.card}>
        <div style={{...S.row,justifyContent:"space-between",marginBottom:14}}>
          <div style={S.cTitle}>Termine</div>
          {canAdd&&<button style={{...S.btn("primary"),padding:"8px 12px"}} onClick={()=>setShowAddEvent(true)}><Ic n="plus" s={16}/></button>}
        </div>
        {!canAdd&&<div style={{background:"#f5f0e8",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#8b6040",marginBottom:12}}>📅 Termine werden von Einstellern und Admin verwaltet</div>}
        {(()=>{
          const sorted = [...events].sort((a,b)=>a.date.localeCompare(b.date));
          const upcoming = sorted.filter(e=>e.date>=todayKey);
          const past     = sorted.filter(e=>e.date<todayKey);
          const renderEvent = (e) => {
            const canAct = isAdmin || e.createdBy===currentUser.name;
            return (
              <div key={e.id} style={{display:"flex",gap:10,marginBottom:12,alignItems:"flex-start"}}>
                <div style={{width:5,borderRadius:4,background:e.color,alignSelf:"stretch",flexShrink:0,minHeight:40}}/>
                <div style={{flex:1}}>
                  <div style={{...S.row,justifyContent:"space-between"}}>
                    <span style={{fontWeight:600,fontSize:14}}>{e.type}</span>
                    <span style={{fontSize:10,color:"#8b6040"}}>{new Date(e.date+"T00:00:00").toLocaleDateString("de-DE",{day:"2-digit",month:"short",year:"numeric"})}</span>
                  </div>
                  {e.time&&<div style={{fontSize:11,color:"#8b6040",marginTop:2}}>🕐 {e.time} Uhr</div>}
                  {e.note&&<div style={{fontSize:11,color:"#666",marginTop:2}}>{e.note}</div>}
                  {e.createdBy&&<div style={{fontSize:10,color:"#b89060",marginTop:3}}>👤 {e.createdBy}</div>}
                </div>
                {canAct&&(
                  <div style={{...S.row,gap:4,flexShrink:0}}>
                    <button onClick={()=>openEditEvt(e)} style={{background:"#f0e8d8",border:"none",cursor:"pointer",color:"#8b6040",padding:"4px 8px",borderRadius:6,fontSize:11}}>✏️</button>
                    <button onClick={()=>deleteEvent(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",padding:4}}><Ic n="x" s={14}/></button>
                  </div>
                )}
              </div>
            );
          };
          return (<>
            {upcoming.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:8}}>Keine bevorstehenden Termine</div>}
            {upcoming.map(renderEvent)}
            {past.length>0&&(
              <div style={{marginTop:4}}>
                <button onClick={()=>setShowPastEvents(p=>!p)}
                  style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:11,padding:"4px 0",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10}}>{showPastEvents?"▲":"▼"}</span>
                  {showPastEvents?"Vergangene Termine ausblenden":`${past.length} vergangene Termine`}
                </button>
                {showPastEvents&&(
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0e8d8",opacity:0.7}}>
                    {[...past].reverse().map(renderEvent)}
                  </div>
                )}
              </div>
            )}
          </>);
        })()}
      </div>

      <div style={S.card}>
        <div style={{...S.row,justifyContent:"space-between",marginBottom:10}}>
          <div style={S.cTitle}>🌴 Urlaube</div>
          <button style={{...S.btn("teal"),padding:"7px 12px",fontSize:11}} onClick={()=>openAddVacation(currentUser.id)}>+ Eigenen eintragen</button>
        </div>
        {(()=>{
          const vacMembers = isAdmin
            ? [...einstellerList,...members.filter(m=>m.type==="reitbeteiligung")]
            : currentUser.type==="einsteller"
              ? [currentUser,...members.filter(m=>m.type==="reitbeteiligung"&&m.einstellerId===currentUser.id)]
              : [currentUser];
          const todayStr = dk(today);
          const renderVac = (m, v) => {
            const canEdit=isAdmin||currentUser.id===m.id;
            const showName=isAdmin||(currentUser.type==="einsteller"&&m.id!==currentUser.id);
            return (
              <div key={v.id} style={{...S.row,justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid #f5f0e8"}}>
                <div style={{flex:1,minWidth:0}}>
                  {showName&&<div style={{fontSize:12,fontWeight:600,color:"#3d2b1f",marginBottom:2}}>{m.name.split(" ")[0]}</div>}
                  <div style={{fontSize:11,color:"#8b6040"}}>{fmtSh(new Date(v.from+"T00:00:00"))} – {fmtSh(new Date(v.to+"T00:00:00"))}</div>
                  {v.note&&<div style={{fontSize:10,color:"#aaa",marginTop:1}}>{v.note}</div>}
                  {v.mustCover&&<span style={{display:"inline-block",marginTop:3,fontSize:10,fontWeight:700,color:"#e74c3c",background:"#fdf0ee",padding:"1px 6px",borderRadius:10}}>🔴 Vertretung zwingend</span>}
                </div>
                {canEdit&&(
                  <div style={{...S.row,gap:4,flexShrink:0,marginLeft:8}}>
                    <button onClick={()=>openEditVac(m.id,v)} style={{background:"#f0e8d8",border:"none",cursor:"pointer",color:"#8b6040",padding:"4px 8px",borderRadius:6,fontSize:11}}>✏️</button>
                    <button onClick={()=>deleteVacation(m.id,v.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",padding:4}}><Ic n="trash" s={13}/></button>
                  </div>
                )}
              </div>
            );
          };
          const allVacs = vacMembers.flatMap(m=>(vacations[m.id]||[]).map(v=>({m,v})));
          const upcoming = allVacs.filter(({v})=>v.to>=todayStr).sort((a,b)=>a.v.from.localeCompare(b.v.from));
          const past     = allVacs.filter(({v})=>v.to<todayStr).sort((a,b)=>b.v.from.localeCompare(a.v.from));
          return (<>
            {upcoming.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:4}}>Keine bevorstehenden Urlaube</div>}
            {upcoming.map(({m,v})=>renderVac(m,v))}
            {past.length>0&&(
              <div style={{marginTop:4}}>
                <button onClick={()=>setShowPastVacations(p=>!p)}
                  style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:11,padding:"4px 0",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10}}>{showPastVacations?"▲":"▼"}</span>
                  {showPastVacations?"Vergangene Urlaube ausblenden":`${past.length} vergangene Urlaube`}
                </button>
                {showPastVacations&&(
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0e8d8",opacity:0.7}}>
                    {past.map(({m,v})=>renderVac(m,v))}
                  </div>
                )}
              </div>
            )}
          </>);
        })()}
        {isAdmin&&(
          <div style={{marginTop:8}}>
            <div style={{fontSize:11,color:"#aaa",marginBottom:6}}>Urlaub für andere eintragen:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {[...einstellerList,...members.filter(m=>m.type==="reitbeteiligung")].filter(m=>m.id!==currentUser.id).map(m=>(
                <button key={m.id} style={{...S.btn("light"),padding:"5px 10px",fontSize:11,borderRadius:8}} onClick={()=>openAddVacation(m.id)}>+ {m.name.split(" ")[0]}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAddVacation&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:4,color:"#3d2b1f"}}>🌴 Urlaub eintragen</div>
          <div style={{fontSize:11,color:"#8b6040",marginBottom:16}}>für: <b>{members.find(m=>m.id===vacTargetId)?.name}</b></div>
          <label style={S.label}>Von</label>
          <input type="date" style={S.input} value={newVac.from} onChange={e=>setNewVac(p=>({...p,from:e.target.value}))}/>
          <label style={S.label}>Bis</label>
          <input type="date" style={S.input} value={newVac.to} onChange={e=>setNewVac(p=>({...p,to:e.target.value}))}/>
          <label style={S.label}>Notiz (optional)</label>
          <input style={S.input} placeholder="z.B. Sommerurlaub" value={newVac.note} onChange={e=>setNewVac(p=>({...p,note:e.target.value}))}/>
          {isAdmin&&(
            <div onClick={()=>setNewVac(p=>({...p,mustCover:!p.mustCover}))}
              style={{...S.row,alignItems:"center",gap:12,marginTop:8,marginBottom:4,padding:"12px 14px",
                borderRadius:10,cursor:"pointer",border:`2px solid ${newVac.mustCover?"#e74c3c":"#e2d5c0"}`,
                background:newVac.mustCover?"#fdf0ee":"#faf6f0",transition:"all .2s"}}>
              <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${newVac.mustCover?"#e74c3c":"#ccc"}`,
                background:newVac.mustCover?"#e74c3c":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {newVac.mustCover&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:newVac.mustCover?"#e74c3c":"#3d2b1f"}}>🔴 Vertretung zwingend erforderlich</div>
                <div style={{fontSize:10,color:"#8b6040",marginTop:1}}>Einsteller werden im Mistplan stark hervorgehoben</div>
              </div>
            </div>
          )}
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btn("light")} onClick={()=>setShowAddVacation(false)}>Abbrechen</button>
            <button style={S.btn("teal")} onClick={addVacation}>Eintragen</button>
          </div>
        </div></div>
      )}

      {editVac&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:4,color:"#3d2b1f"}}>✏️ Urlaub bearbeiten</div>
          <div style={{fontSize:11,color:"#8b6040",marginBottom:16}}>für: <b>{members.find(m=>m.id===editVac.memberId)?.name}</b></div>
          <label style={S.label}>Von</label>
          <input type="date" style={S.input} value={editForm.from} onChange={e=>setEditForm(p=>({...p,from:e.target.value}))}/>
          <label style={S.label}>Bis</label>
          <input type="date" style={S.input} value={editForm.to} onChange={e=>setEditForm(p=>({...p,to:e.target.value}))}/>
          <label style={S.label}>Notiz (optional)</label>
          <input style={S.input} placeholder="z.B. Sommerurlaub" value={editForm.note} onChange={e=>setEditForm(p=>({...p,note:e.target.value}))}/>
          {isAdmin&&(
            <div onClick={()=>setEditForm(p=>({...p,mustCover:!p.mustCover}))}
              style={{...S.row,alignItems:"center",gap:12,marginTop:8,marginBottom:4,padding:"12px 14px",
                borderRadius:10,cursor:"pointer",border:`2px solid ${editForm.mustCover?"#e74c3c":"#e2d5c0"}`,
                background:editForm.mustCover?"#fdf0ee":"#faf6f0",transition:"all .2s"}}>
              <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${editForm.mustCover?"#e74c3c":"#ccc"}`,
                background:editForm.mustCover?"#e74c3c":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {editForm.mustCover&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:editForm.mustCover?"#e74c3c":"#3d2b1f"}}>🔴 Vertretung zwingend erforderlich</div>
                <div style={{fontSize:10,color:"#8b6040",marginTop:1}}>Einsteller werden im Mistplan stark hervorgehoben</div>
              </div>
            </div>
          )}
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btn("light")} onClick={()=>setEditVac(null)}>Abbrechen</button>
            <button style={S.btn("teal")} onClick={saveEditVac}>💾 Speichern</button>
          </div>
        </div></div>
      )}

      {editEvt&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:16,color:"#3d2b1f"}}>✏️ Termin bearbeiten</div>
          <label style={S.label}>Typ</label>
          <select style={S.input} value={editEvtForm.type} onChange={e=>setEditEvtForm(p=>({...p,type:e.target.value}))}>
            {EVENT_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <label style={S.label}>Datum</label>
          <input type="date" style={S.input} value={editEvtForm.date} onChange={e=>setEditEvtForm(p=>({...p,date:e.target.value}))}/>
          <label style={S.label}>Uhrzeit</label>
          <input type="time" style={S.input} value={editEvtForm.time} onChange={e=>setEditEvtForm(p=>({...p,time:e.target.value}))}/>
          <label style={S.label}>Notiz</label>
          <input style={S.input} placeholder="z.B. Alle Pferde" value={editEvtForm.note} onChange={e=>setEditEvtForm(p=>({...p,note:e.target.value}))}/>
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btn("light")} onClick={()=>setEditEvt(null)}>Abbrechen</button>
            <button style={S.btn("primary")} onClick={saveEditEvt}>💾 Speichern</button>
          </div>
        </div></div>
      )}

      {/* ── RB Besuche ── */}
      {(currentUser.type==="reitbeteiligung"||(isAdmin&&members.some(m=>m.type==="reitbeteiligung"&&m.einstellerId===currentUser.id))||(currentUser.type==="einsteller"&&members.some(m=>m.type==="reitbeteiligung"&&m.einstellerId===currentUser.id)))&&(
        <div style={S.card}>
          <div style={{...S.row,justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={S.cTitle}>🐎 Besuche am Pferd</div>
            <div style={{...S.row,gap:6}}>
              {isAdmin&&(
                <button style={{...S.btn("primary"),padding:"7px 12px",fontSize:11}}
                  onClick={()=>{
                    const myRbs=members.filter(m=>m.type==="reitbeteiligung"&&m.einstellerId===currentUser.id);
                    setNewVisit({date:"",note:"",isLesson:true,targetId:myRbs[0]?.id||null});
                    setShowAddVisit(true);
                  }}>🎓 Reitunterricht</button>
              )}
              {isAdmin&&(
                <button style={{...S.btn("light"),padding:"7px 12px",fontSize:11}}
                  onClick={()=>{setBlockDate("");setShowBlockPicker(true);}}>🚫 Für RB sperren</button>
              )}
              {currentUser.type==="reitbeteiligung"&&(
                <button style={{...S.btn("teal"),padding:"7px 12px",fontSize:11}}
                  onClick={()=>{setNewVisit({date:"",note:"",isLesson:false,targetId:currentUser.id});setShowAddVisit(true);}}>+ Besuch</button>
              )}
            </div>
          </div>
          {visibleVisits.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:8}}>Noch keine Besuche eingetragen</div>}
          {visibleVisits.map(v=>{
            const rb = members.find(m=>m.id===v.memberId);
            const canAct = currentUser.id===v.memberId || isAdmin;
            return (
              <div key={v.id} style={{...S.row,alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid #f5f0e8"}}>
                <div style={{width:4,alignSelf:"stretch",borderRadius:4,background:v.isLesson?"#8e44ad":"#9b59b6",flexShrink:0,marginRight:10}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{...S.row,justifyContent:"space-between"}}>
                    <span style={{fontWeight:600,fontSize:13,color:"#2c2416"}}>{v.isLesson?"🎓 Reitunterricht":"🐎 Besuch"}</span>
                    <span style={{fontSize:10,color:"#8b6040"}}>{new Date(v.date+"T00:00:00").toLocaleDateString("de-DE",{day:"2-digit",month:"short",year:"numeric"})}</span>
                  </div>
                  {(isAdmin||currentUser.type==="einsteller")&&rb&&<div style={{fontSize:10,color:"#8b6040",marginTop:1}}>👤 {rb.name.split(" ")[0]}</div>}
                  {v.note&&<div style={{fontSize:11,color:"#666",marginTop:2}}>{v.note}</div>}
                </div>
                {canAct&&(
                  <div style={{...S.row,gap:4,flexShrink:0,marginLeft:6}}>
                    {/* Admin can toggle lesson flag */}
                    {isAdmin&&<button onClick={async()=>{await updateRbVisit(v.id,{...v,isLesson:!v.isLesson});}} style={{background:v.isLesson?"#e8d5f5":"#f0e8d8",border:"none",cursor:"pointer",color:v.isLesson?"#8e44ad":"#8b6040",padding:"4px 8px",borderRadius:6,fontSize:11}} title={v.isLesson?"Als Besuch markieren":"Als Reitunterricht markieren"}>{v.isLesson?"🐎":"🎓"}</button>}
                    <button onClick={()=>openEditVisit(v)} style={{background:"#f0e8d8",border:"none",cursor:"pointer",color:"#8b6040",padding:"4px 8px",borderRadius:6,fontSize:11}}>✏️</button>
                    <button onClick={()=>deleteRbVisit(v.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",padding:4}}><Ic n="trash" s={13}/></button>
                  </div>
                )}
              </div>
            );
          })}
          {/* Gesperrte Tage — nur Admin sieht + verwaltet sie */}
          {isAdmin&&(()=>{
            const myBlocked = (blockedDays||[]).filter(b=>b.adminId===currentUser.id).sort((a,b)=>a.date.localeCompare(b.date));
            if(myBlocked.length===0) return null;
            return (
              <div style={{marginTop:12,borderTop:"1px solid #f0e8d8",paddingTop:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"#c0392b",marginBottom:6}}>🚫 Für RB gesperrte Tage</div>
                {myBlocked.map(b=>(
                  <div key={b.id} style={{...S.row,justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f5f0e8"}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:600,color:"#c0392b"}}>{new Date(b.date+"T00:00:00").toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"short"})}</span>
                      {b.note&&<span style={{fontSize:10,color:"#aaa",marginLeft:6}}>{b.note}</span>}
                    </div>
                    <button onClick={()=>deleteBlockedDay(b.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",padding:4}}><Ic n="trash" s={13}/></button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Add visit modal */}
      {showAddVisit&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:4,color:"#3d2b1f"}}>
            {newVisit.isLesson?"🎓 Reitunterricht eintragen":"🐎 Besuch eintragen"}
          </div>
          <div style={{fontSize:11,color:"#8b6040",marginBottom:16}}>
            {newVisit.isLesson?"Reitunterricht für deine Reitbeteiligung":"Wann kommst du zum Pferd?"}
          </div>
          {/* RB selector for admin */}
          {isAdmin&&(()=>{
            const myRbs=members.filter(m=>m.type==="reitbeteiligung"&&m.einstellerId===currentUser.id);
            if(myRbs.length<=1) return null;
            return (<>
              <label style={S.label}>Reitbeteiligung</label>
              <select style={S.input} value={newVisit.targetId||""} onChange={e=>setNewVisit(p=>({...p,targetId:parseInt(e.target.value)}))}>
                {myRbs.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </>);
          })()}
          <label style={S.label}>Datum</label>
          <input type="date" style={S.input} value={newVisit.date} onChange={e=>setNewVisit(p=>({...p,date:e.target.value}))}/>
          <label style={S.label}>Notiz (optional)</label>
          <input style={S.input} placeholder={newVisit.isLesson?"z.B. Dressur, Springen...":"z.B. Ausritt, Training..."} value={newVisit.note} onChange={e=>setNewVisit(p=>({...p,note:e.target.value}))}/>
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btn("light")} onClick={()=>setShowAddVisit(false)}>Abbrechen</button>
            <button style={S.btn(newVisit.isLesson?"primary":"teal")} onClick={()=>{
              const targetId = isAdmin ? (newVisit.targetId||members.find(m=>m.type==="reitbeteiligung"&&m.einstellerId===currentUser.id)?.id) : currentUser.id;
              if(targetId) addRbVisit(targetId);
            }}>Eintragen</button>
          </div>
        </div></div>
      )}

      {/* Edit visit modal */}
      {editVisit&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:16,color:"#3d2b1f"}}>✏️ Besuch bearbeiten</div>
          <label style={S.label}>Datum</label>
          <input type="date" style={S.input} value={editVisitForm.date} onChange={e=>setEditVisitForm(p=>({...p,date:e.target.value}))}/>
          <label style={S.label}>Notiz (optional)</label>
          <input style={S.input} placeholder="z.B. Ausritt, Training..." value={editVisitForm.note} onChange={e=>setEditVisitForm(p=>({...p,note:e.target.value}))}/>
          {isAdmin&&(
            <div onClick={()=>setEditVisitForm(p=>({...p,isLesson:!p.isLesson}))}
              style={{...S.row,alignItems:"center",gap:12,marginTop:8,marginBottom:4,padding:"12px 14px",
                borderRadius:10,cursor:"pointer",border:`2px solid ${editVisitForm.isLesson?"#8e44ad":"#e2d5c0"}`,
                background:editVisitForm.isLesson?"#f5eefa":"#faf6f0",transition:"all .2s"}}>
              <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${editVisitForm.isLesson?"#8e44ad":"#ccc"}`,
                background:editVisitForm.isLesson?"#8e44ad":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {editVisitForm.isLesson&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:editVisitForm.isLesson?"#8e44ad":"#3d2b1f"}}>🎓 Reitunterricht</div>
                <div style={{fontSize:10,color:"#8b6040",marginTop:1}}>Als Reitunterricht markieren</div>
              </div>
            </div>
          )}
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btn("light")} onClick={()=>setEditVisit(null)}>Abbrechen</button>
            <button style={S.btn("teal")} onClick={saveEditVisit}>💾 Speichern</button>
          </div>
        </div></div>
      )}

      {/* Block day modal */}
      {showBlockPicker&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:4,color:"#3d2b1f"}}>🚫 Für RB sperren</div>
          <div style={{fontSize:11,color:"#8b6040",marginBottom:16}}>Dieser Tag wird für die Reitbeteiligung gesperrt</div>
          <label style={S.label}>Datum</label>
          <input type="date" style={S.input} value={blockDate} onChange={e=>setBlockDate(e.target.value)}/>
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btn("light")} onClick={()=>setShowBlockPicker(false)}>Abbrechen</button>
            <button style={{...S.btn("primary"),background:"#8e44ad",borderColor:"#8e44ad"}} onClick={async()=>{
              if(!blockDate) return;
              await addBlockedDay(blockDate);
              setShowBlockPicker(false);
            }}>🔒 Sperren</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

// ── Mist Split Widget ────────────────────────────────────────────────────────
function MistSplitWidget({ currentUser, rbs, vacations, viewYear, viewMonth, saveMemberEdit, showToast }) {
  const isAdminUser  = currentUser.type==="admin";
  const [open, setOpen]   = useState(false);
  const initMode = isAdminUser ? "fixed_rb" : (currentUser.mistMode||"percent");
  const initVal  = isAdminUser ? (currentUser.mistShare??2) : (currentUser.mistShare??50);
  const [mode, setMode]   = useState(initMode);
  const [value, setValue] = useState(initVal);

  const weeks        = getWeeksInMonth(viewYear, viewMonth);
  const totalMonthly = weeks.length * 2;
  const monthLabel   = new Date(viewYear, viewMonth, 1).toLocaleDateString("de-DE",{month:"long"});

  // Sync after save
  useEffect(() => {
    const m = isAdminUser ? "fixed_rb" : (currentUser.mistMode||"percent");
    setMode(m);
    if(isAdminUser) setValue(currentUser.mistShare??2);
    else setValue(m==="percent" ? Math.round((currentUser.mistShare??50)/10)*10 : currentUser.mistShare??50);
  }, [currentUser.mistMode, currentUser.mistShare]);

  const getDisplayCounts = (m, v) => {
    if(m==="percent") { const my=Math.round(totalMonthly*v/100); return {my, rb:totalMonthly-my}; }
    if(m==="fixed_e") { return {my:v, rb:Math.max(0,totalMonthly-v)}; }
    if(m==="fixed_rb") { const rbTotal=v*rbs.length; return {my:Math.max(0,totalMonthly-rbTotal), rb:v}; }
    return {my:0, rb:0};
  };

  const current = getDisplayCounts(isAdminUser?"fixed_rb":(currentUser.mistMode||"percent"), currentUser.mistShare??50);
  const preview = getDisplayCounts(mode, value);

  const handleOpen = () => {
    const m = isAdminUser ? "fixed_rb" : (currentUser.mistMode||"percent");
    setMode(m);
    if(isAdminUser) setValue(currentUser.mistShare??2);
    else setValue(m==="percent" ? Math.round((currentUser.mistShare??50)/10)*10 : currentUser.mistShare??50);
    setOpen(true);
  };

  const handleSave = async () => {
    await saveMemberEdit(currentUser.id, {...currentUser, mistShare: value, mistMode: mode, einstellerId: currentUser.einstellerId||""});
    setOpen(false);
  };

  const MODES = isAdminUser ? [] : [
    { key:"percent",  label:"% Aufteilung",    icon:"⚖️" },
    { key:"fixed_e",  label:"Meine Dienste",   icon:"🐴" },
    { key:"fixed_rb", label:"Reitbet. Dienste",icon:"🤝" },
  ];

  const maxVal = isAdminUser ? 10 : (mode==="percent" ? 100 : totalMonthly);
  const minVal = 0;
  const step   = mode==="percent" ? 10 : 1;

  return (
    <>
      <div style={{marginTop:14,borderTop:"1px solid #f0e8d8",paddingTop:12}}>
        <div style={{fontSize:12,fontWeight:700,color:"#3d2b1f",marginBottom:2}}>
          {isAdminUser ? "🤝 Mistdienste Reitbeteiligung" : `⚖️ Aufteilung ${monthLabel}`}
        </div>
        <div style={{fontSize:11,color:"#8b6040"}}>
          {isAdminUser
            ? <>{rbs.map(rb=><span key={rb.id}>{rb.name.split(" ")[0]}: <b>{current.rb}×</b> / Monat · </span>)}</>
            : <>Du: <b>{current.my}×</b> · Reitbet.: <b>{rbs.length>1?`${(current.rb/rbs.length).toFixed(1)}× je`:`${current.rb}×`}</b> (von {totalMonthly} gesamt)</>
          }
        </div>
      </div>

      <div style={{marginTop:10,background:"#faf6f0",borderRadius:10,padding:"12px 14px",border:"1px solid #e2d5c0"}}>
        <div style={{...S.row,justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#3d2b1f"}}>📅 Dauereinstellung</div>
            <div style={{fontSize:10,color:"#8b6040"}}>Gilt für alle Monate</div>
          </div>
          <button onClick={handleOpen} style={{...S.btn("light"),padding:"6px 12px",fontSize:12}}>✏️ Anpassen</button>
        </div>
        <div style={{...S.row,gap:6}}>
          {!isAdminUser&&(
            <>
              <div style={{flex:1,textAlign:"center",padding:"8px 4px",background:"#fff",borderRadius:8,border:"1.5px solid #c8913a"}}>
                <div style={{fontSize:10,color:"#8b6040",marginBottom:2}}>Du</div>
                <div style={{fontSize:20,fontWeight:700,color:"#c8913a"}}>{current.my}×</div>
                <div style={{fontSize:9,color:"#aaa"}}>/ Monat</div>
              </div>
              <div style={{display:"flex",alignItems:"center",fontSize:16,color:"#ccc",padding:"0 2px"}}>⟷</div>
            </>
          )}
          {rbs.map(rb=>(
            <div key={rb.id} style={{flex:1,textAlign:"center",padding:"8px 4px",background:"#fff",borderRadius:8,border:"1.5px solid #a8d8c8"}}>
              <div style={{fontSize:10,color:"#16a085",marginBottom:2}}>{rb.name.split(" ")[0]}</div>
              <div style={{fontSize:20,fontWeight:700,color:"#16a085"}}>{(current.rb/rbs.length).toFixed(1)}×</div>
              <div style={{fontSize:9,color:"#aaa"}}>/ Monat</div>
            </div>
          ))}
        </div>
      </div>

      {open&&(
        <div style={S.modal}><div style={{...S.mBox,maxWidth:360}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:12,color:"#3d2b1f"}}>
            {isAdminUser ? "Mistdienste Reitbeteiligung" : "Aufteilung anpassen"}
          </div>

          {/* Mode selector — only for non-admin */}
          {!isAdminUser&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:18}}>
              {MODES.map(m=>(
                <button key={m.key} onClick={()=>{ setMode(m.key); setValue(m.key==="percent"?Math.round((currentUser.mistShare??50)/10)*10:m.key==="fixed_e"?Math.round(totalMonthly/2):Math.round(totalMonthly/2/rbs.length)); }}
                  style={{padding:"10px 4px",borderRadius:10,border:`2px solid ${mode===m.key?"#c8913a":"#e2d5c0"}`,
                    background:mode===m.key?"#fef3e2":"#fff",cursor:"pointer",textAlign:"center",
                    color:mode===m.key?"#c8913a":"#8b6040",fontSize:10,fontWeight:mode===m.key?700:400,transition:"all .15s"}}>
                  <div style={{fontSize:16,marginBottom:3}}>{m.icon}</div>
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Mode description */}
          <div style={{fontSize:11,color:"#8b6040",background:"#faf6f0",borderRadius:8,padding:"8px 12px",marginBottom:16}}>
            {isAdminUser && `Wie viele Mistdienste soll die Reitbeteiligung pro Monat erledigen?`}
            {!isAdminUser&&mode==="percent" && "Aufteilung in Prozent — passt sich automatisch an Monate mit mehr/weniger Wochen an."}
            {!isAdminUser&&mode==="fixed_e" && "Ich mache jeden Monat genau X Dienste — der Rest geht an die Reitbeteiligung."}
            {!isAdminUser&&mode==="fixed_rb" && "Die Reitbeteiligung macht jeden Monat genau X Dienste — der Rest geht an mich."}
          </div>

          {/* Visual split bar */}
          <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",marginBottom:16,background:"#f0e8d8"}}>
            {!isAdminUser&&<div style={{flex:preview.my||0.001,background:"#c8913a",transition:"flex .2s",borderRadius:preview.my===0?"0":"10px 0 0 10px"}}/>}
            <div style={{flex:preview.rb||0.001,background:"#a8d8c8",transition:"flex .2s",borderRadius:isAdminUser||preview.my===0?"10px":"0 10px 10px 0"}}/>
          </div>

          {/* Value input */}
          <div style={{...S.row,justifyContent:"space-between",alignItems:"center",marginBottom:12,padding:"12px 14px",background:"#f0faf6",borderRadius:10,border:"1.5px solid #a8d8c8"}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#3d2b1f"}}>
                {isAdminUser ? "Dienste RB / Monat" : mode==="percent"?"Mein Anteil":mode==="fixed_e"?"Meine Dienste / Monat":"Dienste RB / Monat"}
              </div>
              <div style={{fontSize:11,color:"#8b6040",marginTop:2}}>
                {isAdminUser && `${rbs.map(rb=>rb.name.split(" ")[0]).join(" & ")} je ${value}× im ${monthLabel}`}
                {!isAdminUser&&mode==="percent" && `= ${preview.my} Dienste im ${monthLabel}`}
                {!isAdminUser&&mode==="fixed_e" && `RB bekommt ${preview.rb} Dienste im ${monthLabel}`}
                {!isAdminUser&&mode==="fixed_rb" && `Ich mache ${preview.my} Dienste im ${monthLabel}`}
              </div>
            </div>
            <div style={{...S.row,gap:10,alignItems:"center"}}>
              <button onClick={()=>setValue(v=>Math.max(minVal,v-step))} disabled={value<=minVal}
                style={{width:34,height:34,borderRadius:17,border:"none",background:value>minVal?"#e2d5c0":"#f5f0e8",
                  cursor:value>minVal?"pointer":"default",fontSize:20,color:"#3d2b1f",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <div style={{minWidth:42,textAlign:"center",fontWeight:700,fontSize:20,color:"#16a085"}}>
                {value}{mode==="percent"?"%":"×"}
              </div>
              <button onClick={()=>setValue(v=>Math.min(maxVal,v+step))} disabled={value>=maxVal}
                style={{width:34,height:34,borderRadius:17,border:"none",background:value<maxVal?"#e2d5c0":"#f5f0e8",
                  cursor:value<maxVal?"pointer":"default",fontSize:20,color:"#3d2b1f",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
            </div>
          </div>

          {/* Result preview */}
          <div style={{...S.row,gap:6,marginBottom:16}}>
            {!isAdminUser&&(
              <div style={{flex:1,textAlign:"center",padding:"8px",background:"#fef3e2",borderRadius:8,border:"1px solid #c8913a"}}>
                <div style={{fontSize:10,color:"#8b6040"}}>Du ({monthLabel})</div>
                <div style={{fontSize:18,fontWeight:700,color:"#c8913a"}}>{preview.my}×</div>
              </div>
            )}
            {rbs.map(rb=>(
              <div key={rb.id} style={{flex:1,textAlign:"center",padding:"8px",background:"#f0faf6",borderRadius:8,border:"1px solid #a8d8c8"}}>
                <div style={{fontSize:10,color:"#16a085"}}>{rb.name.split(" ")[0]}</div>
                <div style={{fontSize:18,fontWeight:700,color:"#16a085"}}>{(preview.rb/rbs.length).toFixed(1)}×</div>
              </div>
            ))}
          </div>

          <div style={{...S.row,justifyContent:"flex-end",gap:8}}>
            <button style={S.btn("light")} onClick={()=>setOpen(false)}>Abbrechen</button>
            <button style={S.btn("primary")} onClick={handleSave}>💾 Speichern</button>
          </div>
        </div></div>
      )}
    </>
  );
}

function MistScreen({ currentUser, isAdmin, members, mistData, vacations, einstellerList, weekDates, weekOffset, setWeekOffset, toggleMist, isMistLocked, saveMemberEdit, showToast }) {
  const [adminView,   setAdminView]   = useState("month");
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate  = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const viewYear  = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString("de-DE",{month:"long",year:"numeric"});

  const daysInMonth = () => {
    const days = []; const d = new Date(viewYear, viewMonth, 1);
    while(d.getMonth()===viewMonth){ days.push(new Date(d)); d.setDate(d.getDate()+1); }
    return days;
  };

  const adminRows=[];
  einstellerList.forEach(e=>{
    adminRows.push({member:e,isChild:false});
    members.filter(m=>m.einstellerId===e.id).forEach(rb=>adminRows.push({member:rb,isChild:true}));
  });

  return (
    <div>
      {!isAdmin&&(
        <div style={S.card}>
          <div style={{...S.row,justifyContent:"space-between",marginBottom:12}}>
            <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setMonthOffset(o=>o-1)}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#3d2b1f"}}>{monthLabel}</div>
              {monthOffset===0&&<div style={{fontSize:10,color:"#c8913a",fontWeight:600}}>DIESER MONAT</div>}
            </div>
            <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setMonthOffset(o=>o+1)}>›</button>
          </div>
          {(()=>{
            const mQ=getMonthlyQuota(currentUser,members,vacations,viewYear,viewMonth);
            const mC=countMistMonth(mistData,currentUser.id,viewYear,viewMonth);
            const nextMonthDate = new Date(today.getFullYear(), today.getMonth()+1, 1);
            const isNextMonth = viewYear===nextMonthDate.getFullYear() && viewMonth===nextMonthDate.getMonth();
            const freezeDay = 14;
            const daysLeft = isNextMonth ? freezeDay - today.getDate() : null;
            const showWarning = daysLeft !== null && daysLeft >= 0 && mC < mQ;
            const freezeDate = new Date(today.getFullYear(), today.getMonth(), freezeDay);
            const freezeLabel = freezeDate.toLocaleDateString("de-DE",{day:"numeric",month:"long"});
            return (<>
              <div style={{...S.row,justifyContent:"space-between",background:"#faf6f0",borderRadius:10,padding:"10px 14px",marginBottom:showWarning?8:12}}>
                <div>
                  <div style={{fontSize:12,color:"#8b6040"}}>Mein Monatssoll</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:mC>=mQ?"#27ae60":"#c0392b",fontWeight:700}}>{mC}<span style={{fontSize:13,color:"#aaa"}}>/{mQ}×</span>{mC>mQ&&<span style={{fontSize:12,color:"#c8913a",marginLeft:4}}>🌟</span>}</div>
                </div>
                <div style={{fontSize:24}}>{mC>=mQ?"✅":"⏳"}</div>
              </div>
              {showWarning&&(
                <div style={{background:daysLeft<=2?"#fdecea":"#fef9ec",border:`1.5px solid ${daysLeft<=2?"#f5c0c0":"#f0d080"}`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{fontSize:20}}>{daysLeft===0?"🔔":daysLeft<=2?"⚠️":"⏰"}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:daysLeft<=2?"#922b21":"#7d6008"}}>
                      {daysLeft===0?"Heute ist der letzte Tag!":daysLeft===1?"Noch 1 Tag zum Eintragen!":`Noch ${daysLeft} Tage zum Eintragen`}
                    </div>
                    <div style={{fontSize:11,color:daysLeft<=2?"#c0392b":"#9a7d0a",marginTop:1}}>
                      Bitte bis {freezeLabel} deinen Mistdienst eintragen
                    </div>
                  </div>
                </div>
              )}
            </>);
          })()}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
            {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:9,color:"#8b6040",fontWeight:700,paddingBottom:4}}>{d}</div>
            ))}
            {Array.from({length:(new Date(viewYear,viewMonth,1).getDay()||7)-1}).map((_,i)=><div key={"e"+i}/>)}
            {daysInMonth().map(d=>{
              const k            = dkl(d);
              const checked      = (mistData[k]||[]).includes(currentUser.id);
              const isToday      = k===dk(today);
              const onVac        = isOnVacationDay(currentUser.id,k,vacations);
              const takenByOther = (mistData[k]||[]).some(id=>id!==currentUser.id);
              const locked       = isMistLocked(k);
              const canClick     = !onVac && !takenByOther && !locked;
              const coverNeeded  = !onVac && !checked ? getVacCoverDay(k, vacations, members, currentUser.id) : null;
              // Styling logic
              let bg, border, pulse=false;
              if(onVac)            { bg="#e8f8f5"; border="2px solid #a8e6cf"; }
              else if(checked)     { bg="#c8913a"; border="2px solid #a07030"; }
              else if(coverNeeded==="must") { bg="#fff3f0"; border="2px solid #e74c3c"; pulse=true; }
              else if(coverNeeded==="soft") { bg="#fffbf0"; border="1.5px dashed #f0c060"; }
              else if(takenByOther){ bg="#fdecea"; border="2px solid #f5c0c0"; }
              else if(locked)      { bg="#f5f0e8"; border="1px solid #e2d5c0"; }
              else                 { bg="#fff";    border="1px solid #e2d5c0"; }
              return (
                <div key={k} onClick={()=>canClick&&toggleMist(k,currentUser.id)}
                  style={{
                    aspectRatio:"1",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    cursor:canClick?"pointer":"default", background:bg, border,
                    opacity:locked&&!checked&&!coverNeeded?0.6:1, transition:"all .15s",
                    boxShadow:pulse?"0 0 0 2px #e74c3c44":coverNeeded==="soft"?"0 0 0 1px #f0c06022":"none",
                    position:"relative"
                  }}>
                  <div style={{fontSize:11,fontWeight:isToday?700:400,
                    color:checked?"#fff":coverNeeded==="must"?"#c0392b":takenByOther?"#c0392b":onVac?"#16a085":"#2c2416"}}>
                    {d.getDate()}
                  </div>
                  {onVac&&<div style={{fontSize:8}}>🌴</div>}
                  {!onVac&&checked&&<div style={{fontSize:8,color:"#fff"}}>✓</div>}
                  {!onVac&&!checked&&coverNeeded==="must"&&<div style={{fontSize:8,color:"#e74c3c",fontWeight:700}}>🔴</div>}
                  {!onVac&&!checked&&coverNeeded==="soft"&&<div style={{fontSize:8,color:"#c8913a"}}>🌴</div>}
                  {!onVac&&!checked&&!coverNeeded&&takenByOther&&<div style={{fontSize:8,color:"#c0392b"}}>✗</div>}
                  {!onVac&&!checked&&!coverNeeded&&!takenByOther&&locked&&<div style={{fontSize:8,color:"#aaa"}}>🔒</div>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,fontSize:10,color:"#aaa",marginTop:6}}>
            <span>✓ = Eingetragen</span>
            <span style={{color:"#c0392b"}}>✗ = Tag vergeben</span>
            <span>🌴 = Urlaub</span>
            <span style={{color:"#e74c3c",fontWeight:600}}>🔴 = Vertretung nötig</span>
            <span>🔒 = Gesperrt</span>
          </div>
          {/* Aufteilung anpassen — nur wenn Reitbeteiligungen vorhanden */}
          {(()=>{
            const rbs = members.filter(rb=>rb.einstellerId===currentUser.id);
            if(rbs.length===0) return null;
            return (
              <MistSplitWidget currentUser={currentUser} rbs={rbs} members={members} vacations={vacations} viewYear={viewYear} viewMonth={viewMonth} saveMemberEdit={saveMemberEdit} showToast={showToast}/>
            );
          })()}
        </div>
      )}

      {isAdmin&&(
        <div style={S.card}>
          <div style={{...S.row,justifyContent:"center",gap:6,marginBottom:14}}>
            <button onClick={()=>setAdminView("week")} style={{...S.btn(adminView==="week"?"primary":"light"),padding:"6px 16px",fontSize:12}}>📅 Woche</button>
            <button onClick={()=>setAdminView("month")} style={{...S.btn(adminView==="month"?"primary":"light"),padding:"6px 16px",fontSize:12}}>📆 Monat</button>
          </div>

          {adminView==="week"&&(<>
            <div style={{...S.row,justifyContent:"space-between",marginBottom:12}}>
              <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setWeekOffset(w=>w-1)}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:"#3d2b1f"}}>{fmt(weekDates[0])} – {fmt(weekDates[6])}</div>
                {weekOffset===0&&<div style={{fontSize:10,color:"#c8913a",fontWeight:600}}>DIESE WOCHE</div>}
              </div>
              <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setWeekOffset(w=>w+1)}>›</button>
            </div>
            <div style={S.divider}/>
            <div style={{display:"grid",gridTemplateColumns:"96px repeat(7,1fr)",gap:2,marginBottom:6}}>
              <div/>
              {weekDates.map(d=>(
                <div key={dk(d)} style={{textAlign:"center",fontSize:9,color:"#8b6040",fontWeight:600,lineHeight:1.3}}>
                  {d.toLocaleDateString("de-DE",{weekday:"short"})}<br/>{d.getDate()}
                </div>
              ))}
            </div>
            {adminRows.map(({member:m,isChild})=>{
              const mYear=weekDates[0].getFullYear(); const mMonth=weekDates[0].getMonth();
              const monthQ=getMonthlyQuota(m,members,vacations,mYear,mMonth);
              const monthC=countMistMonth(mistData,m.id,mYear,mMonth);
              const ok=monthC>=monthQ;
              const onVacWeek=getMemberWeekQuota(m,dk(weekDates[0]),members,vacations)===0;
              const isMe=currentUser.id===m.id;
              return (
                <div key={m.id} style={{marginBottom:4}}>
                  <div style={{display:"grid",gridTemplateColumns:"96px repeat(7,1fr)",gap:2,alignItems:"center"}}>
                    <div style={{paddingLeft:isChild?10:0}}>
                      {isChild&&<div style={{fontSize:8,color:"#b89060",marginBottom:1}}>↳ Beteil.</div>}
                      <div style={{fontSize:11,fontWeight:isMe?700:500,color:isMe?"#c8913a":"#2c2416",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name.split(" ")[0]}</div>
                      {m.type==="admin"&&m.einstellerId===null?null:onVacWeek?<div style={{fontSize:9,color:"#16a085",fontWeight:600}}>🌴 Urlaub</div>
                        :<div style={{fontSize:9,color:ok?"#27ae60":"#c0392b",fontWeight:600}}>{monthC}/{monthQ}Mo</div>}
                    </div>
                    {weekDates.map(d=>{
                      const k=dkl(d); const checked=(mistData[k]||[]).includes(m.id);
                      const isPast=d<new Date(dk(today)); const onVac=isOnVacationDay(m.id,k,vacations);
                      const takenByOther=(mistData[k]||[]).some(id=>id!==m.id);
                      return (
                        <div key={k} onClick={()=>toggleMist(k,m.id)}
                          style={{height:30,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                            background:onVac?"#e8f8f5":checked?"#c8913a":takenByOther?"#fdecea":isPast?"#f5f0e8":"#faf6f0",
                            border:checked?"2px solid #a07030":onVac?"2px solid #a8e6cf":takenByOther?"2px solid #f5c0c0":isMe&&!isPast?"2px solid #c8913a55":"2px solid #e2d5c0",
                            transition:"all .15s"}}>
                          {onVac&&<span style={{fontSize:10}}>🌴</span>}
                          {!onVac&&checked&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
                          {!onVac&&!checked&&takenByOther&&<span style={{fontSize:9,color:"#c0392b"}}>✗</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:8,fontSize:10,color:"#aaa"}}>
              <span>✓ = Eingetragen</span><span>🌴 = Urlaub</span>
              <span style={{color:"#c0392b"}}>✗ = Tag vergeben</span>
              <span style={{color:"#c8913a",fontWeight:600}}>Mo = Monatssoll</span>
            </div>
            {(()=>{
              const adminRbs = members.filter(rb=>rb.type==="reitbeteiligung"&&rb.einstellerId===currentUser.id);
              if(adminRbs.length===0) return null;
              const wy = weekDates[0].getFullYear(); const wm = weekDates[0].getMonth();
              return <MistSplitWidget currentUser={currentUser} rbs={adminRbs} members={members} vacations={vacations} viewYear={wy} viewMonth={wm} saveMemberEdit={saveMemberEdit} showToast={showToast}/>;
            })()}
          </>)}

          {adminView==="month"&&(<>
            <div style={{...S.row,justifyContent:"space-between",marginBottom:12}}>
              <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setMonthOffset(o=>o-1)}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#3d2b1f"}}>{monthLabel}</div>
                {monthOffset===0&&<div style={{fontSize:10,color:"#c8913a",fontWeight:600}}>DIESER MONAT</div>}
              </div>
              <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>setMonthOffset(o=>o+1)}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:8}}>
              {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=>(
                <div key={d} style={{textAlign:"center",fontSize:9,color:"#8b6040",fontWeight:700,paddingBottom:3}}>{d}</div>
              ))}
              {Array.from({length:(new Date(viewYear,viewMonth,1).getDay()||7)-1}).map((_,i)=><div key={"e"+i}/>)}
              {daysInMonth().map(d=>{
                const k=dkl(d); const bookedIds=mistData[k]||[]; const isToday=k===dkl(today);
                const isPast=d<new Date(dk(today)); const hasEntry=bookedIds.length>0;
                const myEntry=bookedIds.includes(currentUser.id);
                const bookedMember=hasEntry?members.find(m=>m.id===bookedIds[0]):null;
                const vacMembers=[...einstellerList,...members.filter(m=>m.type==="reitbeteiligung")].filter(m=>isOnVacationDay(m.id,k,vacations));
                const someoneOnVac=vacMembers.length>0;
                const canClick=!hasEntry||myEntry; // admin can click free days or own entry
                return (
                  <div key={k} onClick={()=>canClick&&toggleMist(k,currentUser.id)}
                    style={{aspectRatio:"1",borderRadius:7,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    background:myEntry?"#3d2b1f":hasEntry?"#c8913a":someoneOnVac?"#f0faf6":isPast?"#f5f0e8":"#fff",
                    border:isToday?"2px solid #c8913a":myEntry?"2px solid #3d2b1f":hasEntry?"2px solid #a07030":someoneOnVac?"1px solid #a8d8c8":"1px solid #e2d5c0",
                    cursor:canClick?"pointer":"default",transition:"all .15s"}}>
                    <div style={{fontSize:10,fontWeight:isToday?700:400,color:(hasEntry||myEntry)?"#fff":someoneOnVac?"#16a085":"#2c2416"}}>{d.getDate()}</div>
                    {myEntry&&<div style={{fontSize:7,color:"#f5c842",fontWeight:700}}>✓ Ich</div>}
                    {!myEntry&&hasEntry&&<div style={{fontSize:7,color:"#fff5e0",fontWeight:600,lineHeight:1,textAlign:"center",overflow:"hidden",maxWidth:"90%",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bookedMember?.name.split(" ")[0]}</div>}
                    {!hasEntry&&someoneOnVac&&(
                      <div style={{fontSize:7,color:"#16a085",fontWeight:700,lineHeight:1.1,textAlign:"center",maxWidth:"95%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {vacMembers.map(m=>m.name.split(" ")[0]).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,fontSize:10,color:"#aaa",marginBottom:16}}>
              <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:3,background:"#c8913a",display:"inline-block"}}/> Belegt</span>
              <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:3,background:"#a8d8c8",border:"1px solid #a8d8c8",display:"inline-block"}}/> Urlaub (Name)</span>
            </div>
            <div style={{borderTop:"1px solid #f0e8d8",paddingTop:12}}>
              <div style={{fontWeight:700,fontSize:12,color:"#3d2b1f",marginBottom:8}}>Offene Dienste {monthLabel}</div>
              {einstellerList.filter(m=>m.type!=="admin").flatMap(e=>{
                const rbs = members.filter(rb=>rb.type==="reitbeteiligung"&&rb.einstellerId===e.id);
                return [e, ...rbs];
              }).map(m=>{
                const mQ=getMonthlyQuota(m,members,vacations,viewYear,viewMonth);
                const mC=countMistMonth(mistData,m.id,viewYear,viewMonth);
                const isChild=m.type==="reitbeteiligung";
                return (
                  <div key={m.id} style={{...S.row,justifyContent:"space-between",padding:"6px 0",paddingLeft:isChild?12:0,borderBottom:"1px solid #f5f0e8"}}>
                    <div>
                      {isChild&&<span style={{fontSize:9,color:"#b89060"}}>↳ </span>}
                      <span style={{fontSize:12,fontWeight:mC>=mQ?400:600,color:mC>=mQ?"#aaa":"#2c2416"}}>{m.name.split(" ")[0]} {m.name.split(" ")[1]?.charAt(0)}.</span>
                      {(vacations[m.id]||[]).length>0&&<span style={{fontSize:10}}> 🌴</span>}
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:mC>=mQ?"#27ae60":"#c0392b",background:mC>=mQ?"#d5f5e3":"#fdecea",padding:"3px 8px",borderRadius:20}}>{`${mC}/${mQ}×`}{mC>=mQ&&" ✓"}</span>
                  </div>
                );
              })}
              {/* Admin's own RBs */}
              {(()=>{
                const adminRbs = members.filter(rb=>rb.type==="reitbeteiligung"&&rb.einstellerId===currentUser.id);
                if(adminRbs.length===0) return null;
                return (<>
                  <div style={{fontSize:10,fontWeight:700,color:"#8b6040",marginTop:10,marginBottom:4}}>👑 Meine Reitbeteiligungen</div>
                  {adminRbs.map(rb=>{
                    const mQ=getMonthlyQuota(rb,members,vacations,viewYear,viewMonth);
                    const mC=countMistMonth(mistData,rb.id,viewYear,viewMonth);
                    return (
                      <div key={rb.id} style={{...S.row,justifyContent:"space-between",padding:"6px 0",paddingLeft:12,borderBottom:"1px solid #f5f0e8"}}>
                        <div>
                          <span style={{fontSize:9,color:"#b89060"}}>↳ </span>
                          <span style={{fontSize:12,fontWeight:mC>=mQ?400:600,color:mC>=mQ?"#aaa":"#2c2416"}}>{rb.name.split(" ")[0]} {rb.name.split(" ")[1]?.charAt(0)}.</span>
                          {(vacations[rb.id]||[]).length>0&&<span style={{fontSize:10}}> 🌴</span>}
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:mC>=mQ?"#27ae60":"#c0392b",background:mC>=mQ?"#d5f5e3":"#fdecea",padding:"3px 8px",borderRadius:20}}>{`${mC}/${mQ}×`}{mC>=mQ&&" ✓"}</span>
                      </div>
                    );
                  })}
                  <MistSplitWidget currentUser={currentUser} rbs={adminRbs} members={members} vacations={vacations} viewYear={viewYear} viewMonth={viewMonth} saveMemberEdit={saveMemberEdit} showToast={showToast}/>
                </>);
              })()}
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}

function MRow({ m, isChild, isAdmin, einstellerList, editId, editData, setEditData, deleteMember, getVacationLabel, startEdit, cancelEdit, saveEdit }) {
  const inS = {...S.input,marginBottom:6,padding:"8px 10px",fontSize:12};
  const lS  = {...S.label,marginBottom:2};
  const isEditing = isAdmin&&editId===m.id;
  const avBg = m.type==="admin"?"linear-gradient(135deg,#c8913a,#f5c842)":isChild?"linear-gradient(135deg,#7f8c8d,#aaa)":undefined;
  const avSz = isChild?{width:30,height:30,fontSize:12}:{};
  return (
    <div style={isChild?{paddingLeft:14,paddingTop:10,borderTop:"1px dashed #f0e8d8"}:{}}>
      {!isEditing?(
        <div style={{...S.row,justifyContent:"space-between"}}>
          <div style={{...S.row,gap:10}}>
            <div style={{...S.ava(avBg),...avSz}}>{m.name.charAt(0)}</div>
            <div>
              <div style={{fontWeight:600,fontSize:isChild?12:13}}>{m.name} {m.type==="admin"&&<span style={{fontSize:10,color:"#c8913a"}}>👑</span>}</div>
              <div style={{fontSize:11,color:"#8b6040"}}>{m.type==="reitbeteiligung"?"🤝 Reitbeteiligung":m.type==="admin"?"👑 Admin":"🐴 Einsteller"}{m.horse?` · ${m.horse}`:""}</div>
              {isAdmin&&<><div style={{fontSize:10,color:"#aaa"}}>{m.phone&&`📞 ${m.phone}`}</div><div style={{fontSize:10,color:"#b89060"}}>PIN: {m.pin}</div></>}
              {getVacationLabel(m.id)&&<div style={{fontSize:10,color:"#16a085",marginTop:2}}>{getVacationLabel(m.id)}</div>}
            </div>
          </div>
          {isAdmin&&(
            <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
              <button onClick={()=>startEdit(m)} style={{background:"#f5f0e8",border:"none",cursor:"pointer",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:600,color:"#8b6040"}}>✏️ Bearbeiten</button>
              {m.type!=="admin"&&<button onClick={()=>deleteMember(m.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ddd",padding:"2px 4px"}}><Ic n="x" s={13}/></button>}
            </div>
          )}
        </div>
      ):(
        <div style={{background:"#faf6f0",borderRadius:10,padding:12,border:"1.5px solid #c8913a"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#c8913a",marginBottom:10}}>✏️ Bearbeiten: {m.name}</div>
          <label style={lS}>Name</label><input style={inS} value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))}/>
          <label style={lS}>Pferd</label><input style={inS} value={editData.horse} onChange={e=>setEditData(p=>({...p,horse:e.target.value}))}/>
          <label style={lS}>Telefon</label><input style={inS} value={editData.phone} onChange={e=>setEditData(p=>({...p,phone:e.target.value}))}/>
          <label style={lS}>PIN zurücksetzen</label><input style={inS} maxLength={4} value={editData.pin} onChange={e=>setEditData(p=>({...p,pin:e.target.value.replace(/\D/,"")}))}/>
          {m.type!=="admin"&&<><label style={lS}>Typ</label>
            <select style={inS} value={editData.type} onChange={e=>setEditData(p=>({...p,type:e.target.value,einstellerId:""}))}>
              <option value="einsteller">🐴 Einsteller</option><option value="reitbeteiligung">🤝 Reitbeteiligung</option>
            </select></>}
          {editData.type==="reitbeteiligung"&&<><label style={lS}>Gehört zu Einsteller</label>
            <select style={inS} value={editData.einstellerId} onChange={e=>setEditData(p=>({...p,einstellerId:e.target.value}))}>
              <option value="">— bitte wählen —</option>
              {einstellerList.filter(x=>x.id!==m.id).map(x=><option key={x.id} value={x.id}>{x.name} ({x.horse})</option>)}
            </select></>}

          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={{...S.btn("light"),padding:"7px 14px",fontSize:12}} onClick={cancelEdit}>Abbrechen</button>
            <button style={{...S.btn("primary"),padding:"7px 14px",fontSize:12}} onClick={()=>saveEdit(m.id)}>💾 Speichern</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MembersScreen({ currentUser, isAdmin, members, einstellerList, vacations, showAddMember, setShowAddMember, newMember, setNewMember, addMember, deleteMember, saveMemberEdit, getVacationLabel, editId, setEditId, editData, setEditData, pinMode, setPinMode, pins, setPins, pinErr, setPinErr, showToast }) {
  const startEdit  = m => { setEditId(m.id); setEditData({name:m.name,horse:m.horse,phone:m.phone||"",pin:m.pin,type:m.type,einstellerId:m.einstellerId||"",mistShare:m.mistShare??50}); };
  const cancelEdit = () => setEditId(null);
  const saveEdit   = async id => { if(!editData.name||!editData.pin) return; await saveMemberEdit(id, editData); setEditId(null); };
  const rowProps   = { isAdmin, einstellerList, editId, editData, setEditData, deleteMember, getVacationLabel, startEdit, cancelEdit, saveEdit };

  return (
    <div>
      {!isAdmin&&(
        <div style={S.card}>
          <div style={S.cTitle}>Mein Profil</div>
          <div style={{...S.row,gap:10,marginBottom:12}}>
            <div style={S.ava()}>{currentUser.name.charAt(0)}</div>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{currentUser.name}</div>
              <div style={{fontSize:11,color:"#8b6040"}}>{currentUser.type==="einsteller"?"🐴 Einsteller":"🤝 Reitbeteiligung"}{currentUser.horse?` · ${currentUser.horse}`:""}</div>
              {currentUser.phone&&<div style={{fontSize:11,color:"#aaa"}}>📞 {currentUser.phone}</div>}
            </div>
          </div>
          {!pinMode?(
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button style={{...S.btn("light"),padding:"8px 14px",fontSize:12}} onClick={()=>setPinMode(true)}>🔑 PIN ändern</button>
            </div>
          ):(
            <div style={{background:"#faf6f0",borderRadius:10,padding:12,border:"1.5px solid #c8913a",marginTop:8}}>
              <div style={{fontSize:12,fontWeight:700,color:"#c8913a",marginBottom:10}}>🔑 PIN ändern</div>
              <label style={S.label}>Alte PIN</label>
              <input style={{...S.input,marginBottom:8}} type="password" inputMode="numeric" maxLength={4} value={pins.old} onChange={e=>setPins(p=>({...p,old:e.target.value.replace(/\D/,"")}))} placeholder="••••"/>
              <label style={S.label}>Neue PIN</label>
              <input style={{...S.input,marginBottom:8}} type="password" inputMode="numeric" maxLength={4} value={pins.n1} onChange={e=>setPins(p=>({...p,n1:e.target.value.replace(/\D/,"")}))} placeholder="••••"/>
              <label style={S.label}>Neue PIN bestätigen</label>
              <input style={{...S.input,marginBottom:8}} type="password" inputMode="numeric" maxLength={4} value={pins.n2} onChange={e=>setPins(p=>({...p,n2:e.target.value.replace(/\D/,"")}))} placeholder="••••"/>
              {pinErr&&<div style={{fontSize:11,color:"#c0392b",marginBottom:8}}>{pinErr}</div>}
              <div style={{...S.row,justifyContent:"flex-end",gap:8}}>
                <button style={{...S.btn("light"),padding:"7px 14px",fontSize:12}} onClick={()=>{setPinMode(false);setPins({old:"",n1:"",n2:""});setPinErr("");}}>Abbrechen</button>
                <button style={{...S.btn("primary"),padding:"7px 14px",fontSize:12}} onClick={async()=>{
                  if(pins.old!==currentUser.pin){setPinErr("Alte PIN falsch");return;}
                  if(pins.n1.length!==4){setPinErr("Neue PIN muss 4 Ziffern haben");return;}
                  if(pins.n1!==pins.n2){setPinErr("PINs stimmen nicht überein");return;}
                  await saveMemberEdit(currentUser.id,{...currentUser,pin:pins.n1,einstellerId:currentUser.einstellerId||""});
                  setPinMode(false);setPins({old:"",n1:"",n2:""});setPinErr("");
                  showToast("✅ PIN erfolgreich geändert!");
                }}>💾 Speichern</button>
              </div>
            </div>
          )}

        </div>
      )}
      {einstellerList.map(e=>(
        <div key={e.id} style={S.card}>
          <MRow m={e} isChild={false} {...rowProps}/>
          {members.filter(m=>m.einstellerId===e.id).map(rb=><MRow key={rb.id} m={rb} isChild={true} {...rowProps}/>)}
        </div>
      ))}
      {/* Verwaiste Reitbeteiligungen (einstellerId zeigt auf nicht-existierenden Einsteller) */}
      {members.filter(m=>m.type==="reitbeteiligung"&&m.einstellerId&&!members.find(e=>e.id===m.einstellerId)).map(m=>(
        <div key={m.id} style={{...S.card,border:"1.5px solid #f5c0c0"}}>
          <div style={{fontSize:11,color:"#c0392b",marginBottom:8}}>⚠️ Einsteller nicht gefunden – bitte zuordnen</div>
          <MRow m={m} isChild={false} {...rowProps}/>
        </div>
      ))}
      {isAdmin&&<div style={{margin:"14px 16px 0"}}><button style={{...S.btn("primary"),width:"100%",padding:14}} onClick={()=>setShowAddMember(true)}>+ Mitglied hinzufügen</button></div>}
      {showAddMember&&(
        <div style={S.modal}><div style={S.mBox}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:16,color:"#3d2b1f"}}>Neues Mitglied</div>
          <label style={S.label}>Name</label><input style={S.input} placeholder="Vor- und Nachname" value={newMember.name} onChange={e=>setNewMember(p=>({...p,name:e.target.value}))}/>
          <label style={S.label}>Pferd</label><input style={S.input} placeholder="Name des Pferdes" value={newMember.horse} onChange={e=>setNewMember(p=>({...p,horse:e.target.value}))}/>
          <label style={S.label}>Typ</label>
          <select style={S.input} value={newMember.type} onChange={e=>setNewMember(p=>({...p,type:e.target.value,einstellerId:""}))}>
            <option value="einsteller">Einsteller</option><option value="reitbeteiligung">Reitbeteiligung</option><option value="admin">Admin</option>
          </select>
          {newMember.type==="reitbeteiligung"&&<><label style={S.label}>Gehört zu Einsteller</label>
            <select style={S.input} value={newMember.einstellerId} onChange={e=>setNewMember(p=>({...p,einstellerId:e.target.value}))}>
              <option value="">— bitte wählen —</option>
              {einstellerList.map(m=><option key={m.id} value={m.id}>{m.name} ({m.horse})</option>)}
            </select></>}
          <label style={S.label}>PIN (4-stellig)</label><input style={S.input} placeholder="z.B. 1234" maxLength={4} value={newMember.pin} onChange={e=>setNewMember(p=>({...p,pin:e.target.value.replace(/\D/,"")}))}/>
          <label style={S.label}>Telefon</label><input style={S.input} placeholder="Optional" value={newMember.phone} onChange={e=>setNewMember(p=>({...p,phone:e.target.value}))}/>
          <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btn("light")} onClick={()=>setShowAddMember(false)}>Abbrechen</button>
            <button style={S.btn("primary")} onClick={addMember}>Hinzufügen</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

function FinanzenScreen({ currentUser, isAdmin, members, finMonths, finAccounts, finViewMonth, finViewYear, setFinViewMonth, setFinViewYear, editFee, setEditFee, editPay, setEditPay, addExtra, setAddExtra, extraForm, setExtraForm, saveFinMonth, saveBaseFee, calcTotal, calcCarryover, getFinMonth, getBaseFee, showToast }) {
  const einsteller   = members.filter(m=>m.type==="einsteller");
  const adminRbsAll  = members.filter(m=>m.type==="reitbeteiligung"&&members.find(a=>a.type==="admin"&&a.id===m.einstellerId));
  const viewMonth  = finViewMonth;
  const viewYear   = finViewYear;
  const monthLabel = new Date(viewYear,viewMonth,1).toLocaleDateString("de-DE",{month:"long",year:"numeric"});

  // Extra types: fixed price per unit, qty-based
  const EXTRA_TYPES = [
    { label:"Decken waschen",   unitPrice:5,  unit:"Decke",    hasQty:true  },
    { label:"Regendecke",       unitPrice:10, unit:"Decke",    hasQty:true  },
    { label:"Vollpension",      unitPrice:65, unit:"Monat",    hasQty:false },
    { label:"Reitunterricht",   unitPrice:0,  unit:"",         hasQty:false },
    { label:"Sonstiges",        unitPrice:0,  unit:"",         hasQty:false },
  ];
  const getExtraConfig = (type) => EXTRA_TYPES.find(t=>t.label===type)||EXTRA_TYPES[0];
  const calcExtraAmount = (form) => {
    const cfg = getExtraConfig(form.type);
    if(cfg.hasQty) return cfg.unitPrice * (parseInt(form.qty)||1);
    return parseFloat(form.amount)||0;
  };
  const resetExtraForm = () => setExtraForm({type:"Decken waschen",qty:"1",amount:"5",desc:""});
  const onExtraTypeChange = (type) => {
    const cfg = getExtraConfig(type);
    setExtraForm(p=>({...p, type, qty:"1", amount:String(cfg.unitPrice||p.amount)}));
  };

  const goMonth = (dir) => {
    let m=viewMonth+dir, y=viewYear;
    if(m>11){m=0;y++;} if(m<0){m=11;y--;}
    setFinViewMonth(m); setFinViewYear(y);
  };

  const handleSaveFee = async (memberId) => {
    const fee = parseFloat(editFee[memberId]);
    if(isNaN(fee)) return;
    await saveBaseFee(memberId, fee);
    setEditFee(p=>({...p,[memberId]:undefined}));
    showToast("💾 Grundgebühr gespeichert!");
  };

  const handleSavePayment = async (memberId, directAmount) => {
    const pay = directAmount !== undefined ? directAmount : parseFloat(editPay[memberId]);
    if(isNaN(pay)) return;
    const total = calcTotal(memberId, viewYear, viewMonth);
    let diff = pay - total;
    await saveFinMonth(memberId, viewYear, viewMonth, {payment:pay});
    let nm=viewMonth+1, ny=viewYear;
    if(nm>11){nm=0;ny++;}
    // Replace carryover (don't accumulate — corrections would double-count)
    // diff = pay - total: negative means underpaid (surcharge next month), positive means overpaid (discount next month)
    // carryover is ADDED to next month's total, so sign stays: underpaid = negative carryover WRONG
    // Actually: carryover added to total means: -20 carryover → total goes DOWN → wrong
    // We need: underpaid (diff=-20) → next month total goes UP → carryover = -diff = +20... 
    // BUT: overpaid (diff=+20) → next month total goes DOWN → carryover = -diff = -20
    // So: carryover = -diff (negate)
    await saveFinMonth(memberId, ny, nm, {carryover: Number((-diff).toFixed(2))});
    if(directAmount===undefined) setEditPay(p=>({...p,[memberId]:undefined}));
    const carryover = -diff;
    showToast(diff!==0?`💾 Zahlung gespeichert · Nächster Monat: ${carryover>0?"+":""}${carryover.toFixed(2)}€`:"💾 Zahlung gespeichert!");
  };

  const handleAddExtra = async (memberId) => {
    const amount = calcExtraAmount(extraForm);
    if(isNaN(amount)||amount<=0) return;
    const cfg = getExtraConfig(extraForm.type);
    const qty = cfg.hasQty ? (parseInt(extraForm.qty)||1) : null;
    const desc = cfg.hasQty ? `${qty}× ${cfg.unit}` : extraForm.desc;
    const fm = getFinMonth(memberId, viewYear, viewMonth);
    const newExtra = {id:Date.now(), type:extraForm.type, amount, qty, desc};
    await saveFinMonth(memberId, viewYear, viewMonth, {extras:[...(fm.extras||[]),newExtra]});
    setAddExtra(null); resetExtraForm();
    showToast("✅ Zusatzdienst gebucht!");
  };

  const handleRemoveExtra = async (memberId, extraId) => {
    const fm = getFinMonth(memberId, viewYear, viewMonth);
    await saveFinMonth(memberId, viewYear, viewMonth, {extras:(fm.extras||[]).filter(e=>e.id!==extraId)});
  };

  if(!isAdmin) {
    const m     = currentUser;
    const fm    = getFinMonth(m.id, viewYear, viewMonth);
    const base  = getBaseFee(m.id);
    const extras= fm.extras||[];
    const carry = calcCarryover(m.id, viewYear, viewMonth);
    const total = calcTotal(m.id, viewYear, viewMonth);
    const paid  = fm.payment!==null&&fm.payment!==undefined;
    const diff  = paid ? Number((fm.payment - total).toFixed(2)) : null;
    return (
      <div>
        <div style={{...S.row,justifyContent:"space-between",margin:"14px 16px 0"}}>
          <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>goMonth(-1)}>‹</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#3d2b1f",fontWeight:600}}>{monthLabel}</div>
          <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>goMonth(1)}>›</button>
        </div>
        <div style={{...S.card,background:"linear-gradient(135deg,#3d2b1f,#7a5230)",color:"#f5e6c8"}}>
          <div style={{fontSize:11,color:"#c8913a",marginBottom:4}}>Mein Konto · {monthLabel}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:38,fontWeight:700}}>{total.toFixed(2)}€</div>
          <div style={{fontSize:11,color:"#d4b88a",marginTop:4}}>
            Grundgebühr {base.toFixed(2)}€
            {extras.length>0&&` + Extras ${extras.reduce((a,e)=>a+Number(e.amount),0).toFixed(2)}€`}
            {carry!==0&&` ${carry>0?"-":"+"}${Math.abs(carry).toFixed(2)}€ Übertrag`}
          </div>
          <div style={{marginTop:12,padding:"8px 12px",borderRadius:10,background:paid?"rgba(255,255,255,.1)":"rgba(192,57,43,.3)"}}>
            {paid
              ? <span style={{fontSize:12,fontWeight:600}}>✓ Zahlung eingegangen: {Number(fm.payment).toFixed(2)}€{diff!==0?` · Nächster Monat: ${diff<0?"+":""}${(-diff).toFixed(2)}€`:""}</span>
              : <span style={{fontSize:12,fontWeight:600,color:"#ffb3a7"}}>⏳ Zahlung noch ausstehend</span>}
          </div>
        </div>
        <div style={S.card}>
          <div style={{...S.row,justifyContent:"space-between",marginBottom:10}}>
            <div style={S.cTitle}>Abrechnung</div>
            <button style={{...S.btn("primary"),padding:"7px 12px",fontSize:12}} onClick={()=>{setAddExtra(m.id);resetExtraForm();}}>+ Hinzufügen</button>
          </div>
          {/* Grundgebühr */}
          <div style={{...S.row,justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f0e8d8"}}>
            <div style={{fontSize:13,color:"#3d2b1f"}}>Grundgebühr</div>
            <span style={{fontWeight:600,fontSize:13}}>{base.toFixed(2)}€</span>
          </div>
          {/* Zusätze */}
          {extras.length===0&&<div style={{fontSize:12,color:"#aaa",padding:"6px 0"}}>Keine Zusätze diesen Monat</div>}
          {extras.map(e=>(
            <div key={e.id} style={{...S.row,justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f0e8d8"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>{e.type}</div>
                {e.desc&&<div style={{fontSize:11,color:"#8b6040"}}>{e.desc}</div>}
              </div>
              <div style={{...S.row,gap:8}}>
                <span style={{fontWeight:700,fontSize:13,color:"#c8913a"}}>{Number(e.amount).toFixed(2)}€</span>
                {!paid&&<button onClick={()=>handleRemoveExtra(m.id,e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ddd",padding:2}}><Ic n="x" s={13}/></button>}
              </div>
            </div>
          ))}
          {/* Übertrag: carry>0 = Schulden (rot, +Aufschlag), carry<0 = Guthaben (grün, -Abzug) */}
          {carry!==0&&(
            <div style={{...S.row,justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f0e8d8",marginTop:2}}>
              <div style={{fontSize:12,color:"#8b6040"}}>Übertrag Vormonat</div>
              <span style={{fontWeight:700,fontSize:13,color:carry>0?"#c0392b":"#27ae60"}}>
                {carry>0?"+":"-"}{Math.abs(carry).toFixed(2)}€
              </span>
            </div>
          )}
          <div style={{...S.row,justifyContent:"space-between",padding:"10px 0 0",borderTop:"2px solid #e2d5c0",marginTop:6}}>
            <div style={{fontWeight:700,fontSize:14}}>Gesamt</div>
            <div style={{fontWeight:700,fontSize:18,color:"#3d2b1f"}}>{total.toFixed(2)}€</div>
          </div>
        </div>
        {addExtra===m.id&&(
          <div style={S.modal}><div style={S.mBox}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:16,color:"#3d2b1f"}}>Zusatzdienst buchen</div>
            <label style={S.label}>Typ</label>
            <select style={S.input} value={extraForm.type} onChange={e=>onExtraTypeChange(e.target.value)}>
              {EXTRA_TYPES.map(t=><option key={t.label}>{t.label}</option>)}
            </select>
            {getExtraConfig(extraForm.type).hasQty&&(<>
              <label style={S.label}>Anzahl ({getExtraConfig(extraForm.type).unit})</label>
              <div style={{...S.row,gap:6,marginBottom:8}}>
                <button onClick={()=>setExtraForm(p=>({...p,qty:String(Math.max(1,(parseInt(p.qty)||1)-1))}))} style={{...S.btn("light"),padding:"6px 14px",fontSize:16}}>−</button>
                <input style={{...S.input,marginBottom:0,textAlign:"center",fontWeight:700,fontSize:16}} type="number" min="1" value={extraForm.qty} onChange={e=>setExtraForm(p=>({...p,qty:e.target.value}))}/>
                <button onClick={()=>setExtraForm(p=>({...p,qty:String((parseInt(p.qty)||1)+1)}))} style={{...S.btn("light"),padding:"6px 14px",fontSize:16}}>+</button>
              </div>
              <div style={{textAlign:"center",fontSize:13,color:"#c8913a",fontWeight:700,marginBottom:12}}>
                {parseInt(extraForm.qty)||1} × {getExtraConfig(extraForm.type).unitPrice}€ = <b>{calcExtraAmount(extraForm).toFixed(2)}€</b>
              </div>
            </>)}
            {!getExtraConfig(extraForm.type).hasQty&&extraForm.type!=="Vollpension"&&(<>
              <label style={S.label}>Betrag (€)</label>
              <input style={S.input} type="number" step="0.50" min="0" value={extraForm.amount} onChange={e=>setExtraForm(p=>({...p,amount:e.target.value}))}/>
              <label style={S.label}>Beschreibung (optional)</label>
              <input style={S.input} placeholder="z.B. Sonderreinigung" value={extraForm.desc} onChange={e=>setExtraForm(p=>({...p,desc:e.target.value}))}/>
            </>)}
            {extraForm.type==="Vollpension"&&<div style={{textAlign:"center",fontSize:13,color:"#c8913a",fontWeight:700,marginBottom:12}}>65.00€ / Monat</div>}
            <div style={{...S.row,justifyContent:"flex-end",gap:8,marginTop:8}}>
              <button style={S.btn("light")} onClick={()=>setAddExtra(null)}>Abbrechen</button>
              <button style={S.btn("primary")} onClick={()=>handleAddExtra(m.id)}>Buchen</button>
            </div>
          </div></div>
        )}
      </div>
    );
  }

  const totalOwed     = einsteller.reduce((a,m)=>a+calcTotal(m.id,viewYear,viewMonth),0);
  const totalReceived = einsteller.reduce((a,m)=>{ const fm=getFinMonth(m.id,viewYear,viewMonth); return a+(fm.payment||0); },0);

  return (
    <div>
      <div style={{...S.row,justifyContent:"space-between",margin:"14px 16px 0"}}>
        <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>goMonth(-1)}>‹</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#3d2b1f",fontWeight:600}}>{monthLabel}</div>
        <button style={{...S.btn("light"),padding:"6px 12px",fontSize:18}} onClick={()=>goMonth(1)}>›</button>
      </div>
      <div style={{...S.card,background:"linear-gradient(135deg,#3d2b1f,#7a5230)",color:"#f5e6c8"}}>
        <div style={{fontSize:11,color:"#c8913a",marginBottom:4}}>Stallübersicht · {monthLabel}</div>
        <div style={{...S.row,justifyContent:"space-between",alignItems:"flex-end"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700}}>{totalReceived.toFixed(2)}€</div>
            <div style={{fontSize:11,color:"#d4b88a"}}>eingegangen von {totalOwed.toFixed(2)}€</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:700,color:totalReceived>=totalOwed?"#a8e6cf":"#ffb3a7"}}>{einsteller.filter(m=>getFinMonth(m.id,viewYear,viewMonth).payment!==null&&getFinMonth(m.id,viewYear,viewMonth).payment!==undefined).length}/{einsteller.length}</div>
            <div style={{fontSize:10,color:"#d4b88a"}}>bezahlt</div>
          </div>
        </div>
      </div>
      {einsteller.map(m=>{
        const fm=getFinMonth(m.id,viewYear,viewMonth); const base=getBaseFee(m.id);
        const extras=fm.extras||[]; const carry=calcCarryover(m.id,viewYear,viewMonth);
        const total=calcTotal(m.id,viewYear,viewMonth); const paid=fm.payment!==null&&fm.payment!==undefined;
        const diff=paid?Number((fm.payment-total).toFixed(2)):null;
        const editingFee=editFee[m.id]!==undefined; const editingPay=editPay[m.id]!==undefined;
        return (
          <div key={m.id} style={S.card}>
            <div style={{...S.row,justifyContent:"space-between",marginBottom:12}}>
              <div style={{...S.row,gap:10}}>
                <div style={S.ava()}>{m.name.charAt(0)}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{m.name}</div>
                  <div style={{fontSize:11,color:"#8b6040"}}>🐴 {m.horse}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,fontSize:18,color:"#3d2b1f"}}>{total.toFixed(2)}€</div>
                <div style={{fontSize:10,color:paid?"#555":"#c0392b",fontWeight:600}}>{paid?`✓ ${Number(fm.payment).toFixed(2)}€ erhalten`:"⚠️ Offen"}</div>
              </div>
            </div>
            <div style={{...S.row,justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0e8d8"}}>
              <div style={{fontSize:12,color:"#8b6040"}}>Grundgebühr</div>
              {editingFee
                ? <div style={{...S.row,gap:6}}>
                    <input style={{...S.input,width:80,marginBottom:0,padding:"4px 8px",fontSize:12}} type="number" step="0.50" value={editFee[m.id]} onChange={e=>setEditFee(p=>({...p,[m.id]:e.target.value}))}/>
                    <button style={{...S.btn("primary"),padding:"4px 10px",fontSize:11}} onClick={()=>handleSaveFee(m.id)}>OK</button>
                    <button style={{...S.btn("light"),padding:"4px 8px",fontSize:11}} onClick={()=>setEditFee(p=>({...p,[m.id]:undefined}))}>✕</button>
                  </div>
                : <div style={{...S.row,gap:8}}>
                    <span style={{fontWeight:600,fontSize:13}}>{base.toFixed(2)}€</span>
                    <button onClick={()=>setEditFee(p=>({...p,[m.id]:String(base)}))} style={{background:"#f5f0e8",border:"none",cursor:"pointer",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#8b6040"}}>✏️</button>
                  </div>}
            </div>
            <div style={{...S.row,justifyContent:"space-between",padding:"4px 0 4px",borderBottom:"1px solid #f5f0e8"}}>
              <div style={{fontSize:11,color:"#8b6040",fontWeight:600}}>Zusätze</div>
              <button style={{...S.btn("primary"),padding:"3px 10px",fontSize:11}} onClick={()=>{setAddExtra(m.id);resetExtraForm();}}>+ Hinzufügen</button>
            </div>
            {extras.map(e=>(
              <div key={e.id} style={{...S.row,justifyContent:"space-between",padding:"5px 0 5px 10px",borderBottom:"1px solid #f5f0e8"}}>
                <div style={{fontSize:11,color:"#8b6040"}}>+ {e.type}{e.desc?` · ${e.desc}`:""}</div>
                <div style={{...S.row,gap:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:"#c8913a"}}>{Number(e.amount).toFixed(2)}€</span>
                  <button onClick={()=>handleRemoveExtra(m.id,e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ddd",padding:2}}><Ic n="x" s={12}/></button>
                </div>
              </div>
            ))}
            {addExtra===m.id&&(
              <div style={{background:"#faf6f0",borderRadius:8,padding:10,border:"1px solid #c8913a",margin:"6px 0"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#c8913a",marginBottom:8}}>Zusatzdienst hinzufügen</div>
                <select style={{...S.input,marginBottom:6,padding:"6px 8px",fontSize:12}} value={extraForm.type} onChange={e=>onExtraTypeChange(e.target.value)}>
                  {EXTRA_TYPES.map(t=><option key={t.label}>{t.label}</option>)}
                </select>
                {getExtraConfig(extraForm.type).hasQty&&(
                  <div style={{...S.row,gap:6,marginBottom:6}}>
                    <button onClick={()=>setExtraForm(p=>({...p,qty:String(Math.max(1,(parseInt(p.qty)||1)-1))}))} style={{...S.btn("light"),padding:"4px 12px",fontSize:14}}>−</button>
                    <input style={{...S.input,marginBottom:0,textAlign:"center",fontWeight:700}} type="number" min="1" value={extraForm.qty} onChange={e=>setExtraForm(p=>({...p,qty:e.target.value}))}/>
                    <button onClick={()=>setExtraForm(p=>({...p,qty:String((parseInt(p.qty)||1)+1)}))} style={{...S.btn("light"),padding:"4px 12px",fontSize:14}}>+</button>
                  </div>
                )}
                {getExtraConfig(extraForm.type).hasQty&&<div style={{fontSize:12,color:"#c8913a",fontWeight:700,marginBottom:6,textAlign:"center"}}>{calcExtraAmount(extraForm).toFixed(2)}€</div>}
                {!getExtraConfig(extraForm.type).hasQty&&extraForm.type!=="Vollpension"&&<>
                  <input style={{...S.input,marginBottom:6,padding:"6px 8px",fontSize:12}} type="number" step="0.50" min="0" placeholder="Betrag (€)" value={extraForm.amount} onChange={e=>setExtraForm(p=>({...p,amount:e.target.value}))}/>
                  <input style={{...S.input,marginBottom:6,padding:"6px 8px",fontSize:12}} placeholder="Beschreibung (optional)" value={extraForm.desc} onChange={e=>setExtraForm(p=>({...p,desc:e.target.value}))}/>
                </>}
                {extraForm.type==="Vollpension"&&<div style={{fontSize:12,color:"#c8913a",fontWeight:700,marginBottom:6}}>65.00€ / Monat</div>}
                <div style={{...S.row,justifyContent:"flex-end",gap:6}}>
                  <button style={{...S.btn("light"),padding:"5px 10px",fontSize:11}} onClick={()=>setAddExtra(null)}>Abbrechen</button>
                  <button style={{...S.btn("primary"),padding:"5px 10px",fontSize:11}} onClick={()=>handleAddExtra(m.id)}>Buchen</button>
                </div>
              </div>
            )}
            {carry!==0&&(
              <div style={{...S.row,justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f5f0e8"}}>
                <div style={{fontSize:11,color:"#8b6040"}}>Übertrag Vormonat</div>
                <span style={{fontSize:12,fontWeight:600,color:carry>0?"#c0392b":"#27ae60"}}>{carry<0?"+":"-"}{Math.abs(carry).toFixed(2)}€</span>
              </div>
            )}
            <div style={{...S.row,justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #e2d5c0"}}>
              <div style={{fontWeight:700,fontSize:13}}>Gesamt fällig</div>
              <div style={{fontWeight:700,fontSize:15}}>{total.toFixed(2)}€</div>
            </div>
            {/* Zahlung abhaken */}
            <div style={{padding:"10px 0 0"}}>
              <div style={{...S.row,justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:12,color:"#8b6040",fontWeight:600}}>Zahlung</div>
                <label style={{...S.row,gap:8,cursor:"pointer"}}>
                  <span style={{fontSize:12,color:paid?"#27ae60":"#c0392b",fontWeight:600}}>{paid?"✓ Bezahlt":"⏳ Ausstehend"}</span>
                  <div onClick={async()=>{
                    if(!paid){ await handleSavePayment(m.id, total); }
                    else { await saveFinMonth(m.id,viewYear,viewMonth,{payment:null}); let nm=viewMonth+1,ny=viewYear; if(nm>11){nm=0;ny++;} await saveFinMonth(m.id,ny,nm,{carryover:0}); }
                  }} style={{width:42,height:24,borderRadius:12,background:paid?"#27ae60":"#ddd",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:paid?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
                  </div>
                </label>
              </div>
              {paid&&<div style={{fontSize:12,color:"#555",marginBottom:4}}>Betrag: <b>{Number(fm.payment).toFixed(2)}€</b>
                {diff!==0&&<span style={{fontSize:11,color:diff<0?"#c0392b":"#27ae60",marginLeft:8}}>→ Nächster Monat: {diff<0?"+":""}{(-diff).toFixed(2)}€</span>}
              </div>}
              {/* Abweichung eintragen */}
              <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>Abweichender Betrag?</div>
              {editingPay
                ? <div style={{...S.row,gap:6}}>
                    <input style={{...S.input,width:90,marginBottom:0,padding:"4px 8px",fontSize:12}} type="number" step="0.50" value={editPay[m.id]} onChange={e=>setEditPay(p=>({...p,[m.id]:e.target.value}))} placeholder={total.toFixed(2)} autoFocus/>
                    <button style={{...S.btn("primary"),padding:"4px 10px",fontSize:11}} onClick={()=>handleSavePayment(m.id)}>OK</button>
                    <button style={{...S.btn("light"),padding:"4px 8px",fontSize:11}} onClick={()=>setEditPay(p=>({...p,[m.id]:undefined}))}>✕</button>
                  </div>
                : <button onClick={()=>setEditPay(p=>({...p,[m.id]:paid?String(fm.payment):String(total)}))} style={{...S.btn("light"),padding:"4px 12px",fontSize:11}}>✏️ Betrag anpassen</button>}
            </div>
            {!paid&&m.phone&&(
              <a href={`https://wa.me/${m.phone.replace(/[^0-9]/g,"")}?text=Hallo%20${encodeURIComponent(m.name.split(" ")[0])}%2C%20deine%20Stallgeb%C3%BChr%20f%C3%BCr%20${encodeURIComponent(monthLabel)}%20betr%C3%A4gt%20${total.toFixed(2).replace(".",",")}%E2%82%AC.%20Bitte%20%C3%BCberweise%20zeitnah!%20%F0%9F%90%B4`}
                style={{...S.btn("primary"),textDecoration:"none",padding:"6px 14px",fontSize:11,display:"inline-block",marginTop:10}}>
                📲 WhatsApp Erinnerung
              </a>
            )}
          </div>
        );
      })}
      {adminRbsAll.length>0&&(<>
        <div style={{...S.card,background:"#faf6f0",border:"1.5px solid #e2d5c0"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:"#8b6040"}}>
            🤝 Reitbeteiligung von {members.find(m=>m.type==="admin")?.name||"Admin"}
          </div>
        </div>
        {adminRbsAll.map(m=>{
          const fm=getFinMonth(m.id,viewYear,viewMonth); const base=getBaseFee(m.id);
          const extras=fm.extras||[]; const carry=calcCarryover(m.id,viewYear,viewMonth);
          const total=calcTotal(m.id,viewYear,viewMonth); const paid=fm.payment!==null&&fm.payment!==undefined;
          const diff=paid?Number((fm.payment-total).toFixed(2)):null;
          const editingFee=editFee[m.id]!==undefined; const editingPay=editPay[m.id]!==undefined;
          return (
            <div key={m.id} style={S.card}>
              <div style={{...S.row,justifyContent:"space-between",marginBottom:12}}>
                <div style={{...S.row,gap:10}}>
                  <div style={S.ava()}>{m.name.charAt(0)}</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{m.name}</div>
                    <div style={{fontSize:11,color:"#8b6040"}}>🤝 Reitbeteiligung{m.horse?` · ${m.horse}`:""}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:700,fontSize:18,color:"#3d2b1f"}}>{total.toFixed(2)}€</div>
                  <div style={{fontSize:10,color:paid?"#555":"#c0392b",fontWeight:600}}>{paid?`✓ ${Number(fm.payment).toFixed(2)}€ erhalten`:"⚠️ Offen"}</div>
                </div>
              </div>
              <div style={{...S.row,justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0e8d8"}}>
                <div style={{fontSize:12,color:"#8b6040"}}>Grundgebühr</div>
                {editingFee
                  ? <div style={{...S.row,gap:6}}>
                      <input style={{...S.input,width:80,marginBottom:0,padding:"4px 8px",fontSize:12}} type="number" step="0.50" value={editFee[m.id]} onChange={e=>setEditFee(p=>({...p,[m.id]:e.target.value}))}/>
                      <button style={{...S.btn("primary"),padding:"4px 10px",fontSize:11}} onClick={()=>handleSaveFee(m.id)}>OK</button>
                      <button style={{...S.btn("light"),padding:"4px 8px",fontSize:11}} onClick={()=>setEditFee(p=>({...p,[m.id]:undefined}))}>✕</button>
                    </div>
                  : <div style={{...S.row,gap:8}}>
                      <span style={{fontWeight:600,fontSize:13}}>{base.toFixed(2)}€</span>
                      <button onClick={()=>setEditFee(p=>({...p,[m.id]:String(base)}))} style={{background:"#f5f0e8",border:"none",cursor:"pointer",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#8b6040"}}>✏️</button>
                    </div>}
              </div>
              <div style={{...S.row,justifyContent:"space-between",padding:"4px 0 4px",borderBottom:"1px solid #f5f0e8"}}>
                <div style={{fontSize:11,color:"#8b6040",fontWeight:600}}>Zusätze</div>
                <button style={{...S.btn("primary"),padding:"3px 10px",fontSize:11}} onClick={()=>{setAddExtra(m.id);resetExtraForm();}}>+ Hinzufügen</button>
              </div>
              {extras.map(e=>(
                <div key={e.id} style={{...S.row,justifyContent:"space-between",padding:"5px 0 5px 10px",borderBottom:"1px solid #f5f0e8"}}>
                  <div style={{fontSize:11,color:"#8b6040"}}>+ {e.type}{e.desc?` · ${e.desc}`:""}</div>
                  <div style={{...S.row,gap:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#c8913a"}}>{Number(e.amount).toFixed(2)}€</span>
                    <button onClick={()=>handleRemoveExtra(m.id,e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ddd",padding:2}}><Ic n="x" s={12}/></button>
                  </div>
                </div>
              ))}
              {addExtra===m.id&&(
                <div style={{background:"#faf6f0",borderRadius:8,padding:10,border:"1px solid #c8913a",margin:"6px 0"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#c8913a",marginBottom:8}}>Zusatzdienst hinzufügen</div>
                  <select style={{...S.input,marginBottom:6,padding:"6px 8px",fontSize:12}} value={extraForm.type} onChange={e=>onExtraTypeChange(e.target.value)}>
                    {EXTRA_TYPES.map(t=><option key={t.label}>{t.label}</option>)}
                  </select>
                  {getExtraConfig(extraForm.type).hasQty&&(
                    <div style={{...S.row,gap:6,marginBottom:6}}>
                      <button onClick={()=>setExtraForm(p=>({...p,qty:String(Math.max(1,(parseInt(p.qty)||1)-1))}))} style={{...S.btn("light"),padding:"4px 12px",fontSize:14}}>−</button>
                      <input style={{...S.input,marginBottom:0,textAlign:"center",fontWeight:700}} type="number" min="1" value={extraForm.qty} onChange={e=>setExtraForm(p=>({...p,qty:e.target.value}))}/>
                      <button onClick={()=>setExtraForm(p=>({...p,qty:String((parseInt(p.qty)||1)+1)}))} style={{...S.btn("light"),padding:"4px 12px",fontSize:14}}>+</button>
                    </div>
                  )}
                  {getExtraConfig(extraForm.type).hasQty&&<div style={{fontSize:12,color:"#c8913a",fontWeight:700,marginBottom:6,textAlign:"center"}}>{calcExtraAmount(extraForm).toFixed(2)}€</div>}
                  {!getExtraConfig(extraForm.type).hasQty&&extraForm.type!=="Vollpension"&&<>
                    <input style={{...S.input,marginBottom:6,padding:"6px 8px",fontSize:12}} type="number" step="0.50" min="0" placeholder="Betrag (€)" value={extraForm.amount} onChange={e=>setExtraForm(p=>({...p,amount:e.target.value}))}/>
                    <input style={{...S.input,marginBottom:6,padding:"6px 8px",fontSize:12}} placeholder="Beschreibung (optional)" value={extraForm.desc} onChange={e=>setExtraForm(p=>({...p,desc:e.target.value}))}/>
                  </>}
                  {extraForm.type==="Vollpension"&&<div style={{fontSize:12,color:"#c8913a",fontWeight:700,marginBottom:6}}>65.00€ / Monat</div>}
                  <div style={{...S.row,justifyContent:"flex-end",gap:6}}>
                    <button style={{...S.btn("light"),padding:"5px 10px",fontSize:11}} onClick={()=>setAddExtra(null)}>Abbrechen</button>
                    <button style={{...S.btn("primary"),padding:"5px 10px",fontSize:11}} onClick={()=>handleAddExtra(m.id)}>Buchen</button>
                  </div>
                </div>
              )}
              {carry!==0&&(
                <div style={{...S.row,justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f5f0e8"}}>
                  <div style={{fontSize:11,color:"#8b6040"}}>Übertrag Vormonat</div>
                  <span style={{fontSize:12,fontWeight:600,color:carry>0?"#c0392b":"#27ae60"}}>{carry<0?"+":"-"}{Math.abs(carry).toFixed(2)}€</span>
                </div>
              )}
              <div style={{...S.row,justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #e2d5c0"}}>
                <div style={{fontWeight:700,fontSize:13}}>Gesamt fällig</div>
                <div style={{fontWeight:700,fontSize:15}}>{total.toFixed(2)}€</div>
              </div>
              <div style={{padding:"10px 0 0"}}>
                <div style={{...S.row,justifyContent:"space-between",marginBottom:6}}>
                  <div style={{fontSize:12,color:"#8b6040",fontWeight:600}}>Zahlung</div>
                  <label style={{...S.row,gap:8,cursor:"pointer"}}>
                    <span style={{fontSize:12,color:paid?"#27ae60":"#c0392b",fontWeight:600}}>{paid?"✓ Bezahlt":"⏳ Ausstehend"}</span>
                    <div onClick={async()=>{
                      if(!paid){ await handleSavePayment(m.id, total); }
                      else { await saveFinMonth(m.id,viewYear,viewMonth,{payment:null}); let nm=viewMonth+1,ny=viewYear; if(nm>11){nm=0;ny++;} await saveFinMonth(m.id,ny,nm,{carryover:0}); }
                    }} style={{width:42,height:24,borderRadius:12,background:paid?"#27ae60":"#ddd",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                      <div style={{position:"absolute",top:3,left:paid?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
                    </div>
                  </label>
                </div>
                {paid&&<div style={{fontSize:12,color:"#555",marginBottom:4}}>Betrag: <b>{Number(fm.payment).toFixed(2)}€</b>
                  {diff!==0&&<span style={{fontSize:11,color:diff<0?"#c0392b":"#27ae60",marginLeft:8}}>→ Nächster Monat: {diff<0?"+":""}{(-diff).toFixed(2)}€</span>}
                </div>}
                <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>Abweichender Betrag?</div>
                {editingPay
                  ? <div style={{...S.row,gap:6}}>
                      <input style={{...S.input,width:90,marginBottom:0,padding:"4px 8px",fontSize:12}} type="number" step="0.50" value={editPay[m.id]} onChange={e=>setEditPay(p=>({...p,[m.id]:e.target.value}))} placeholder={total.toFixed(2)} autoFocus/>
                      <button style={{...S.btn("primary"),padding:"4px 10px",fontSize:11}} onClick={()=>handleSavePayment(m.id)}>OK</button>
                      <button style={{...S.btn("light"),padding:"4px 8px",fontSize:11}} onClick={()=>setEditPay(p=>({...p,[m.id]:undefined}))}>✕</button>
                    </div>
                  : <button onClick={()=>setEditPay(p=>({...p,[m.id]:paid?String(fm.payment):String(total)}))} style={{...S.btn("light"),padding:"4px 12px",fontSize:11}}>✏️ Betrag anpassen</button>}
              </div>
              {!paid&&m.phone&&(
                <a href={`https://wa.me/${m.phone.replace(/[^0-9]/g,"")}?text=Hallo%20${encodeURIComponent(m.name.split(" ")[0])}%2C%20deine%20Stallgeb%C3%BChr%20f%C3%BCr%20${encodeURIComponent(monthLabel)}%20betr%C3%A4gt%20${total.toFixed(2).replace(".",",")}%E2%82%AC.%20Bitte%20%C3%BCberweise%20zeitnah!%20%F0%9F%90%B4`}
                  style={{...S.btn("primary"),textDecoration:"none",padding:"6px 14px",fontSize:11,display:"inline-block",marginTop:10}}>
                  📲 WhatsApp Erinnerung
                </a>
              )}
            </div>
          );
        })}
      </>)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════
export default function StallApp() {
  const [members,        setMembers]        = useState([]);
  const [events,         setEvents]         = useState([]);
  const [mistData,       setMistData]       = useState({});
  const [vacations,      setVacations]      = useState({});
  const [loading,        setLoading]        = useState(true);
  const [syncing,        setSyncing]        = useState(false);
  const [weekOffset,     setWeekOffset]     = useState(0);
  const [tab,            setTab]            = useState("home");
  const [currentUser,    setCurrentUser]    = useState(null);
  const [loginStep,      setLoginStep]      = useState("select");
  const [selName,        setSelName]        = useState("");
  const [pinInput,       setPinInput]       = useState("");
  const [pinError,       setPinError]       = useState(false);
  const [showAddEvent,   setShowAddEvent]   = useState(false);
  const [showAddMember,  setShowAddMember]  = useState(false);
  const [showAddVacation,setShowAddVacation]= useState(false);
  const [vacTargetId,    setVacTargetId]    = useState(null);
  const [newEvent,       setNewEvent]       = useState({type:"Tierarzt",date:"",time:"",note:""});
  const [newMember,      setNewMember]      = useState({name:"",horse:"",type:"einsteller",pin:"",phone:"",einstellerId:""});
  const [newVac,         setNewVac]         = useState({from:"",to:"",note:"",mustCover:false});
  const [toast,          setToast]          = useState(null);
  const [finAccounts,    setFinAccounts]    = useState({});
  const [finMonths,      setFinMonths]      = useState({});
  const [editId,         setEditId]         = useState(null);
  const [editData,       setEditData]       = useState({});
  const [pinMode,        setPinMode]        = useState(false);
  const [pins,           setPins]           = useState({old:"",n1:"",n2:""});
  const [pinErr,         setPinErr]         = useState("");
  const [finViewMonth,   setFinViewMonth]   = useState(()=>new Date().getMonth());
  const [finViewYear,    setFinViewYear]    = useState(()=>new Date().getFullYear());
  const [editFee,        setEditFee]        = useState({});
  const [editPay,        setEditPay]        = useState({});
  const [addExtra,       setAddExtra]       = useState(null);
  const [extraForm,      setExtraForm]      = useState({type:"Decken waschen",qty:"1",amount:"5",desc:""});
  const [selDay,         setSelDay]         = useState(null);
  const [rbVisits,       setRbVisits]       = useState([]);
  const [showAddVisit,   setShowAddVisit]   = useState(false);
  const [newVisit,       setNewVisit]       = useState({date:"",note:"",isLesson:false});
  const [blockedDays,    setBlockedDays]    = useState([]); // [{id, adminId, date, note}]

  const weekDates = getWeekDates(weekOffset);
  const isAdmin   = currentUser?.type==="admin";
  const curYear   = today.getFullYear();
  const curMonth  = today.getMonth();

  const showToast = (msg, color="#c8913a") => { setToast({msg,color}); setTimeout(()=>setToast(null),2800); };

  const loadAll = useCallback(async () => {
    try {
      let { data: mRows } = await sb.from("members").select("*").order("id");
      if(!mRows||mRows.length===0){ await sb.from("members").insert(SEED_MEMBERS); mRows=SEED_MEMBERS; }
      setMembers(mRows.map(dbToMember));

      let { data: eRows } = await sb.from("events").select("*").order("date");
      if(!eRows||eRows.length===0){ await sb.from("events").insert(SEED_EVENTS); eRows=SEED_EVENTS; }
      setEvents(eRows.map(dbToEvent));

      const { data: mistRows } = await sb.from("mist_data").select("*");
      const mistObj = {};
      (mistRows||[]).forEach(r=>{ if(!mistObj[r.day_key]) mistObj[r.day_key]=[]; mistObj[r.day_key].push(r.member_id); });
      setMistData(mistObj);

      const { data: vacRows } = await sb.from("vacations").select("*");
      const vacObj = {};
      (vacRows||[]).forEach(r=>{ if(!vacObj[r.member_id]) vacObj[r.member_id]=[]; vacObj[r.member_id].push(dbToVac(r)); });
      setVacations(vacObj);

      const { data: faRows } = await sb.from("finance_accounts").select("*");
      const faObj = {};
      (faRows||[]).forEach(r=>{ faObj[r.member_id]={id:r.id,baseFee:r.base_fee||0}; });
      setFinAccounts(faObj);

      const { data: fmRows } = await sb.from("finance_months").select("*");
      const fmObj = {};
      (fmRows||[]).forEach(r=>{ fmObj[r.member_id+"_"+r.month]={id:r.id,extras:r.extras||[],payment:r.payment,carryover:r.carryover||0,notes:r.notes||""}; });
      setFinMonths(fmObj);

      const visitResult = await sb.from("rb_visits").select("*").order("date");
      if(visitResult.error) console.error("rb_visits error:", visitResult.error.message);
      setRbVisits((visitResult.data||[]).map(r=>({id:r.id, memberId:r.member_id, date:r.date, note:r.note||"", isLesson:r.is_lesson||false})));

      const blockedResult = await sb.from("rb_blocked_days").select("*").order("date");
      if(blockedResult.error) console.error("rb_blocked_days error:", blockedResult.error.message);
      setBlockedDays((blockedResult.data||[]).map(r=>({id:r.id, adminId:r.admin_id, date:r.date, note:r.note||""})));
    } catch(e) {
      showToast("⚠️ Verbindungsfehler – bitte neu laden","#c0392b");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(()=>{ loadAll(); },[loadAll]);

  useEffect(()=>{
    const channel = sb.channel("stallbuch-changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"mist_data"},()=>loadAll())
      .on("postgres_changes",{event:"*",schema:"public",table:"members"},()=>loadAll())
      // events: optimistic only (realtime would overwrite local deletes)
      // .on("postgres_changes",{event:"*",schema:"public",table:"events"},()=>loadAll())
      .on("postgres_changes",{event:"*",schema:"public",table:"vacations"},()=>loadAll())
      .on("postgres_changes",{event:"*",schema:"public",table:"finance_accounts"},()=>loadAll())
      .on("postgres_changes",{event:"*",schema:"public",table:"finance_months"},()=>loadAll())
      .on("postgres_changes",{event:"*",schema:"public",table:"rb_visits"},async()=>{
        const { data } = await sb.from("rb_visits").select("*").order("date").catch(()=>({data:[]}));
        setRbVisits((data||[]).map(r=>({id:r.id,memberId:r.member_id,date:r.date,note:r.note||"",isLesson:r.is_lesson||false})));
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"rb_blocked_days"},async()=>{
        const { data } = await sb.from("rb_blocked_days").select("*").order("date").catch(()=>({data:[]}));
        setBlockedDays((data||[]).map(r=>({id:r.id,adminId:r.admin_id,date:r.date,note:r.note||""})));
      })
      .subscribe();
    return ()=>sb.removeChannel(channel);
  },[loadAll]);

  const manualRefresh = async () => { setSyncing(true); await loadAll(); setSyncing(false); showToast("🔄 Aktualisiert!"); };

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

  const isMistLocked = (dayKey) => {
    if(isAdmin) return false;
    const [dy,dm] = dayKey.split("-").map(Number);
    const dayYM = dy*12+(dm-1);
    const nowYM = today.getFullYear()*12+today.getMonth();
    // Past and current month: always locked
    if(dayYM <= nowYM) return true;
    // Next month: open 1.–14. of current month, locked after 14th
    if(dayYM === nowYM+1) return today.getDate() > 14;
    // Everything further: always locked
    return true;
  };

  const toggleMist = async (dayKey, memberId) => {
    if(!currentUser) return;
    if(!isAdmin&&currentUser.id!==memberId) return;
    if(!isAdmin&&isMistLocked(dayKey)){
      showToast(today.getDate()>14?"🔒 Eintragungen nur bis zum 14. des Monats möglich":"🔒 Dieser Monat ist bereits gesperrt","#c0392b");
      return;
    }
    const daySlots=mistData[dayKey]||[]; const alreadyChecked=daySlots.includes(memberId);
    if(!alreadyChecked){
      if(daySlots.length>0){ showToast("⚠️ Dieser Tag ist bereits vergeben!","#c0392b"); return; }
      if(isOnVacationDay(memberId,dayKey,vacations)){ showToast("🌴 Urlaub eingetragen – kein Misten möglich.","#16a085"); return; }
    }
    setMistData(prev=>{ const day=prev[dayKey]||[]; return {...prev,[dayKey]:day.includes(memberId)?day.filter(x=>x!==memberId):[...day,memberId]}; });
    if(alreadyChecked) await sb.from("mist_data").delete().eq("day_key",dayKey).eq("member_id",memberId);
    else await sb.from("mist_data").insert({day_key:dayKey,member_id:memberId});
  };

  const openAddVacation = (memberId) => { setVacTargetId(memberId); setNewVac({from:"",to:"",note:"",mustCover:false}); setShowAddVacation(true); };
  const addVacation = async () => {
    if(!newVac.from||!newVac.to||newVac.from>newVac.to){ showToast("Bitte gültiges Datum wählen","#c0392b"); return; }
    const row={id:Date.now(),member_id:vacTargetId,from_date:newVac.from,to_date:newVac.to,note:newVac.note,must_cover:newVac.mustCover||false};
    setVacations(prev=>({...prev,[vacTargetId]:[...(prev[vacTargetId]||[]),dbToVac(row)]}));
    await sb.from("vacations").insert(row);
    setShowAddVacation(false); showToast(newVac.mustCover?"🔴 Urlaub eingetragen – Vertretung zwingend!":"🌴 Urlaub eingetragen!");
  };
  const deleteVacation = async (memberId, vacId) => {
    setVacations(prev=>({...prev,[memberId]:(prev[memberId]||[]).filter(v=>v.id!==vacId)}));
    await sb.from("vacations").delete().eq("id",vacId);
  };
  const updateVacation = async (memberId, vacId, updates) => {
    const row={from_date:updates.from,to_date:updates.to,note:updates.note,must_cover:updates.mustCover||false};
    setVacations(prev=>({...prev,[memberId]:(prev[memberId]||[]).map(v=>v.id===vacId?{...v,...updates}:v)}));
    await sb.from("vacations").update(row).eq("id",vacId);
    showToast("✅ Urlaub aktualisiert!");
  };


  const addEvent = async () => {
    if(!newEvent.date) return;
    const row={...newEvent,id:Date.now(),color:EVENT_COLORS[newEvent.type]||"#7f8c8d",created_by:currentUser.name};
    setEvents(p=>[...p,dbToEvent(row)]);
    await sb.from("events").insert(row);
    setNewEvent({type:"Tierarzt",date:"",time:"",note:""}); setShowAddEvent(false);
  };
  const deleteEvent = async id => { setEvents(p=>p.filter(e=>e.id!==id)); await sb.from("events").delete().eq("id",id); };
  const updateEvent = async (id, data) => {
    const updates = {type:data.type, date:data.date, time:data.time, note:data.note, color:EVENT_COLORS[data.type]||"#7f8c8d"};
    setEvents(p=>p.map(e=>e.id===id?{...e,...updates}:e));
    await sb.from("events").update(updates).eq("id",id);
    showToast("✅ Termin gespeichert!");
  };

  const addRbVisit = async (memberId) => {
    if(!newVisit.date) return;
    const rb = members.find(m=>m.id===memberId);
    const adminId = rb?.einstellerId;
    if(adminId && (blockedDays||[]).some(b=>b.date===newVisit.date&&b.adminId===adminId)) {
      showToast("🔒 Dieser Tag ist gesperrt!","#8e44ad"); return;
    }
    const row={id:Date.now(), member_id:memberId, date:newVisit.date, note:newVisit.note||"", is_lesson:newVisit.isLesson||false};
    setRbVisits(p=>[...p,{id:row.id,memberId,date:row.date,note:row.note,isLesson:row.is_lesson}]);
    const {error} = await sb.from("rb_visits").insert(row);
    if(error) { showToast("⚠️ Fehler: "+error.message,"#c0392b"); return; }
    setNewVisit({date:"",note:"",isLesson:false}); setShowAddVisit(false);
    showToast("✅ Besuch eingetragen!");
  };
  const deleteRbVisit = async (id) => {
    setRbVisits(p=>p.filter(v=>v.id!==id));
    await sb.from("rb_visits").delete().eq("id",id);
  };
  const updateRbVisit = async (id, data) => {
    const row={date:data.date, note:data.note||"", is_lesson:data.isLesson||false};
    setRbVisits(p=>p.map(v=>v.id===id?{...v,...data}:v));
    await sb.from("rb_visits").update(row).eq("id",id);
    showToast("✅ Besuch aktualisiert!");
  };
  const addBlockedDay = async (date, note="") => {
    const row={id:Date.now(), admin_id:currentUser.id, date, note};
    setBlockedDays(p=>[...p,{id:row.id,adminId:currentUser.id,date,note}]);
    const {error} = await sb.from("rb_blocked_days").insert(row);
    if(error) { showToast("⚠️ Fehler: "+error.message,"#c0392b"); return; }
    showToast("🚫 Tag für RB gesperrt!");
  };
  const deleteBlockedDay = async (id) => {
    setBlockedDays(p=>p.filter(d=>d.id!==id));
    await sb.from("rb_blocked_days").delete().eq("id",id);
    showToast("🔓 Sperrung für RB aufgehoben!");
  };

  const addMember = async () => {
    if(!newMember.name||!newMember.pin) return;
    const row={id:Date.now(),name:newMember.name,horse:newMember.horse,type:newMember.type,pin:newMember.pin,phone:newMember.phone,paid:newMember.type==="reitbeteiligung"?null:false,einsteller_id:newMember.einstellerId?parseInt(newMember.einstellerId):null};
    setMembers(p=>[...p,dbToMember(row)]);
    await sb.from("members").insert(row);
    setNewMember({name:"",horse:"",type:"einsteller",pin:"",phone:"",einstellerId:""}); setShowAddMember(false);
    showToast("✅ Mitglied hinzugefügt!");
  };
  const deleteMember = async id => { setMembers(p=>p.filter(m=>m.id!==id)); await sb.from("members").delete().eq("id",id); };
  const saveMemberEdit = async (id, editData) => {
    const updates={name:editData.name,horse:editData.horse,phone:editData.phone,pin:editData.pin,type:editData.type,paid:editData.type==="reitbeteiligung"?null:(members.find(m=>m.id===id)?.paid??false),einsteller_id:editData.einstellerId?parseInt(editData.einstellerId):null,mist_share:editData.mistShare??50,mist_mode:editData.mistMode||"percent"};
    const updated = dbToMember({id,...updates,einsteller_id:updates.einsteller_id,mist_share:updates.mist_share,mist_mode:updates.mist_mode});
    setMembers(p=>p.map(m=>m.id===id?{...m,...updated}:m));
    if(currentUser?.id===id) setCurrentUser(prev=>({...prev,...updated}));
    await sb.from("members").update(updates).eq("id",id);
    showToast("✅ Daten gespeichert!");
  };

  const einstellerList = members.filter(m=>m.type==="einsteller"||m.type==="admin");
  const upcomingEvents = [...events].sort((a,b)=>a.date.localeCompare(b.date)).filter(e=>e.date>=dk(today)).slice(0,5);
  const unpaid         = members.filter(m=>m.type==="einsteller"&&(()=>{ const fm=finMonths[m.id+"_"+curYear+"-"+String(curMonth+1).padStart(2,"0")]; return !fm||fm.payment===null||fm.payment===undefined; })());
  const mistWarnings   = einstellerList.filter(m=>{ if(m.type==="admin") return false; const mQ=getMonthlyQuota(m,members,vacations,curYear,curMonth); return countMistMonth(mistData,m.id,curYear,curMonth)<mQ; });
  const getVacationLabel = memberId => {
    const vacs=vacations[memberId]||[]; const now=dk(today);
    const active=vacs.find(v=>v.from<=now&&v.to>=now);
    if(active) return `🌴 Urlaub bis ${fmtSh(new Date(active.to+"T00:00:00"))}`;
    const upcoming=vacs.filter(v=>v.from>now).sort((a,b)=>a.from.localeCompare(b.from))[0];
    if(upcoming) return `🌴 Urlaub ab ${fmtSh(new Date(upcoming.from+"T00:00:00"))}`;
    return null;
  };

  const fmKey       = (memberId,year,month) => memberId+"_"+year+"-"+String(month+1).padStart(2,"0");
  const getFinMonth = (memberId,year,month) => finMonths[fmKey(memberId,year,month)]||{extras:[],payment:null,carryover:0,notes:""};
  const getBaseFee  = (memberId) => finAccounts[memberId]?.baseFee||0;
  const calcCarryoverRaw = (memberId, year, month) => {
    try {
      let pm = month - 1, py = year;
      if(pm < 0) { pm = 11; py--; }
      const prevFm = getFinMonth(memberId, py, pm);
      if(prevFm.payment === null || prevFm.payment === undefined) return 0;
      const prevBase = getBaseFee(memberId);
      const prevExtras = (prevFm.extras||[]).reduce((a,e)=>a+Number(e.amount||0),0);
      const prevTotal = prevBase + prevExtras;
      return Number((prevTotal - Number(prevFm.payment)).toFixed(2));
    } catch(e) { return 0; }
  };
  const calcCarryover = (memberId, year, month) => {
    try {
      let pm = month - 1, py = year;
      if(pm < 0) { pm = 11; py--; }
      const prevFm = getFinMonth(memberId, py, pm);
      if(prevFm.payment === null || prevFm.payment === undefined) return 0;
      const prevBase = getBaseFee(memberId);
      const prevExtras = (prevFm.extras||[]).reduce((a,e)=>a+Number(e.amount||0),0);
      const prevCarry = calcCarryoverRaw(memberId, py, pm);
      const prevTotal = prevBase + prevExtras + prevCarry;
      return Number((prevTotal - Number(prevFm.payment)).toFixed(2));
    } catch(e) { return 0; }
  };
  const calcTotal   = (memberId,year,month) => {
    const fm=getFinMonth(memberId,year,month); const base=getBaseFee(memberId);
    const extras=(fm.extras||[]).reduce((a,e)=>a+Number(e.amount),0);
    const carry=calcCarryover(memberId,year,month);
    return base+extras+carry;
  };
  const saveFinMonth = async (memberId,year,month,data) => {
    const key=fmKey(memberId,year,month); const mon=year+"-"+String(month+1).padStart(2,"0");
    const existing=finMonths[key];
    const row={member_id:memberId,month:mon,extras:"extras" in data?data.extras:(existing?.extras??[]),payment:"payment" in data?data.payment:(existing?.payment??null),carryover:"carryover" in data?data.carryover:(existing?.carryover??0),notes:"notes" in data?data.notes:(existing?.notes??"")};
    setFinMonths(prev=>({...prev,[key]:{...existing,...data}}));
    if(existing?.id) await sb.from("finance_months").update(row).eq("id",existing.id);
    else { const newRow={...row,id:Date.now()}; setFinMonths(prev=>({...prev,[key]:{...newRow}})); await sb.from("finance_months").insert(newRow); }
  };
  const saveBaseFee = async (memberId,fee) => {
    const existing=finAccounts[memberId];
    setFinAccounts(prev=>({...prev,[memberId]:{...prev[memberId],baseFee:fee}}));
    if(existing?.id) await sb.from("finance_accounts").update({base_fee:fee}).eq("id",existing.id);
    else { const row={id:Date.now(),member_id:memberId,base_fee:fee}; setFinAccounts(prev=>({...prev,[memberId]:{id:row.id,baseFee:fee}})); await sb.from("finance_accounts").insert(row); }
  };

  if(loading) return (
    <div style={{...S.root,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{fontSize:52,marginBottom:16}}>🐴</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#3d2b1f",marginBottom:8}}>Stallbuch</div>
      <div style={{fontSize:13,color:"#8b6040"}}>Verbinde mit Datenbank…</div>
      <div style={{marginTop:20,width:40,height:40,border:"3px solid #e2d5c0",borderTop:"3px solid #c8913a",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

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

  const tabs=[{id:"home",label:"Start",icon:"home"},{id:"calendar",label:"Termine",icon:"cal"},{id:"mist",label:"Mist",icon:"mist"},{id:"members",label:"Mitglieder",icon:"users"},{id:"finanzen",label:"Finanzen",icon:"money"}];

  // Shared props bundles
  const commonProps = { currentUser, isAdmin, members, vacations, einstellerList, showToast };
  const finHelpers  = { calcTotal, calcCarryover, getFinMonth, getBaseFee, saveFinMonth, saveBaseFee };

  return (
    <div style={S.root}>
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#fff",padding:"10px 20px",borderRadius:12,zIndex:500,fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,.2)",whiteSpace:"nowrap"}}>{toast.msg}</div>}
      <div style={S.header}>
        <div style={{...S.row,justifyContent:"space-between"}}>
          <div>
            <div style={S.hTitle}>🐴 Stallbuch</div>
            <div style={S.hSub}>{currentUser.name} · {currentUser.type==="admin"?"👑 Admin":currentUser.type==="einsteller"?"Einsteller":"Reitbeteiligung"}</div>
          </div>
          <div style={S.row}>
            <button onClick={manualRefresh} style={{background:"none",border:"none",cursor:"pointer",color:syncing?"#c8913a":"#b89060",padding:6}}><Ic n="sync" s={16}/></button>
            <button onClick={handleLogout} style={{background:"none",border:"none",cursor:"pointer",color:"#b89060",padding:6}}><Ic n="logout" s={18}/></button>
          </div>
        </div>
      </div>
      <div style={S.nav}>{tabs.map(t=><button key={t.id} style={S.navBtn(tab===t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>

      <div style={{paddingBottom:16}}>
        {tab==="home"     && <HomeScreen {...commonProps} events={events} mistData={mistData} finMonths={finMonths} finAccounts={finAccounts} selDay={selDay} setSelDay={setSelDay} upcomingEvents={upcomingEvents} unpaid={unpaid} mistWarnings={mistWarnings} getVacationLabel={getVacationLabel} rbVisits={rbVisits} blockedDays={blockedDays} {...finHelpers}/>}
        {tab==="calendar" && <CalendarScreen {...commonProps} events={events} showAddVacation={showAddVacation} setShowAddVacation={setShowAddVacation} newVac={newVac} setNewVac={setNewVac} vacTargetId={vacTargetId} openAddVacation={openAddVacation} addVacation={addVacation} deleteVacation={deleteVacation} updateVacation={updateVacation} deleteEvent={deleteEvent} updateEvent={updateEvent} setShowAddEvent={setShowAddEvent} rbVisits={rbVisits} showAddVisit={showAddVisit} setShowAddVisit={setShowAddVisit} newVisit={newVisit} setNewVisit={setNewVisit} addRbVisit={addRbVisit} deleteRbVisit={deleteRbVisit} updateRbVisit={updateRbVisit} blockedDays={blockedDays} addBlockedDay={addBlockedDay} deleteBlockedDay={deleteBlockedDay}/>}
        {tab==="mist"     && <MistScreen {...commonProps} mistData={mistData} weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} toggleMist={toggleMist} isMistLocked={isMistLocked} saveMemberEdit={saveMemberEdit} showToast={showToast}/>}
        {tab==="members"  && <MembersScreen {...commonProps} showAddMember={showAddMember} setShowAddMember={setShowAddMember} newMember={newMember} setNewMember={setNewMember} addMember={addMember} deleteMember={deleteMember} saveMemberEdit={saveMemberEdit} getVacationLabel={getVacationLabel} editId={editId} setEditId={setEditId} editData={editData} setEditData={setEditData} pinMode={pinMode} setPinMode={setPinMode} pins={pins} setPins={setPins} pinErr={pinErr} setPinErr={setPinErr}/>}
        {tab==="finanzen" && <FinanzenScreen {...commonProps} finMonths={finMonths} finAccounts={finAccounts} finViewMonth={finViewMonth} finViewYear={finViewYear} setFinViewMonth={setFinViewMonth} setFinViewYear={setFinViewYear} editFee={editFee} setEditFee={setEditFee} editPay={editPay} setEditPay={setEditPay} addExtra={addExtra} setAddExtra={setAddExtra} extraForm={extraForm} setExtraForm={setExtraForm} {...finHelpers}/>}
      </div>

      <div style={S.bNav}>{tabs.map(t=>(
        <button key={t.id} style={S.bBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
          <Ic n={t.icon} s={20}/><span style={{fontSize:9,fontWeight:600}}>{t.label}</span>
        </button>
      ))}</div>

      {/* Add Event Modal — in root */}
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
}
