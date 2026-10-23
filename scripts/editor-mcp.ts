import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema,ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { toolDefinitions,type ToolName } from "../apps/web/src/agent/tools";
const server=new Server({name:"bharat-editor",version:"0.1.0"},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:Object.entries(toolDefinitions).map(([name,t])=>({name,description:t.description,inputSchema:z.toJSONSchema(t.schema)}))}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
 try{
  const name=request.params.name;
  if(!Object.hasOwn(toolDefinitions,name))throw new Error("Unknown tool.");
  const args=toolDefinitions[name as ToolName].schema.parse(request.params.arguments||{});
  const url=process.env.EDITOR_URL||"http://localhost:3000";
  if(!process.env.EDITOR_AGENT_TOKEN)throw new Error("Set EDITOR_AGENT_TOKEN to match the editor server.");
  const response=await fetch(url+"/api/editor-agent",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.EDITOR_AGENT_TOKEN},body:JSON.stringify({action:"call",name,args}),signal:AbortSignal.timeout(185000)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"Editor request failed");
  return {content:[{type:"text" as const,text:JSON.stringify(data.result)}]};
 }catch(error){return {isError:true,content:[{type:"text" as const,text:error instanceof Error?error.message:"Tool failed"}]};}
});
await server.connect(new StdioServerTransport());
