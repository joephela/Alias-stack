export interface Alias {
  name: string
  command: string
  description: string
}

export interface IpcResponse {
  success: boolean
  error?: string
}

export interface GetAllResponse extends IpcResponse {
  aliases?: Alias[]
  shellFile?: string
  shellFileDisplay?: string
}

export interface GetShellFileResponse extends IpcResponse {
  path?: string
  displayPath?: string
}

declare global {
  interface Window {
    aliasAPI: {
      getAll: () => Promise<GetAllResponse>
      save: (alias: Alias) => Promise<IpcResponse>
      delete: (name: string) => Promise<IpcResponse>
      getShellFile: () => Promise<GetShellFileResponse>
    }
  }
}
