const PRODUCTION_PROJECT='twrihhyfvomqiqbxkitc'
const PRODUCTION_ORIGIN='https://driveshaftcable.com'
const STAGING_ORIGIN='https://dsc-referral-stage-20261103.onrender.com'
const unavailable=()=>{throw Error('Referral invitation origin is not configured for this environment')}

// Server configuration only: never accept a request/header/partner-supplied origin.
// The replacement project's exact ref must be explicitly approved/configured after creation.
export function referralInvitationOrigin(env){
 const backend=env.get('SUPABASE_URL')
 const stagingRef=env.get('REFERRAL_INVITE_STAGING_PROJECT_REF')
 const override=env.get('REFERRAL_INVITE_ORIGIN')
 if(backend===`https://${PRODUCTION_PROJECT}.supabase.co`){
  // A staging setting leaking into production must fail before issuing a bearer invitation.
  if(stagingRef||override)unavailable()
  return PRODUCTION_ORIGIN
 }
 if(!/^[a-z]{20}$/.test(stagingRef||'')||stagingRef===PRODUCTION_PROJECT||backend!==`https://${stagingRef}.supabase.co`||override!==STAGING_ORIGIN)unavailable()
 return STAGING_ORIGIN
}
