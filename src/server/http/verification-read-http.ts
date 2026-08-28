import{NextResponse}from"next/server";import{controlPlaneService}from"../container";
const readModel=<T extends{success:boolean}>(value:T)=>({...value,status:value.success?"PASSED":"FAILED"});
export const listVerifications=(actionId:string)=>NextResponse.json({actionId,verifications:controlPlaneService.listVerificationResults(actionId).map(readModel)});
export const readVerification=(id:string)=>{const result=controlPlaneService.getVerificationResult(id);return result?NextResponse.json(readModel(result)):NextResponse.json({error:{code:"VERIFICATION_NOT_FOUND",message:"Verification was not found."}},{status:404});};
