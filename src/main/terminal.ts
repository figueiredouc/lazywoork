import * as iterm from './iterm'
import * as wezterm from './wezterm'

/** How to reach a session: WezTerm pane (+ socket) or iTerm2 session id. Empty = reduced mode. */
export type Target = { pane?: string; socket?: string; iterm?: string }

// Which adapter: whichever header the hook sent, not process.platform.
const adapter = (target: Target) => (target.iterm ? iterm : wezterm)

export const focus = (target: Target, name: string): Promise<void> => adapter(target).focus(target, name)
export const clearHighlight = (target: Target): void => adapter(target).clearHighlight(target)
export const sendText = (target: Target, text: string): Promise<void> => adapter(target).sendText(target, text)
