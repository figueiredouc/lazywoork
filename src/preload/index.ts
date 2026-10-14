import { contextBridge, ipcRenderer } from 'electron'
import type { InboxState, Reply } from '../shared/model'

const api = {
  setMode: (mode: 'compact' | 'expanded') => ipcRenderer.send('set-mode', mode),
  /** Expanded only: the panel's natural height (main clamps it). */
  fitHeight: (height: number) => ipcRenderer.send('fit-height', height),
  setPinned: (pinned: boolean) => ipcRenderer.send('set-pinned', pinned),
  getState: (): Promise<InboxState> => ipcRenderer.invoke('inbox:get'),
  dismiss: (id: string) => ipcRenderer.send('inbox:dismiss', id),
  rename: (agentId: string, name: string) => ipcRenderer.send('inbox:rename', agentId, name),
  focus: (agentId: string): Promise<boolean> => ipcRenderer.invoke('inbox:focus', agentId),
  answer: (id: string, reply: Reply): Promise<boolean> =>
    ipcRenderer.invoke('inbox:answer', id, reply),
  onState: (cb: (state: InboxState) => void) => {
    const listener = (_e: unknown, state: InboxState) => cb(state)
    ipcRenderer.on('inbox:state', listener)
    return () => {
      ipcRenderer.removeListener('inbox:state', listener)
    }
  }
}

contextBridge.exposeInMainWorld('inbox', api)

export type InboxApi = typeof api
