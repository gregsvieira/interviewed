import { disconnectSocket, getSocket } from './socket'


export function disconnectInterview(): void {
    disconnectSocket()
}

export const startInterview = (token: string, payload: any) => {
  const socket = getSocket(token)
  socket.emit('start', payload)
}