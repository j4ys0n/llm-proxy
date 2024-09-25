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

async function fetchModels(targetUrls: string[]): Promise<ModelMap> {
  const tmp: ModelMap = {}
  for (const url of targetUrls) {
    try {
      const response = await axios.get(`${url}/v1/models`)
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
      (req.path.startsWith('v1/') || req.path.startsWith('/v1/')) &&
      req.body != null &&
      req.body.model != null &&
      this.targetUrls.length > 0
    ) {
      const { model: modelId } = req.body
      let targetUrl = this.targetUrls[0] // Default to first URL if no matching model found

      const hash = md5(modelId)
      if (modelId && this.modelCache[hash]) {
        targetUrl = this.modelCache[hash].url
      }
      const fullUrl = new URL(req.path, targetUrl).toString()
      log('info', `Forwarding request to: ${fullUrl} -> ${modelId}`)

      try {
        const axiosConfig: AxiosRequestConfig = {
          method: req.method,
          url: fullUrl,
          headers: { ...req.headers },
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
