export interface HARFile {
  log: {
    version: string
    creator: { name: string; version: string }
    entries: HAREntry[]
    pages?: HARPage[]
  }
}

export interface HARPage {
  id: string
  title: string
  startedDateTime: string
  pageTimings: { onContentLoad: number; onLoad: number }
}

export interface HARTimings {
  blocked?: number
  dns?: number
  connect?: number
  send: number
  wait: number
  receive: number
  ssl?: number
}

export interface HAREntry {
  startedDateTime: string
  time: number
  request: {
    method: string
    url: string
    httpVersion: string
    headers: { name: string; value: string }[]
    queryString: { name: string; value: string }[]
    cookies: unknown[]
    headersSize: number
    bodySize: number
    postData?: {
      mimeType: string
      text: string
    }
  }
  response: {
    status: number
    statusText: string
    httpVersion: string
    headers: { name: string; value: string }[]
    cookies: unknown[]
    content: {
      size: number
      mimeType: string
      text?: string
      encoding?: string
      compression?: number
    }
    redirectURL: string
    headersSize: number
    bodySize: number
  }
  timings: HARTimings
  _initiator?: {
    type: string
    url?: string
    lineNumber?: number
  }
  pageref?: string
}

export interface ParsedAPI {
  id: string
  method: string
  pathname: string
  fullUrl: string
  status: number
  statusText: string
  time: number
  startedDateTime: string

  // Request
  queryParams: { name: string; value: string }[]
  requestHeaders: { name: string; value: string }[]
  requestBody: unknown
  contentType: string

  // Response
  responseHeaders: { name: string; value: string }[]
  responseBody: unknown
  responseType: string

  // Metadata
  host: string
  size: number

  // Timing breakdown
  timings: HARTimings

  // Initiator
  initiatorType: string
  initiatorUrl: string

  // Page
  pageTitle: string

  // Source file
  sourceFile: string
}
