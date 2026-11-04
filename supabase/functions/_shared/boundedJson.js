// Public challenge requests must be bounded while streaming, before allocation
// of the complete body. Content-Length alone is never trusted as the limit.
export async function readBoundedJson(request,{maxBytes=4096,timeoutMs=10000}={}){
 const declared=request.headers.get('content-length')
 if(declared&&/^\d+$/.test(declared)&&Number(declared)>maxBytes)throw Error('Request too large')
 if(!request.body)throw Error('Request body required')
 const reader=request.body.getReader(),chunks=[]
 let total=0,expired=false
 const timer=setTimeout(()=>{expired=true;reader.cancel().catch(()=>{})},timeoutMs)
 try{
  while(true){
   const {done,value}=await reader.read()
   if(expired)throw Error('Request timed out')
   if(done)break
   total+=value.byteLength
   if(total>maxBytes){await reader.cancel();throw Error('Request too large')}
   chunks.push(value)
  }
  const bytes=new Uint8Array(total);let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 }finally{clearTimeout(timer);reader.releaseLock()}
}
