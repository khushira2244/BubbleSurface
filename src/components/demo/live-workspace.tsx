"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BubbleSurfaceNotifications, BubbleSurfacePanel, HttpHumanSurfaceClient } from "../bubblesurface";
import type { BubbleSurfaceNotificationMessageResolver } from "../bubblesurface";
import type { HumanSurfaceModel } from "../bubblesurface";
import { RefreshingApprovalClient } from "../../server/webmcp/approval-refresh.client";
import type { BubbleSurfaceWeb } from "../../server/webmcp/bubble-surface-web";
import { Icon } from "../landing/icons";
import { deriveLiveWorkspacePresentation, workflowStages } from "./live-workspace.model";
import type { LiveWorkspaceModel } from "./live-workspace.model";
import type { IncidentContext, Privilege } from "../../server/domain/security/security.schemas";
import { initializeLiveWebMcp } from "./live-webmcp.client";
import styles from "./live-workspace.module.css";

const formatTime=(value:string)=>new Intl.DateTimeFormat("en",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"UTC"}).format(new Date(value));
const humanize=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/^./,letter=>letter.toUpperCase());
const demoNotificationMessage:BubbleSurfaceNotificationMessageResolver=(event,fallback)=>event.eventType==="EXECUTION_SUCCEEDED"?"Finance Administrator privilege removed.":fallback;

export function LiveWorkspace({model}:{model:LiveWorkspaceModel}) {
  const [surfaceOpen,setSurfaceOpen]=useState(false);
  const [surface,setSurface]=useState<{status:"CHECKING"|"ACTIVE"|"UNAVAILABLE"|"ERROR";tools:string[]}>({status:"CHECKING",tools:[]});
  const [activity,setActivity]=useState<ToolActivity[]>([]);
  const [humanModel,setHumanModel]=useState(model.humanSurface);
  const [liveContext,setLiveContext]=useState<Pick<IncidentContext,"lifecycle"|"privileges">>({lifecycle:model.lifecycle,privileges:model.privileges});
  const webRef=useRef<BubbleSurfaceWeb|null>(null),openedProposal=useRef<string|null>(null);
  const humanClient=useMemo(()=>new HttpHumanSurfaceClient(),[]);
  const approvals=useMemo(()=>new RefreshingApprovalClient(humanClient,{refresh:async()=>webRef.current?.refresh()}),[humanClient]);
  const reloadHuman=async()=>await humanClient.loadLatestModel(model.humanSurface.subject)??model.humanSurface;
  const suspicious=model.sessions.find(session=>session.id==="SES-ASHA-SUSPICIOUS")??model.sessions[0];
  const privilege=liveContext.privileges.find(item=>item.id==="PRV-ASHA-FINADMIN")??liveContext.privileges[0];
  const investigation=model.capabilities.filter(item=>item.classification==="READ");
  useEffect(()=>{let disposed=false,integration:Awaited<ReturnType<typeof initializeLiveWebMcp>>|null=null;
    void initializeLiveWebMcp({onChange:state=>{if(!disposed)setSurface({status:state.available?"ACTIVE":"UNAVAILABLE",tools:state.registered})},
      onError:()=>{if(!disposed)setSurface(value=>({...value,status:"ERROR"}))}}).then(value=>{if(disposed)void value.dispose();else {integration=value;webRef.current=value}});
    return()=>{disposed=true;webRef.current=null;if(integration)void integration.dispose()};},[]);
  useEffect(()=>{let disposed=false,loading=false;const load=async()=>{if(loading)return;loading=true;try{const [next,contextResponse,privilegesResponse]=await Promise.all([humanClient.loadLatestModel(model.humanSurface.subject),fetch(`/api/incidents/${model.incident.id}/context`,{cache:"no-store"}),fetch(`/api/identities/${model.identity.id}/privileges`,{cache:"no-store"})]);
      if(disposed)return;if(next){setHumanModel(next);const key=`${next.proposal?.actionId}:${next.proposal?.version}`;if(next.status==="HUMAN_REVIEW_REQUIRED"&&openedProposal.current!==key){openedProposal.current=key;setSurfaceOpen(true)}}
      const contextBody=contextResponse.ok?await contextResponse.json() as {data?:IncidentContext}:undefined;
      const providerBody=privilegesResponse.ok?await privilegesResponse.json() as {data?:Privilege[]}:undefined;
      setLiveContext(previous=>({lifecycle:contextBody?.data?.lifecycle??previous.lifecycle,privileges:providerBody?.data??previous.privileges}));
    }catch{/* Keep the last authoritative snapshots. */}finally{loading=false}};
    void load();const timer=setInterval(()=>void load(),1_000);return()=>{disposed=true;clearInterval(timer)};},[humanClient,model.humanSurface.subject]);
  useEffect(()=>{let disposed=false,loading=false;const load=async()=>{if(loading)return;loading=true;try{const response=await fetch(`/api/incidents/${model.incident.id}/tool-activity`,{cache:"no-store"});
      if(!response.ok)return;const body=await response.json() as {data?:ToolActivity[]};if(!disposed)setActivity(body.data??[]);}catch{/* Keep the last authoritative snapshot. */}finally{loading=false}};
    void load();const timer=setInterval(()=>void load(),2_500);return()=>{disposed=true;clearInterval(timer)};},[model.incident.id]);
  const presentation=deriveLiveWorkspacePresentation(liveContext.lifecycle.state,privilege?.status,humanModel);
  const availableTools=surface.tools.length?surface.tools:investigation.map(item=>item.toolName);
  const capabilitySummary=presentation.recovered?"No sensitive action capabilities active":availableTools.some(name=>name.startsWith("verify_"))?"Verification capabilities available":availableTools.some(name=>name==="remove_approved_privilege"||name==="revoke_approved_sessions")?"Execution capability available":`${availableTools.length} investigation capabilities available`;
  return <main className={styles.page} data-responsive-shell="true">
    <header className={styles.topbar}><div className={styles.brand}><span><Icon name="shield" size={19}/></span><div><strong>Security Operations</strong><small>Identity defense workspace</small></div></div>
      <div className={styles.headerMeta}><span>Incident <strong>{model.incident.id}</strong></span><span className={presentation.recovered?styles.recoveredBadge:styles.severity}>{presentation.recovered?"RECOVERED":model.incident.severity}</span><span className={styles.state}>{presentation.recovered?"Containment verified":humanize(liveContext.lifecycle.state)}</span></div></header>
    <div className={styles.workspace}>
      <nav className={styles.rail} aria-label="Workspace sections"><Link href="/demo/test-case" aria-label="Back to test case">←</Link><span className={styles.railActive}><Icon name="shield" size={19}/></span><span><Icon name="human" size={19}/></span><span><Icon name="proposal" size={19}/></span></nav>
      <div className={styles.content}>
        <section className={`${styles.incidentHeader} ${presentation.recovered?styles.incidentRecovered:""}`}><div><span className={styles.eyebrow}>{presentation.recovered?"Recovered · Containment verified":"Active incident · Elastic / SIEM"}</span><h1>{liveContext.lifecycle.title}</h1><p>{model.incident.summary}</p></div><div className={styles.owner}><small>{presentation.recovered?"Outcome":"Owner"}</small><strong>{presentation.recovered?"Incident recovered":model.incident.owner??"Unassigned"}</strong><small>{presentation.recovered?"Required verification passed":"Response in progress"}</small></div></section>
        <IncidentProgress stages={presentation.stages}/>
        <section className={styles.factStrip} aria-label="Incident summary">
          <Fact icon="human" label="Affected identity" value={`${model.identity.displayName} · ${model.identity.id}`}/>
          <Fact icon="globe" label="Unfamiliar sign-in" value="Frankfurt, DE · high risk"/>
          <Fact icon="lock" label="Privilege change" value={privilege?`${privilege.name} · ${privilege.status}`:"No active privilege"}/>
          <Fact icon="surface" label="Critical access" value="Finance Administration Portal"/>
        </section>
        <div className={styles.mainGrid}>
          <section className={`${styles.card} ${styles.timelineCard}`}><CardHeader title="Evidence timeline" meta="Elastic / SIEM"/><ol className={styles.timeline}>{model.events.map((event,index)=><li key={event.id} className={index===0?styles.baseline:""}><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}<small>UTC</small></time><span className={styles.eventDot}/><div><span className={styles.eventType}>{humanize(event.eventType)}</span><strong>{event.summary}</strong><small>{event.id} · {event.source}</small></div></li>)}</ol></section>
          <aside className={styles.sideColumn}>
            <section className={styles.card}><CardHeader title="Current identity state" meta="Auth0"/><div className={styles.identityLead}><span><Icon name="human" size={24}/></span><div><strong>{model.identity.displayName}</strong><small>{model.identity.email}</small></div><em>{model.identity.riskLevel} RISK</em></div>
              <dl className={styles.stateList}><div><dt>Suspicious session</dt><dd>{suspicious?`${suspicious.status} · ${suspicious.tokenType}`:"Not active"}</dd></div><div><dt>Session location</dt><dd>{suspicious?.location??"—"}</dd></div><div className={styles.privilegeRow}><dt>Current privilege</dt><dd><strong>{privilege?.name??"None"}</strong>{privilege?<span className={presentation.privilegeRemoved?styles.revoked:styles.activePrivilege}>{privilege.status}</span>:null}</dd></div><div><dt>Privilege scope</dt><dd>{privilege?.scope??"—"}</dd></div><div><dt>Normal location</dt><dd>{model.identity.normalLocation}</dd></div></dl></section>
            {presentation.showOutcome?<ContainmentOutcome outcome={presentation.outcome} recovered={presentation.recovered}/>:null}
            <section className={styles.card}><CardHeader title="Current capability surface" meta={surfaceLabel(surface.status)}/><div className={styles.capabilityCount}><strong>{availableTools.length}</strong><span>{capabilitySummary}</span></div><p className={styles.surfaceMessage}>{surface.status==="ACTIVE"?"Derived from current lifecycle and approval state":surface.status==="CHECKING"?"Connecting browser capability surface…":surface.status==="UNAVAILABLE"?"Native WebMCP is unavailable in this browser":"Capability surface connection failed"}</p><details><summary>View capability names</summary><div className={styles.tools}>{availableTools.map(name=><code key={name}>{name}</code>)}</div></details></section>
            <section className={styles.card}><CardHeader title="Workflow activity" meta="Authoritative events"/>{activity.length?<ol className={styles.toolActivity}>{activity.slice(-6).reverse().map(event=><li key={event.id}><span className={event.status==="FAILED"?styles.failed:styles.activityDot}/><div><strong>{event.label?humanize(event.label):`${event.toolName} ${event.status==="STARTED"?"invoked":event.status.toLowerCase()}`}</strong><small>{event.actorId?`${event.actorType==="HUMAN"?"Human":"Agent"} · ${event.actorId}`:"System"} · {formatTime(event.occurredAt)} UTC</small></div></li>)}</ol>:<div className={styles.ready}><span><Icon name="check" size={18}/></span><div><strong>Workspace ready</strong><p>No agent or human workflow activity has been recorded yet.</p></div></div>}</section>
          </aside>
        </div>
        <footer className={styles.footer}><Link href="/demo/test-case">← Back to test case</Link><span>Live shell · no automated workflow running</span></footer>
      </div>
    </div>
    <button className={styles.surfaceTab} aria-expanded={surfaceOpen} aria-controls="bubblesurface-drawer" onClick={()=>setSurfaceOpen(open=>!open)}><span className={styles.surfaceMark}><Icon name="surface" size={22}/></span><span className={styles.tabText}><strong>BubbleSurface</strong><small>{humanModel.status==="IDLE"?"Idle · no action required":humanize(humanModel.status)}</small></span><span>{surfaceOpen?"×":"←"}</span></button>
    <aside id="bubblesurface-drawer" className={`${styles.drawer} ${surfaceOpen?styles.drawerOpen:""}`} aria-hidden={!surfaceOpen}><div className={styles.drawerTitle}><span>Embedded control surface</span><button onClick={()=>setSurfaceOpen(false)} aria-label="Close BubbleSurface">×</button></div><BubbleSurfacePanel model={humanModel} approvalClient={approvals} reload={reloadHuman} onModelChange={setHumanModel} mode="embedded" className={styles.humanPanel}/></aside>
    {surfaceOpen?<button className={styles.scrim} aria-label="Close BubbleSurface drawer" onClick={()=>setSurfaceOpen(false)}/>:null}
    <BubbleSurfaceNotifications events={activity} config={{enabled:true,position:"top-right",autoDismissMs:4_000,maxQueue:3}} resolveMessage={demoNotificationMessage}/>
  </main>;
}

function Fact({icon,label,value}:{icon:Parameters<typeof Icon>[0]["name"];label:string;value:string}) {return <div className={styles.fact}><span><Icon name={icon} size={19}/></span><div><small>{label}</small><strong>{value}</strong></div></div>}
function CardHeader({title,meta}:{title:string;meta:string}) {return <header className={styles.cardHeader}><h2>{title}</h2><span>{meta}</span></header>}
function IncidentProgress({stages}:{stages:ReturnType<typeof deriveLiveWorkspacePresentation>["stages"]}) {return <ol className={styles.progress} aria-label="Incident response progress">{stages.map((stage,index)=><li key={stage.label} className={styles[`progress${stage.state}`]} aria-current={stage.state==="CURRENT"?"step":undefined}><span>{stage.state==="COMPLETED"?"✓":index+1}</span><strong>{stage.label}</strong>{index<workflowStages.length-1?<i aria-hidden="true">→</i>:null}</li>)}</ol>}
function ContainmentOutcome({outcome,recovered}:{outcome:ReturnType<typeof deriveLiveWorkspacePresentation>["outcome"];recovered:boolean}) {return <section className={`${styles.card} ${styles.outcomeCard}`}><CardHeader title={recovered?"Containment outcome":"Containment status"} meta={recovered?"Recovered":"Live result"}/><dl className={styles.outcomeList}><Outcome label="Privilege removal" state={outcome.privilegeRemoval}/><Outcome label="Identity verification" state={outcome.identityVerification}/><Outcome label="Containment verification" state={outcome.containmentVerification}/>{recovered?<><Outcome label="Trusted session preserved" state={outcome.trustedSessionPreserved?"PASSED":"PENDING"}/><Outcome label="Incident recovered" state={outcome.incidentRecovered?"PASSED":"PENDING"}/></>:null}</dl></section>}
function Outcome({label,state}:{label:string;state:"COMPLETED"|"PASSED"|"FAILED"|"PENDING"}) {return <div><dt>{label}</dt><dd className={state==="FAILED"?styles.outcomeFailed:state==="PENDING"?styles.outcomePending:styles.outcomePassed}>{state==="COMPLETED"||state==="PASSED"?"✓ ":state==="FAILED"?"! ":"○ "}{state}</dd></div>}
type ToolActivity={id:string;eventType:string;toolName:string;label?:string;status:"STARTED"|"SUCCEEDED"|"FAILED";actorType:string;actorId:string|null;occurredAt:string;lifecycleVersion:number|null};
const surfaceLabel=(status:"CHECKING"|"ACTIVE"|"UNAVAILABLE"|"ERROR")=>status==="ACTIVE"?"WebMCP active":status==="CHECKING"?"WebMCP connecting":status==="UNAVAILABLE"?"WebMCP unavailable":"WebMCP error";
