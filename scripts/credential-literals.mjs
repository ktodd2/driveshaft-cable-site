// Findings contain locations only. Never print matched text or parser errors.
export function credentialLiteralFindings(source, file) {
  const findings = []
  const sensitive = /token|secret|password|credential|api_?key/i
  const safeValue = value => {
    if (!value || value === '{}' || /^(?:YOUR_|<|\$\{)/.test(value)) return true
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
        ![...url.searchParams.keys()].some(k => sensitive.test(k))
    } catch { return false }
  }
  const report = (index, identifier, rule) => findings.push({ file,
    line: source.slice(0, index).split('\n').length, identifier, rule, present: true })
  const assignments = /(?:\b(?:const|let|var)\s+|[,{]\s*)["']?([\w$]+)["']?\s*(?::\s*(?:string|unknown))?\s*[:=]\s*(["'`])([^\n]*?)\2/g
  for (const m of source.matchAll(assignments)) {
    if (sensitive.test(m[1]) && !safeValue(m[3])) report(m.index, m[1], 'credential_literal')
  }
  const fallback = /\b([\w$]*(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)[\w$]*)\b[^\n;]*?(?:\|\||\?\?)\s*(["'`])([^\n]*?)\2/gi
  for (const m of source.matchAll(fallback)) {
    if (!safeValue(m[3])) report(m.index, m[1], 'credential_fallback')
  }
  for (const m of source.matchAll(/(?:eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|sk_(?:live|test)_[A-Za-z0-9]{12,})/g)) {
    report(m.index, 'redacted', 'credential_shape')
  }
  for (const m of source.matchAll(/["']Bearer\s+([A-Za-z0-9_.+/=-]{16,})["']/g)) {
    report(m.index, 'Authorization', 'literal_bearer')
  }
  return findings
}
