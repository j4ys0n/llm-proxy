import crypto from 'crypto'

export function log(level: string, msg: string, error?: any) {
  console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`)
  if (error != null) {
    console.error(error)
  }
}

export function md5(data: Object | string): string {
  const stringValue = typeof data === 'string' ? data : JSON.stringify(data)
  return crypto.createHash('md5').update(stringValue).digest('hex')
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function extractDomainName(url: string) {
  return url.replace('https://', '').replace('http://', '').split('/')[0].replace(/\./g, '_')
}