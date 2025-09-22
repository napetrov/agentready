// Mock environment variables for testing
process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
process.env.GITHUB_TOKEN = 'test-token'
process.env.MOCK_OPENAI_MODE = 'normal'

// Mock Web APIs for Node.js environment
global.Request = global.Request || class Request {
  constructor(input, init) {
    Object.defineProperty(this, 'url', {
      value: input,
      writable: false,
      enumerable: true,
      configurable: false
    })
    this.method = init?.method || 'GET'
    this.headers = new Map(Object.entries(init?.headers || {}))
    this.body = init?.body
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
}

global.Response = global.Response || class Response {
  constructor(body, init) {
    this.body = body
    this.status = init?.status || 200
    this.statusText = init?.statusText || 'OK'
    this.headers = new Map(Object.entries(init?.headers || {}))
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
}

// Mock NextResponse
global.NextResponse = global.NextResponse || {
  json: (data, init) => {
    const response = new Response(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    })
    // Add arrayBuffer method for PDF responses
    response.arrayBuffer = async () => {
      const text = await response.text()
      return Buffer.from(text, 'utf8')
    }
    // Ensure the response has a json method that returns the data
    response.json = async () => data
    // Add status property
    response.status = init?.status || 200
    return response
  }
}

global.TextEncoder = global.TextEncoder || class TextEncoder {
  encode(input) {
    return Buffer.from(input, 'utf8')
  }
}

global.TextDecoder = global.TextDecoder || class TextDecoder {
  decode(input) {
    return Buffer.from(input).toString('utf8')
  }
}