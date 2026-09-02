export type BubbleSurfaceNotificationPosition="top-right"|"top-left"|"bottom-right"|"bottom-left";
export interface BubbleSurfaceNotificationConfig {enabled:boolean;position?:BubbleSurfaceNotificationPosition;autoDismissMs?:number;maxQueue?:number}
export interface BubbleSurfaceNotificationEvent {id:string;eventType:string}
export interface BubbleSurfaceNotification {id:string;sourceEventId:string;type:string;message:string}
export type BubbleSurfaceNotificationMessageResolver=(event:BubbleSurfaceNotificationEvent,defaultMessage:string)=>string;
