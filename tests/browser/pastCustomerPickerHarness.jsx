import React,{useCallback,useState} from 'react'
import {createRoot} from 'react-dom/client'
import PastCustomerPicker from '../../src/components/admin/PastCustomerPicker'
import '../../src/index.css'
function Fixture(){const [selected,setSelected]=useState(null)
 const search=useCallback(async(query,after)=>{const response=await fetch('/__past_customers',{method:'POST',body:JSON.stringify({query,after})});if(!response.ok)throw Error('offline');return await response.json()},[])
 return <main className="max-w-2xl mx-auto p-5 text-white"><h1>Past customer search fixture</h1><PastCustomerPicker search={search} onChoose={setSelected}/><p role="status" className="mt-4">{selected?'Selected: '+selected.email:'No customer selected'}</p></main>}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>)
