import React from 'react'
import {createRoot} from 'react-dom/client'
import EmailHealth from '../../src/components/admin/EmailHealth'
import '../../src/index.css'
const client={rpc:async(name,args)=>{const r=await fetch('/__health',{method:'POST',body:JSON.stringify({name,args})});return r.json()}}
createRoot(document.getElementById('root')).render(<div className="bg-gray-950 min-h-screen p-4"><EmailHealth client={client}/></div>)
