// Offline fixture only. No provider credential, network, email, or production use.
import {solveChallenge} from 'altcha-lib'
import {deriveKey} from 'altcha-lib/algorithms/web/pbkdf2'
import {issueBuyerProofOfWork} from '../../supabase/functions/_shared/buyerProofOfWork.js'
export const fixtureSigningKey='sb_secret_offline_fixture_only_00000000000000000000000000000000'
export const fixtureContext={origin:'https://driveshaftcable.com',project:'https://twrihhyfvomqiqbxkitc.supabase.co',keyMaterial:fixtureSigningKey,stage:false}
export async function solvedBuyerChallenge(email,requestId,context=fixtureContext,options={}){
 const challenge=await issueBuyerProofOfWork(email,requestId,context,options)
 const solution=await solveChallenge({challenge,deriveKey,timeout:90000})
 if(!solution)throw Error('Offline fixture challenge timed out')
 return btoa(JSON.stringify({challenge,solution}))
}
