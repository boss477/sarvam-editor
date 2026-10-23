import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const client=new Client({name:"bharat-smoke-test",version:"1.0.0"});
const transport=new StdioClientTransport({command:process.execPath,args:["--env-file=apps/web/.env.local","scripts/editor-mcp.ts"]});
try{
 await client.connect(transport);
 const tools=await client.listTools();
 console.log("MCP tools:",tools.tools.map(t=>t.name).join(", "));
 const state=await client.callTool({name:"get_state",arguments:{}});
 if(state.isError)throw new Error(JSON.stringify(state));
 console.log("Editor state:",JSON.stringify(state));
 const added=await client.callTool({name:"add_captions",arguments:{captions:[{text:"Bharat Editor",startTime:0,duration:2},{text:"Namaste India",startTime:2,duration:2}]}});
 if(added.isError)throw new Error(JSON.stringify(added));
 console.log("Added captions:",JSON.stringify(added));
 for(const name of ["undo","redo","get_state"]){
  const result=await client.callTool({name,arguments:{}});
  if(result.isError)throw new Error(JSON.stringify(result));
  console.log(name,JSON.stringify(result));
 }
}finally{await client.close();}
