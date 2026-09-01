"use client";

import { BubbleSurfaceWeb, HttpCapabilitySnapshotTransport, type BubbleSurfaceWebState } from "../../server/webmcp/bubble-surface-web";
import type { BrowserWebMcpAdapter } from "../../server/webmcp/browser-webmcp.adapter";
import type { CapabilitySnapshotTransport } from "../../server/webmcp/integration-contracts";

export const LIVE_DEMO_SUBJECT={type:"INCIDENT",id:"INC-1001",category:"IDENTITY_SESSION_COMPROMISE"} as const;

export function initializeLiveWebMcp(options:{onChange:(state:BubbleSurfaceWebState)=>void;onError:(message:string)=>void;
  transport?:CapabilitySnapshotTransport;adapter?:BrowserWebMcpAdapter;refreshIntervalMs?:number}){
  return BubbleSurfaceWeb.init({subject:LIVE_DEMO_SUBJECT,transport:options.transport??new HttpCapabilitySnapshotTransport(),
    adapter:options.adapter,refreshIntervalMs:options.refreshIntervalMs??2_000,onChange:options.onChange,
    onError:error=>options.onError(error.message)});
}
