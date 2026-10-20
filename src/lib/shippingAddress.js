// Checkout ships to US addresses only — Canadian orders go through Royal
// Rigging. The form has no country field (it's always 'US'), so Canadian
// buyers show up as a province in "State" and/or a postal code in "ZIP".

const US_STATES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', DC: 'district of columbia',
  FL: 'florida', GA: 'georgia', HI: 'hawaii', ID: 'idaho', IL: 'illinois',
  IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky', LA: 'louisiana',
  ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan',
  MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana',
  NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey',
  NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota',
  OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania',
  RI: 'rhode island', SC: 'south carolina', SD: 'south dakota',
  TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia',
  WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming',
  // Territories and military mail
  PR: 'puerto rico', GU: 'guam', VI: 'virgin islands', AS: 'american samoa',
  MP: 'northern mariana islands', AA: 'armed forces americas',
  AE: 'armed forces europe', AP: 'armed forces pacific',
}

const CA_PROVINCES = {
  AB: 'alberta', BC: 'british columbia', MB: 'manitoba', NB: 'new brunswick',
  NL: 'newfoundland and labrador', NS: 'nova scotia', NT: 'northwest territories',
  NU: 'nunavut', ON: 'ontario', PE: 'prince edward island', QC: 'quebec',
  SK: 'saskatchewan', YT: 'yukon',
}

const US_ZIP = /^\d{5}(-\d{4})?$/
const CA_POSTAL = /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i

const normalizeRegion = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').replace(/^(state|province) of /, '')

const matches = (table, input) => {
  const v = normalizeRegion(input)
  return Object.entries(table).some(([code, name]) => v === code.toLowerCase() || v === name)
}

// Returns null when the address is shippable, otherwise the reason it isn't:
// 'canada' (route to Royal Rigging), 'state' or 'zip'.
export function getShippingAddressProblem({ state = '', zip = '' }) {
  const z = zip.trim()
  if (matches(CA_PROVINCES, state) || normalizeRegion(state) === 'canada' || CA_POSTAL.test(z)) {
    return 'canada'
  }
  if (!matches(US_STATES, state)) return 'state'
  if (!US_ZIP.test(z)) return 'zip'
  return null
}

export const SHIPPING_ADDRESS_MESSAGES = {
  canada: "We can't ship Canadian orders from this checkout. Please contact our Canadian partner, Royal Rigging, at 604-329-2214 or orders@royalrigging.ca to order.",
  state: 'Please enter a valid US state (e.g. TX). We only ship to US addresses from this checkout.',
  zip: 'Please enter a valid 5-digit US ZIP code (e.g. 77001).',
}
