"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BubbleSurfacePanel, HttpHumanSurfaceClient } from "../bubblesurface";
import type { HumanSurfaceModel } from "../bubblesurface";
import { RefreshingApprovalClient } from "../../server/webmcp/approval-refresh.client";
import type { BubbleSurfaceWeb } from "../../server/webmcp/bubble-surface-web";
import { Icon } from "../landing/icons";
import type { LiveWorkspaceModel } from "./live-workspace.model";
import { initializeLiveWebMcp } from "./live-webmcp.client";
import styles from "./live-workspace.module.css";

const formatTime=(value:string)=>new Intl.DateTimeFormat("en",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"UTC"}).format(new Date(value));
const humanize=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/^./,letter=>letter.toUpperCase());

export function LiveWorkspace({model}:{model:LiveWorkspaceModel}) {
  const [surfaceOpen,setSurfaceOpen]=useState(false);
  const [surface,setSurface]=useState<{status:"CHECKING"|"ACTIVE"|"UNAVAILABLE"|"ERROR";tools:string[]}>({status:"CHECKING",tools:[]});
  const [activity,setActivity]=useState<ToolActivity[]>([]);
  const [humanModel,setHumanModel]=useState(model.humanSurface);
  const webRef=useRef<BubbleSurfaceWeb|null>(null),openedProposal=useRef<string|null>(null);
  const humanClient=useMemo(()=>new HttpHumanSurfaceClient(),[]);
  const approvals=useMemo(()=>new RefreshingApprovalClient(humanClient,{refresh:async()=>webRef.current?.refresh()}),[humanClient]);
  const reloadHuman=async()=>await humanClient.loadLatestModel(model.humanSurface.subject)??model.humanSurface;
  const suspicious=model.sessions.find(session=>session.id==="SES-ASHA-SUSPICIOUS")??model.sessions[0];
  const privilege=model.privileges.find(item=>item.id==="PRV-ASHA-FINADMIN")??model.privileges[0];
  const investigation=model.capabilities.filter(item=>item.classification==="READ");
  useEffect(()=>{let disposed=false,integration:Awaited<ReturnType<typeof initializeLiveWebMcp>>|null=null;
    void initializeLiveWebMcp({onChange:state=>{if(!disposed)setSurface({status:state.available?"ACTIVE":"UNAVAILABLE",tools:state.registered})},
      onError:()=>{if(!disposed)setSurface(value=>({...value,status:"ERROR"}))}}).then(value=>{if(disposed)void value.dispose();else {integration=value;webRef.current=value}});
    return()=>{disposed=true;webRef.current=null;if(integration)void integration.dispose()};},[]);
  useEffect(()=>{let disposed=false,loading=false;const load=async()=>{if(loading)return;loading=true;try{const next=await humanClient.loadLatestModel(model.humanSurface.subject);if(!disposed&&next){setHumanModel(next);const key=`${next.proposal?.actionId}:${next.proposal?.version}`;if(next.status==="HUMAN_REVIEW_REQUIRED"&&openedProposal.current!==key){openedProposal.current=key;setSurfaceOpen(true)}}}catch{/* Keep the last authoritative human model. */}finally{loading=false}};
    void load();const timer=setInterval(()=>void load(),1_000);return()=>{disposed=true;clearInterval(timer)};},[humanClient,model.humanSurface.subject]);
  useEffect(()=>{let disposed=false,loading=false;const load=async()=>{if(loading)return;loading=true;try{const response=await fetch(`/api/incidents/${model.incident.id}/tool-activity`,{cache:"no-store"});
      if(!response.ok)return;const body=await response.json() as {data?:ToolActivity[]};if(!disposed)setActivity(body.data??[]);}catch{/* Keep the last authoritative snapshot. */}finally{loading=false}};
    void load();const timer=setInterval(()=>void load(),2_500);return()=>{disposed=true;clearInterval(timer)};},[model.incident.id]);
  const activeReads=surface.status==="ACTIVE"?surface.tools.filter(name=>investigation.some(tool=>tool.toolName===name)).length:investigation.length;
  return <main className={styles.page} data-responsive-shell="true">
    <header className={styles.topbar}><div className={styles.brand}><span><Icon name="shield" size={19}/></span><div><strong>Security Operations</strong><small>Identity defense workspace</small></div></div>
      <div className={styles.headerMeta}><span>Incident <strong>{model.incident.id}</strong></span><span className={styles.severity}>{model.incident.severity}</span><span className={styles.state}>{humanize(model.lifecycle.state)}</span></div></header>
    <div className={styles.workspace}>
      <nav className={styles.rail} aria-label="Workspace sections"><Link href="/demo/test-case" aria-label="Back to test case">←</Link><span className={styles.railActive}><Icon name="shield" size={19}/></span><span><Icon name="human" size={19}/></span><span><Icon name="proposal" size={19}/></span></nav>
      <div className={styles.content}>
        <section className={styles.incidentHeader}><div><span className={styles.eyebrow}>Active incident · Elastic / SIEM</span><h1>{model.lifecycle.title}</h1><p>{model.incident.summary}</p></div><div className={styles.owner}><small>Owner</small><strong>{model.incident.owner??"Unassigned"}</strong><small>Lifecycle v{model.lifecycle.version}</small></div></section>
        <section className={styles.factStrip} aria-label="Incident summary">
          <Fact icon="human" label="Affected identity" value={`${model.identity.displayName} · ${model.identity.id}`}/>
          <Fact icon="globe" label="Unfamiliar sign-in" value="Frankfurt, DE · high risk"/>
          <Fact icon="lock" label="Privilege change" value={privilege?`${privilege.name} · ${privilege.status.toLowerCase()}`:"No active privilege"}/>
          <Fact icon="surface" label="Critical access" value="Finance Administration Portal"/>
        </section>
        <div className={styles.mainGrid}>
          <section className={`${styles.card} ${styles.timelineCard}`}><CardHeader title="Evidence timeline" meta="Elastic / SIEM"/><ol className={styles.timeline}>{model.events.map((event,index)=><li key={event.id} className={index===0?styles.baseline:""}><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}<small>UTC</small></time><span className={styles.eventDot}/><div><span className={styles.eventType}>{humanize(event.eventType)}</span><strong>{event.summary}</strong><small>{event.id} · {event.source}</small></div></li>)}</ol></section>
          <aside className={styles.sideColumn}>
            <section className={styles.card}><CardHeader title="Current identity state" meta="Auth0"/><div className={styles.identityLead}><span><Icon name="human" size={24}/></span><div><strong>{model.identity.displayName}</strong><small>{model.identity.email}</small></div><em>{model.identity.riskLevel} RISK</em></div>
              <dl className={styles.stateList}><div><dt>Suspicious session</dt><dd>{suspicious?`${suspicious.status} · ${suspicious.tokenType}`:"Not active"}</dd></div><div><dt>Session location</dt><dd>{suspicious?.location??"—"}</dd></div><div><dt>Current privilege</dt><dd>{privilege?`${privilege.name} · ${privilege.scope}`:"None"}</dd></div><div><dt>Normal location</dt><dd>{model.identity.normalLocation}</dd></div></dl></section>
            <section className={styles.card}><CardHeader title="Current capability surface" meta={surfaceLabel(surface.status)}/><div className={styles.capabilityCount}><strong>{activeReads}</strong><span>investigation capabilities currently available</span></div><p className={styles.surfaceMessage}>{surface.status==="ACTIVE"?"Waiting for external agent":surface.status==="CHECKING"?"Connecting browser capability surface…":surface.status==="UNAVAILABLE"?"Native WebMCP is unavailable in this browser":"Capability surface connection failed"}</p><details><summary>View capability names</summary><div className={styles.tools}>{(surface.tools.length?surface.tools:investigation.map(item=>item.toolName)).map(name=><code key={name}>{name}</code>)}</div></details></section>
            <section className={styles.card}><CardHeader title="Workflow activity" meta="Authoritative events"/>{activity.length?<ol className={styles.toolActivity}>{activity.slice(-6).reverse().map(event=><li key={event.id}><span className={event.status==="FAILED"?styles.failed:styles.activityDot}/><div><strong>{event.label?humanize(event.label):`${event.toolName} ${event.status==="STARTED"?"invoked":event.status.toLowerCase()}`}</strong><small>{event.actorId?`${event.actorType==="HUMAN"?"Human":"Agent"} · ${event.actorId}`:"System"} · {formatTime(event.occurredAt)} UTC</small></div></li>)}</ol>:<div className={styles.ready}><span><Icon name="check" size={18}/></span><div><strong>Workspace ready</strong><p>No agent or human workflow activity has been recorded yet.</p></div></div>}</section>
          </aside>
        </div>
        <footer className={styles.footer}><Link href="/demo/test-case">← Back to test case</Link><span>Live shell · no automated workflow running</span></footer>
      </div>
    </div>
    <button className={styles.surfaceTab} aria-expanded={surfaceOpen} aria-controls="bubblesurface-drawer" onClick={()=>setSurfaceOpen(open=>!open)}><span className={styles.surfaceMark}><Icon name="surface" size={22}/></span><span className={styles.tabText}><strong>BubbleSurface</strong><small>{humanModel.status==="IDLE"?"Idle · no action required":humanize(humanModel.status)}</small></span><span>{surfaceOpen?"×":"←"}</span></button>
    <aside id="bubblesurface-drawer" className={`${styles.drawer} ${surfaceOpen?styles.drawerOpen:""}`} aria-hidden={!surfaceOpen}><div className={styles.drawerTitle}><span>Embedded control surface</span><button onClick={()=>setSurfaceOpen(false)} aria-label="Close BubbleSurface">×</button></div><BubbleSurfacePanel model={humanModel} approvalClient={approvals} reload={reloadHuman} onModelChange={setHumanModel} mode="embedded" className={styles.humanPanel}/></aside>
    {surfaceOpen?<button className={styles.scrim} aria-label="Close BubbleSurface drawer" onClick={()=>setSurfaceOpen(false)}/>:null}
  </main>;
}

function Fact({icon,label,value}:{icon:Parameters<typeof Icon>[0]["name"];label:string;value:string}) {return <div className={styles.fact}><span><Icon name={icon} size={19}/></span><div><small>{label}</small><strong>{value}</strong></div></div>}
function CardHeader({title,meta}:{title:string;meta:string}) {return <header className={styles.cardHeader}><h2>{title}</h2><span>{meta}</span></header>}
type ToolActivity={id:string;eventType:string;toolName:string;label?:string;status:"STARTED"|"SUCCEEDED"|"FAILED";actorType:string;actorId:string|null;occurredAt:string;lifecycleVersion:number|null};
const surfaceLabel=(status:"CHECKING"|"ACTIVE"|"UNAVAILABLE"|"ERROR")=>status==="ACTIVE"?"WebMCP active":status==="CHECKING"?"WebMCP connecting":status==="UNAVAILABLE"?"WebMCP unavailable":"WebMCP error";
