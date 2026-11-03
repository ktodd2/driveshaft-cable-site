export const REFERRAL_CODE_PATTERN='[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]'
export const REFERRAL_CODE_HELP='Use 3–24 letters, numbers or internal hyphens; no spaces. Codes are case-insensitive.'
export function normalizeReferralCode(value){return String(value??'').trim().toUpperCase()}
export function referralCodeProblem(value){return new RegExp(`^${REFERRAL_CODE_PATTERN}$`).test(normalizeReferralCode(value))?null:REFERRAL_CODE_HELP}
export function generateReferralCode(random=crypto){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=random.getRandomValues(new Uint8Array(8))
 return 'DC-'+Array.from(bytes,b=>alphabet[b%32]).join('')
}
