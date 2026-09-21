/** E2EE 密钥安全存储 IPC 通道（主进程与 preload 共享）。 */
export const E2EE_CHANNELS = {
  loadAll: 'e2ee:load-all',
  get: 'e2ee:get',
  set: 'e2ee:set',
  remove: 'e2ee:remove',
  clear: 'e2ee:clear'
} as const
