import { exec } from 'child_process'
import { readFile, writeFile } from 'fs-extra'
import { promisify } from 'util'
import { log } from './general'

const execAsync = promisify(exec)

export interface NginxResponse {
  success: boolean
  message?: string
}

export interface NginxConfigResponse {
  success: boolean
  config: string
  message?: string
}

export class NginxManager {
  private configPath: string
  private domains: string[]

  constructor(configPath: string = '/etc/nginx/nginx.conf', domains: string[] = []) {
    this.configPath = configPath
    this.domains = domains
  }

  async start(): Promise<NginxResponse> {
    let message: string | undefined
    let success = false
    try {
      await execAsync('nginx')
      message = 'Nginx started successfully.'
      success = true
      log('info', message)
    } catch (error) {
      log('error', 'Failed to start Nginx:', error)
      message = error != null ? (error as any).message ?? 'Error' : 'Unknown error'
    }
    return { success, message }
  }

  async reload(): Promise<NginxResponse> {
    let message: string | undefined
    let success = false
    try {
      await execAsync('nginx -s reload')
      message = 'Nginx configuration reloaded successfully.'
      success = true
      log('info', message)
    } catch (error) {
      log('error', 'Failed to reload Nginx.', error)
      message = error != null ? (error as any).message ?? 'Error' : 'Unknown error'
    }
    return { success, message }
  }

  async updateConfig(newConfig: string): Promise<NginxResponse> {
    let message: string | undefined
    let success = false
    try {
      await writeFile(this.configPath, newConfig)
      message = 'Nginx configuration updated.'
      success = true
      log('info', message)
      await this.reload()
    } catch (error) {
      log('error', 'Failed to update Nginx configuration.', error)
      message = error != null ? (error as any).message ?? 'Error' : 'Unknown error'
    }
    return { success, message }
  }

  async getConfig(): Promise<NginxConfigResponse> {
    let config: string = ''
    let message: string | undefined
    let success = false
    try {
      config = await readFile(this.configPath, 'utf-8')
      success = true
    } catch (error) {
      log('error', 'Failed to read Nginx configuration.', error)
      message = error != null ? (error as any).message ?? 'Error' : 'Unknown error'
    }
    return { success, config, message }
  }

  async obtainCertificates(cloudflare?: boolean): Promise<NginxResponse> {
    const domainArgs = this.domains.map(domain => `-d ${domain}`).join(' ')
    let message: string | undefined
    let success = false
    const cloudflareFlags = cloudflare
      ? ' --dns-cloudflare --dns-cloudflare-credentials /opt/cloudflare/credentials' : ''
    const command = `certbot --nginx -n --agree-tos --issuance-timeout 120 ${cloudflareFlags}${domainArgs} --preferred-challenges dns-01`
    try {
      await execAsync(command)
      message = 'Certificates obtained successfully.'
      success = true
      log('info', message)
    } catch (error) {
      log('error', 'Failed to obtain certificates.', error)
      message = error != null ? (error as any).message ?? 'Error' : 'Unknown error'
      message = `command: ${command}\n${message}`
    }
    return { success, message }
  }

  async renewCertificates(): Promise<NginxResponse> {
    let message: string | undefined
    let success = false
    const command = 'certbot renew'
    try {
      await execAsync(command)
      message = 'Certificates renewed successfully.'
      success = true
      log('info', message)
    } catch (error) {
      log('error', 'Failed to renew certificates.', error)
      message = error != null ? (error as any).message ?? 'Error' : 'Unknown error'
      message = `command: ${command}\n${message}`
    }
    return { success, message }
  }
}
