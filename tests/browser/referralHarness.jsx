import React from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {HelmetProvider} from 'react-helmet-async'
import ReferralSignupPage from '../../src/pages/ReferralSignupPage'
import ReferralRewards from '../../src/components/admin/ReferralRewards'
import '../../src/index.css'
const client={functions:{invoke:async(name,options)=>{const r=await fetch('/__referrals',{method:'POST',body:JSON.stringify({name,...options.body})});return {data:await r.json()}}},rpc:async()=>({data:{attention:0}})}
createRoot(document.getElementById('root')).render(<React.StrictMode><HelmetProvider><MemoryRouter>{window.location.pathname==='/referral/signup'?<ReferralSignupPage/>:<ReferralRewards client={client}/>}</MemoryRouter></HelmetProvider></React.StrictMode>)
