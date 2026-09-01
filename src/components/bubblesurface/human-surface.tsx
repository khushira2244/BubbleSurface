"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ApprovalClient } from "@/server/webmcp/integration-contracts";
import { HumanReviewController } from "./human-surface.client";
import type { ActivityActorType, HumanSurfaceModel, HumanSurfaceStatus } from "./human-surface.types";
import styles from "./human-surface.module.css";

const STATUS: Record<HumanSurfaceStatus, { label: string; tone: "neutral" | "attention" | "positive" | "negative" | "active" }> = {
  IDLE:{label:"Idle",tone:"neutral"},AGENT_ACTIVE:{label:"Agent active",tone:"active"},
  HUMAN_REVIEW_REQUIRED:{label:"Human review required",tone:"attention"},APPROVED:{label:"Approved · awaiting execution",tone:"positive"},
  REJECTED:{label:"Rejected",tone:"negative"},SUPERSEDED:{label:"Superseded",tone:"neutral"},
  EXECUTING:{label:"Executing",tone:"active"},EXECUTION_SUCCEEDED:{label:"Execution succeeded",tone:"positive"},
  EXECUTION_FAILED:{label:"Execution failed",tone:"negative"},VERIFYING:{label:"Verifying",tone:"active"},
  VERIFIED:{label:"Verified",tone:"positive"},VERIFICATION_FAILED:{label:"Verification failed",tone:"negative"},
  STALE:{label:"Stale · review latest version",tone:"attention"},
};
export function StatusBadge({ status }: { status: HumanSurfaceStatus }) {
  const value=STATUS[status];return <span className={`${styles.badge} ${styles[value.tone]}`} aria-label={`Status: ${value.label}`}>{value.label}</span>;
}

export interface BubbleSurfacePanelProps {
  model: HumanSurfaceModel; approvalClient?: ApprovalClient; reload?: () => Promise<HumanSurfaceModel>;
  onModelChange?: (model: HumanSurfaceModel) => void; mode?: "embedded" | "standalone"; className?: string;
}
export function BubbleSurfacePanel({ model: supplied, approvalClient, reload, onModelChange, mode="standalone", className="" }: BubbleSurfacePanelProps) {
  const [model,setModel]=useState(supplied);useEffect(()=>setModel(supplied),[supplied]);
  const update=(next:HumanSurfaceModel)=>{setModel(next);onModelChange?.(next);};
  return <section className={`${styles.panel} ${mode==="embedded"?styles.embedded:""} ${className}`} aria-label="BubbleSurface human intervention">
    <header className={styles.header}><div><div className={styles.eyebrow}>{model.subject.type} · {model.subject.label}</div>
      <h2 className={styles.title}>{model.subject.title??"Human intervention"}</h2></div><StatusBadge status={model.status}/></header>
    <div className={styles.body}>
      <AgentActivity model={model}/>
      {model.proposal?<HumanReviewCard model={model} approvalClient={approvalClient} reload={reload} onModelChange={update}/>:null}
      <div className={styles.statusGrid}><ExecutionStatus model={model}/><VerificationStatus model={model}/></div>
      <ActivityTimeline events={model.activity}/>
    </div>
  </section>;
}

export function AgentActivity({model}:{model:HumanSurfaceModel}) {
  const latest=[...model.activity].reverse().find(event=>event.actorType==="AGENT");
  return <section className={styles.card} aria-label="Agent activity"><div className={styles.row}><h3>Agent activity</h3>
    <span className={styles.actor}>Authoritative trace</span></div><p className={latest?styles.reason:styles.empty}>{latest?.label??"No agent activity recorded."}</p>
    {latest?.detail?<div className={styles.eventDetail}>{latest.detail}</div>:null}</section>;
}

function ProposalSummary({model}:{model:HumanSurfaceModel}) {const p=model.proposal!;const entries=Object.entries(p.parameters).filter(([key])=>key!=="lifecycleVersion").slice(0,4);return <div className={styles.proposal}>
  <div className={styles.row}><strong>{p.actionDescription}</strong><span>Proposal v{p.version}</span></div><p className={styles.reason}>{p.rationale}</p>
  <div className={styles.metadata}><div className={styles.meta}><div className={styles.label}>Target</div>{model.subject.label}</div>
    <div className={styles.meta}><div className={styles.label}>Approval</div>{p.approvalState.toLowerCase()}</div>
    {entries.map(([key,value])=><div className={styles.meta} key={key}><div className={styles.label}>{humanize(key)}</div>{formatValue(value)}</div>)}</div>
  {p.staleReason?<div className={styles.error} role="status">{p.staleReason}</div>:null}</div>}

function HumanReviewCard({model,approvalClient,reload,onModelChange}:{model:HumanSurfaceModel;approvalClient?:ApprovalClient;reload?:()=>Promise<HumanSurfaceModel>;onModelChange:(m:HumanSurfaceModel)=>void}) {
  const proposal=model.proposal!,canReview=proposal.reviewable&&Boolean(approvalClient&&reload);
  const [busy,setBusy]=useState<"approve"|"reject"|"modify"|null>(null),[editing,setEditing]=useState(false);
  const [reason,setReason]=useState(proposal.rationale),[parameters,setParameters]=useState(()=>JSON.stringify(proposal.parameters,null,2)),[error,setError]=useState<string|null>(null);
  useEffect(()=>{setReason(proposal.rationale);setParameters(JSON.stringify(proposal.parameters,null,2));setEditing(false);setError(null);},[proposal.version,proposal.rationale,proposal.parameters]);
  const controller=useMemo(()=>approvalClient&&reload?new HumanReviewController(approvalClient,reload):null,[approvalClient,reload]);
  const base={actionId:proposal.actionId,proposalVersion:proposal.version,expectedLifecycleVersion:proposal.lifecycleVersion};
  const act=async(kind:"approve"|"reject")=>{if(!controller)return;setBusy(kind);setError(null);try{const next=kind==="approve"?await controller.approve(base):await controller.reject(base);onModelChange(next);}catch(cause){setError(safeMessage(cause));}finally{setBusy(null);}};
  const modify=async()=>{if(!controller)return;setBusy("modify");setError(null);try{const parsed=JSON.parse(parameters)as unknown;if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Parameters must be a JSON object.");const next=await controller.modify({...base,parameters:parsed as Record<string,unknown>,rationale:reason});onModelChange(next);}catch(cause){setError(safeMessage(cause));}finally{setBusy(null);}};
  return <section className={styles.card} aria-label="Human review"><div className={styles.row}><h3>{proposal.reviewable?"Human review":"Proposal state"}</h3><span className={styles.actor}>{proposal.proposalState}</span></div>
    <ProposalSummary model={model}/>{proposal.reviewable?<div className={styles.actions} aria-label="Proposal decisions">
      <button className={`${styles.button} ${styles.approve}`} disabled={!canReview||busy!==null} onClick={()=>void act("approve")}>{busy==="approve"?"Approving…":"Approve exact version"}</button>
      <button className={`${styles.button} ${styles.reject}`} disabled={!canReview||busy!==null} onClick={()=>void act("reject")}>{busy==="reject"?"Rejecting…":"Reject"}</button>
      <button className={`${styles.button} ${styles.modify}`} disabled={!canReview||busy!==null} aria-expanded={editing} onClick={()=>setEditing(value=>!value)}>Modify</button></div>:null}
    {editing&&canReview?<div className={styles.editor}><label>Reason or justification<input className={styles.input} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <label>Action parameters<textarea className={styles.textarea} value={parameters} onChange={event=>setParameters(event.target.value)} spellCheck={false}/></label>
      <div className={styles.eventDetail}>Saving creates a new proposal version, supersedes v{proposal.version}, and requires fresh approval.</div>
      <button className={`${styles.button} ${styles.approve}`} disabled={busy!==null||!reason.trim()} onClick={()=>void modify()}>{busy==="modify"?"Saving new version…":"Save as new version"}</button></div>:null}
    {proposal.reviewable&&!approvalClient?<p className={styles.empty}>Review controls are read-only until an approval client is connected.</p>:null}{error?<div className={styles.error} role="alert">{error}</div>:null}</section>;
}

export function ExecutionStatus({model}:{model:HumanSurfaceModel}) {const state=model.execution.state;return <section className={styles.card} aria-label="Execution status"><h3>Execution</h3><strong>{humanize(state)}</strong>
  <p className={state==="FAILED"||state==="UNKNOWN"?styles.error:styles.eventDetail}>{model.execution.message??executionMessage(state)}</p></section>}
export function VerificationStatus({model}:{model:HumanSurfaceModel}) {const value=model.verification;return <section className={styles.card} aria-label="Verification status"><h3>Verification</h3><strong>{humanize(value.state)}</strong>
  {value.checks.length?<ul>{value.checks.map(check=><li key={check.name}>{check.passed?"Passed":"Failed"}: {humanize(check.name)}</li>)}</ul>:<p className={styles.eventDetail}>{verificationMessage(value.state)}</p>}</section>}
export function ActivityTimeline({events}:{events:HumanSurfaceModel["activity"]}) {return <section className={styles.card} aria-label="Activity timeline"><h3>Activity</h3>{events.length?<ol className={styles.timeline}>{events.map(event=><li className={styles.event} key={event.id}>
  <span className={styles.actor}>{event.actorType}</span><span className={styles.dot} aria-hidden="true"/><div className={styles.eventBody}><div>{event.label}</div>{event.detail?<div className={styles.eventDetail}>{event.detail}</div>:null}<time className={styles.time} dateTime={event.occurredAt}>{shortTime(event.occurredAt)}</time></div></li>)}</ol>:<p className={styles.empty}>No authoritative activity recorded.</p>}</section>}

const humanize=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/^./,letter=>letter.toUpperCase());
const formatValue=(value:unknown)=>Array.isArray(value)?value.join(", "):typeof value==="object"?JSON.stringify(value):String(value);
const shortTime=(value:string)=>value.replace("T"," ").replace(/\.\d{3}Z$/, " UTC");
const safeMessage=(cause:unknown)=>cause instanceof Error?cause.message:"The review operation could not be completed.";
const executionMessage=(state:string)=>state==="NONE"?"No execution has been requested.":state==="SUCCEEDED"?"The authorized action completed.":state==="IN_PROGRESS"?"The authorized action is currently running.":"Execution state is awaiting an authoritative update.";
const verificationMessage=(state:string)=>state==="NONE"?"Verification begins after successful execution.":state==="PENDING"?"Execution completed; verification is pending.":state==="VERIFYING"?"Authoritative state is being checked.":"No verification details are available.";
