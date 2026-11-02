import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import SuggestionReview from '../../src/components/admin/SuggestionReview'
import '../../src/index.css'
const client={rpc:async(name,args)=>{const response=await fetch('/__review',{method:'POST',body:JSON.stringify({name,args})});return response.json()}}
createRoot(document.getElementById('root')).render(<BrowserRouter><div className="min-h-screen bg-gray-950"><SuggestionReview client={client}/></div></BrowserRouter>)
