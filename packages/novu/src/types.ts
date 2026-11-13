/** What the web app's <Inbox> needs to connect, or that it's turned off. */
export type InboxSession =
  | { enabled: false }
  | {
      enabled: true
      applicationIdentifier: string
      subscriberId: string
      subscriberHash?: string
      backendUrl?: string
      socketUrl?: string
    }
