/** RTC API（契约 1.11） */
import { http } from '../http/httpClient'

export interface RtcIceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export function getIceServers(): Promise<RtcIceServer[]> {
  return http.get('/rtc/ice-servers')
}
