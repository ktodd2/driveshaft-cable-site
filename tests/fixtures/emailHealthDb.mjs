export function memoryDb() {
  const tables = { email_attempts: [], automation_runs: [] }
  let seq = 0
  return { tables, from(table) {
    let op='read', payload, field, value
    const q = { insert(v){op='insert';payload=v;return q},update(v){op='update';payload=v;return q},select(){return q},eq(f,v){field=f;value=v;return q},single(){return q},then(resolve,reject){return Promise.resolve().then(()=>{
      const rows=tables[table]
      if(op==='insert') {
        if(table==='email_attempts' && rows.some(r=>r.dedupe_key===payload.dedupe_key)) return {error:{code:'23505'}}
        const row={id:String(++seq),status:table==='email_attempts'?'pending':'running',...payload};rows.push(row);return {data:row}
      }
      const row=rows.find(r=>r[field]===value)
      if(op==='update')Object.assign(row,payload)
      return {data:row}
    }).then(resolve,reject)} };return q
  } }
}
