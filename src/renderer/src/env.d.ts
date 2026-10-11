/// <reference types="vite/client" />
import type { InboxApi } from '../../preload/index'

declare global {
  interface Window {
    inbox: InboxApi
  }
}
