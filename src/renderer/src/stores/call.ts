/** 音视频通话 store（1:1 WebRTC，信令走 WS rtc:signal） */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getWsClient } from '../services/ws/session'
import { getIceServers } from '../services/api/rtc'

export type CallStatus = 'idle' | 'ringing' | 'incoming' | 'connecting' | 'connected' | 'error'
export type CallMedia = 'audio' | 'video'
export type CallMediaError =
  | 'permissionDenied'
  | 'deviceNotFound'
  | 'deviceBusy'
  | 'unsupported'
  | 'unknown'

interface RtcSignal {
  action: string
  targetUserId?: string | number
  fromUserId?: string | number
  fromUsername?: string
  fromAvatar?: string
  mediaType?: CallMedia
  callId?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export const useCallStore = defineStore('call', () => {
  const status = ref<CallStatus>('idle')
  const mediaType = ref<CallMedia>('audio')
  const remoteUserId = ref('')
  const remoteName = ref('')
  const remoteAvatar = ref('')
  const callId = ref('')
  const mediaError = ref<CallMediaError | null>(null)
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  let pc: RTCPeerConnection | null = null
  let remoteDescriptionApplied = false
  let pendingRemoteDescription: RTCSessionDescriptionInit | null = null
  const pendingIceCandidates: RTCIceCandidateInit[] = []

  function classifyMediaError(error: unknown): CallMediaError {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'permissionDenied'
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'deviceNotFound'
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'deviceBusy'
    return 'unknown'
  }

  async function acquireLocalMedia(type: CallMedia): Promise<boolean> {
    mediaError.value = null
    try {
      localStream.value = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      })
      return true
    } catch (error) {
      console.warn('failed to acquire call media', error)
      mediaError.value = classifyMediaError(error)
      return false
    }
  }

  async function iceConfig(): Promise<RTCConfiguration> {
    const servers = await getIceServers()
    return {
      iceServers: servers.map((s) => ({
        urls: s.urls,
        username: s.username,
        credential: s.credential
      })),
      iceTransportPolicy: 'relay'
    }
  }

  async function createPc(): Promise<RTCPeerConnection> {
    const p = new RTCPeerConnection(await iceConfig())
    remoteDescriptionApplied = false
    p.onicecandidate = (e) => {
      if (e.candidate && remoteUserId.value && callId.value) {
        getWsClient()?.send('rtc:signal', {
          action: 'candidate',
          targetUserId: remoteUserId.value,
          callId: callId.value,
          candidate: e.candidate.toJSON()
        })
      }
    }
    p.ontrack = (e) => {
      remoteStream.value = e.streams[0] ?? new MediaStream([e.track])
    }
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') status.value = 'connected'
      if (p.connectionState === 'failed') hangup()
    }
    return p
  }

  function signalMatchesCurrentCall(sig: RtcSignal): boolean {
    return !sig.callId || !callId.value || sig.callId === callId.value
  }

  async function applyRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!pc) {
      pendingRemoteDescription = description
      return
    }
    await pc.setRemoteDescription(description)
    remoteDescriptionApplied = true
    await drainPendingIceCandidates()
  }

  async function drainPendingIceCandidates(): Promise<void> {
    if (!pc || !remoteDescriptionApplied) return
    const candidates = pendingIceCandidates.splice(0)
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.warn('failed to add queued ICE candidate', error)
      }
    }
  }

  async function queueOrAddIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!pc || !remoteDescriptionApplied) {
      pendingIceCandidates.push(candidate)
      return
    }
    try {
      await pc.addIceCandidate(candidate)
    } catch (error) {
      console.warn('failed to add ICE candidate', error)
    }
  }

  async function startCall(peerId: string, type: CallMedia): Promise<void> {
    reset()
    remoteUserId.value = peerId
    mediaType.value = type
    callId.value = crypto.randomUUID()
    if (!(await acquireLocalMedia(type))) {
      status.value = 'error'
      return
    }
    status.value = 'ringing'
    getWsClient()?.send('rtc:signal', {
      action: 'call',
      targetUserId: peerId,
      mediaType: type,
      callId: callId.value
    })
  }

  async function accept(): Promise<void> {
    const type = mediaType.value
    if (!(await acquireLocalMedia(type))) return
    const stream = localStream.value
    if (!stream) return
    status.value = 'connecting'
    pc = await createPc()
    for (const track of stream.getTracks()) pc.addTrack(track, stream)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    getWsClient()?.send('rtc:signal', {
      action: 'answer',
      targetUserId: remoteUserId.value,
      callId: callId.value,
      sdp: { type: offer.type ?? 'offer', sdp: offer.sdp ?? '' }
    })
    if (pendingRemoteDescription) {
      const description = pendingRemoteDescription
      pendingRemoteDescription = null
      await applyRemoteDescription(description)
    }
  }

  function reject(): void {
    if (remoteUserId.value && callId.value) {
      getWsClient()?.send('rtc:signal', {
        action: 'reject',
        targetUserId: remoteUserId.value,
        callId: callId.value
      })
    }
    reset()
  }

  async function handleSignal(sig: RtcSignal): Promise<void> {
    switch (sig.action) {
      case 'call': {
        if (status.value !== 'idle') {
          if (sig.callId === callId.value) return
          getWsClient()?.send('rtc:signal', {
            action: 'busy',
            targetUserId: sig.fromUserId,
            callId: sig.callId
          })
          return
        }
        callId.value = sig.callId ?? ''
        remoteUserId.value = String(sig.fromUserId ?? '')
        remoteName.value = sig.fromUsername?.trim() ?? ''
        remoteAvatar.value = sig.fromAvatar?.trim() ?? ''
        mediaType.value = sig.mediaType ?? 'audio'
        mediaError.value = null
        status.value = 'incoming'
        break
      }
      case 'answer': {
        if (status.value !== 'ringing' || !localStream.value) return
        if (!signalMatchesCurrentCall(sig)) return
        status.value = 'connecting'
        pc = await createPc()
        if (sig.sdp) await applyRemoteDescription(sig.sdp)
        for (const t of localStream.value.getTracks()) pc.addTrack(t, localStream.value)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        getWsClient()?.send('rtc:signal', {
          action: 'answer_sdp',
          targetUserId: remoteUserId.value,
          callId: callId.value,
          sdp: { type: answer.type ?? 'answer', sdp: answer.sdp ?? '' }
        })
        break
      }
      case 'answer_sdp': {
        if (!signalMatchesCurrentCall(sig)) return
        if (sig.sdp) await applyRemoteDescription(sig.sdp)
        break
      }
      case 'candidate': {
        if (!signalMatchesCurrentCall(sig)) return
        if (sig.candidate) await queueOrAddIceCandidate(sig.candidate)
        break
      }
      case 'hangup':
      case 'reject':
      case 'busy':
      case 'unavailable':
      case 'incoming_resolved':
      case 'call_failed': {
        if (!signalMatchesCurrentCall(sig)) return
        reset()
        break
      }
    }
  }

  function hangup(): void {
    if (remoteUserId.value && callId.value) {
      getWsClient()?.send('rtc:signal', {
        action: 'hangup',
        targetUserId: remoteUserId.value,
        callId: callId.value
      })
    }
    reset()
  }

  function reset(): void {
    pc?.close()
    pc = null
    remoteDescriptionApplied = false
    pendingRemoteDescription = null
    pendingIceCandidates.splice(0)
    localStream.value?.getTracks().forEach((t) => t.stop())
    localStream.value = null
    remoteStream.value = null
    mediaError.value = null
    status.value = 'idle'
    remoteUserId.value = ''
    remoteName.value = ''
    remoteAvatar.value = ''
    callId.value = ''
  }

  function bindWs(): void {
    getWsClient()?.on('rtc:signal', (data) => {
      void handleSignal(data as RtcSignal).catch((error) => {
        console.warn('failed to handle RTC signal', error)
        hangup()
      })
    })
  }

  return {
    status,
    mediaType,
    remoteUserId,
    remoteName,
    remoteAvatar,
    mediaError,
    localStream,
    remoteStream,
    startCall,
    accept,
    reject,
    hangup,
    handleSignal,
    bindWs,
    reset
  }
})
