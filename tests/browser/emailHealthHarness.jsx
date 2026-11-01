import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import EmailHealth from '../../src/components/admin/EmailHealth'
import '../../src/index.css'
const client={rpc:async(name,args)=>{const r=await fetch('/__health',{method:'POST',body:JSON.stringify({name,args})});return r.json()}}
function Harness(){const [order,setOrder]=useState(null);return <div className="bg-gray-950 min-h-screen p-4"><button onClick={()=>setOrder('order-A')}>Fixture order A</button><button onClick={()=>setOrder('order-B')}>Fixture order B</button><EmailHealth orderId={order} client={client}/></div>}
createRoot(document.getElementById('root')).render(<Harness/>)
