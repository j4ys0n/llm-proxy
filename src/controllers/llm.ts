import { Express, NextFunction, Request, RequestHandler, Response } from 'express'
import { log, md5, sleep, extractDomainName } from '../utils/general'
import axios, { AxiosRequestConfig } from 'axios'

export interface Model {
  id: string
  object: string
  owned_by: string
  permission: Array<any>
}

export interface ModelMap {
  [key: string]: { url: string; model: Model }
}

const defaultContentType = 'application/json'

function getPath(url: string): { path: string, base: string, apiKey?: string } {
  try {
    const urlParts = url.split('|')
    const apiKey = urlParts.length > 1 ? urlParts[1] : undefined
    const urlObject = new URL(url)
    return {
      path: urlObject.pathname || '/v1',
      base: urlObject.origin,
      apiKey
    }
  } catch (error) {
    // Return the input if it's already a path starting with '/'
    if (url.startsWith('/')) return { path: url, base: 'http://localhost' }
    // Return '/v1' for invalid URLs
    return { path: '/v1', base: 'http://localhost' }
  }
}

async function fetchModels(targetUrls: string[]): Promise<ModelMap> {
  const tmp: ModelMap = {}
  for (const urlAndToken of targetUrls) {
    const [url, apiKey] = urlAndToken.split('|').map(s => s.trim())
    const { path, base } = getPath(url)
    const headers: { [key: string]: string } = {
      accept: defaultContentType,
      'Content-Type': defaultContentType
    }
    if (apiKey != null && apiKey !== '') {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    const params = {
      method: 'GET',
      url: `${base}/${path}/models`,
      headers
    }
    try {
      const response = await axios(params)
      const models = response.data.data || []
      const hostId = extractDomainName(url)
      models.forEach((model: Model) => {
        const hash = md5(model.id)
        tmp[hash] = { url, model }
      })
      log('info', `Models cached successfully for ${url}. [${models.map((m: Model) => m.id).join(', ')}]`)
    } catch (error) {
      log('error', `Error fetching models from ${url}/v1/models: ${(error as any).toString()}`)
    }
  }
  return tmp
}

export class LLMController {
  private app: Express
  private requestHandlers: RequestHandler[]
  private targetUrls: Array<string> = []
  private modelCache: ModelMap = {}

  constructor({
    app,
    requestHandlers,
    targetUrls
  }: {
    app: Express
    requestHandlers: RequestHandler[]
    targetUrls: string[]
  }) {
    this.app = app
    this.requestHandlers = requestHandlers
    this.targetUrls = targetUrls
  }

  public registerRoutes(): void {
    this.app.get('/v1/models', ...this.requestHandlers, this.models.bind(this))
    this.app.use('/', ...this.requestHandlers, this.forwardPostRequest.bind(this))
    log('info', 'LLMController routes registered')
    log('info', 'fetching model lists')
    this.cacheModels()
  }

  private async cacheModels() {
    while (true) {
      this.modelCache = await fetchModels(this.targetUrls)
      await sleep(60000)
    }
  }

  private models(req: Request, res: Response): void {
    const combinedModels = Object.values(this.modelCache).map((item) => item.model)
    res.json({ data: combinedModels, object: 'list' })
  }

  public async forwardPostRequest(req: Request, res: Response, next: NextFunction) {
    if (
      req.method === 'POST' &&
      (req.path.startsWith('v1') || req.path.startsWith('/v1')) &&
      req.body != null &&
      req.body.model != null &&
      this.targetUrls.length > 0
    ) {
      const { model: modelId } = req.body
      const { base: firstBaseUrl, path: firstPath, apiKey: firstApiKey } = getPath(this.targetUrls[0])
      let targetUrl = firstBaseUrl // Default to first URL if no matching model found
      let targetPath = firstPath
      let targetApiKey = firstApiKey

      const hash = md5(modelId)
      if (modelId && this.modelCache[hash]) {
        const { path, base, apiKey } = getPath(this.modelCache[hash].url)
        targetUrl = base
        targetPath = path
        targetApiKey = apiKey
      }
      const reqPath = req.path.startsWith('/v1/') ? req.path.replace('/v1', targetPath) : `${targetPath}${req.path}`
      const fullUrl = new URL(reqPath, targetUrl).toString()
      log('info', `Forwarding request to: ${fullUrl} -> ${modelId}`)
      const headers = { ...req.headers }
      if (targetApiKey) {
        headers['Authorization'] = `Bearer ${targetApiKey}`
      }
      try {
        const axiosConfig: AxiosRequestConfig = {
          method: req.method,
          url: fullUrl,
          headers,
          data: req.body,
          responseType: 'stream'
        }

        // Remove headers that might cause issues
        if (axiosConfig.headers != null) {
          delete axiosConfig.headers['host']
          delete axiosConfig.headers['content-length']
        }

        const axiosResponse = await axios(axiosConfig)

        // Forward the response status and headers
        res.status(axiosResponse.status)
        Object.entries(axiosResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value)
        })

        // Pipe the response data
        axiosResponse.data.pipe(res)
      } catch (error) {
        log(`Error forwarding request: ${(error as any).toString()}`, 'error')
        if (axios.isAxiosError(error) && error.response) {
          // log(`Error response from ${fullUrl}:`, 'error', error.response.data)
          log(`Request body caused error:`, 'error', req.body)
          res.status(error.response.status).json({ error: 'Error processing request' })
        } else {
          res.status(500).json({ error: 'Internal Server Error' })
        }
      }
    } else {
      next()
    }
  }
}
