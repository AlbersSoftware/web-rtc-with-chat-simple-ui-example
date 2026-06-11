import { Injectable } from '@angular/core';

type PeerEntry = {
  pc: RTCPeerConnection;
  stream?: MediaStream;

  makingOffer: boolean;
  isSettingRemote: boolean;
  ignoreOffer: boolean;

  polite: boolean;
  iceCandidateBuffer: RTCIceCandidateInit[];
};

@Injectable({ providedIn: 'root' })
export class WebrtcService {

  localStream!: MediaStream;

  peers: Map<string, PeerEntry> = new Map();

  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onPeerLeft?: (userId: string) => void;

  // =========================
  // LOCAL STREAM
  // =========================
  async initLocalStream(): Promise<MediaStream> {

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    console.log('[LOCAL STREAM READY]');
    return this.localStream;
  }

  // =========================
  // CREATE PEER
  // =========================
  createPeer(userId: string, polite: boolean = false) {

    let entry = this.peers.get(userId);

    if (entry) {
      entry.polite = polite;
      return entry.pc;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    entry = {
      pc,
      makingOffer: false,
      isSettingRemote: false,
      ignoreOffer: false,
      polite,
      iceCandidateBuffer: []
    };

    this.peers.set(userId, entry);

    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    // =========================
    // REMOTE STREAM
    // =========================
    pc.ontrack = (event) => {

      // ontrack fires once per track (audio then video).
      // We only call onRemoteStream when the VIDEO track arrives —
      // that's the moment the stream is actually renderable.
      // Checking event.track.kind is reliable; checking stream.getVideoTracks()
      // is NOT because the stream object may already contain both tracks
      // even on the first (audio) event.
      if (event.track.kind !== 'video') {
        console.log('[REMOTE STREAM] audio track received — waiting for video track');
        return;
      }

      const stream = event.streams?.[0] ?? new MediaStream([event.track]);
      const e = this.peers.get(userId);
      if (e) e.stream = stream;

      console.log('[REMOTE STREAM] video track ready for', userId,
        '| stream id:', stream.id,
        '| total tracks:', stream.getTracks().length
      );

      this.onRemoteStream?.(userId, stream);
    };

    // =========================
    // ICE
    // =========================
    pc.onicecandidate = (event) => {

      if (!event.candidate) return;

      window.dispatchEvent(new CustomEvent('webrtc-ice', {
        detail: { userId, candidate: event.candidate }
      }));
    };

    // =========================
    // CONNECTION STATE
    // =========================
    pc.onconnectionstatechange = () => {

      console.log('[CONNECTION STATE]', userId, pc.connectionState);

      const e = this.peers.get(userId);
      if (!e) return;

      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(userId);
      }
    };

    return pc;
  }

  // =========================
  // OFFER (caller — impolite)
  // =========================
  async createOffer(userId: string, polite: boolean = false) {

    const pc = this.createPeer(userId, polite);
    const entry = this.peers.get(userId)!;

    if (entry.makingOffer) return null;

    entry.makingOffer = true;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } finally {
      entry.makingOffer = false;
    }
  }

  // =========================
  // HANDLE OFFER (receiver — polite)
  // =========================
  async handleOffer(userId: string, offer: RTCSessionDescriptionInit, polite: boolean = false) {

    const pc = this.createPeer(userId, polite);
    const entry = this.peers.get(userId)!;

    const collision =
      entry.makingOffer ||
      pc.signalingState !== 'stable';

    entry.ignoreOffer = !entry.polite && collision;

    if (entry.ignoreOffer) {
      console.warn('[IGNORED OFFER]', userId);
      return null;
    }

    entry.isSettingRemote = true;

    try {
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await this.flushIceCandidates(userId);

      return answer;

    } finally {
      entry.isSettingRemote = false;
    }
  }

  // =========================
  // HANDLE ANSWER
  // =========================
  async handleAnswer(userId: string, answer: RTCSessionDescriptionInit) {

    const entry = this.peers.get(userId);
    if (!entry) return;

    const pc = entry.pc;

    // setRemoteDescription(answer) is only valid in 'have-local-offer' state.
    // Any other state means the answer is a duplicate, arrived too late,
    // or was echoed back to the sender by the server — drop it silently.
    if (pc.signalingState !== 'have-local-offer') {
      console.warn('[ANSWER IGNORED]', userId,
        `— signalingState was '${pc.signalingState}', expected 'have-local-offer'.`,
        'Likely a duplicate answer or server echo.');
      return;
    }

    try {
      await pc.setRemoteDescription(answer);
      await this.flushIceCandidates(userId);
    } catch (e) {
      console.warn('[ANSWER APPLY FAILED]', userId, e);
    }
  }

  // =========================
  // ICE — buffer if remote not yet set
  // =========================
  async addIce(userId: string, candidate: RTCIceCandidateInit) {

    const entry = this.peers.get(userId);
    if (!entry) return;

    if (!entry.pc.remoteDescription) {
      entry.iceCandidateBuffer.push(candidate);
      return;
    }

    try {
      await entry.pc.addIceCandidate(candidate);
    } catch (e) {
      console.warn('[ICE ERROR]', userId, e);
    }
  }

  // =========================
  // FLUSH BUFFERED ICE CANDIDATES
  // =========================
  private async flushIceCandidates(userId: string) {

    const entry = this.peers.get(userId);
    if (!entry) return;

    for (const candidate of entry.iceCandidateBuffer) {
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn('[ICE FLUSH ERROR]', userId, e);
      }
    }

    entry.iceCandidateBuffer = [];
  }

  // =========================
  // REMOVE
  // =========================
  removePeer(userId: string) {

    const entry = this.peers.get(userId);
    if (!entry) return;

    entry.pc.close();
    entry.stream?.getTracks().forEach(t => t.stop());

    this.peers.delete(userId);

    this.onPeerLeft?.(userId);
  }

  cleanupAllPeers() {
    [...this.peers.keys()].forEach(id => this.removePeer(id));
  }

  resetRoomState() {
    this.cleanupAllPeers();
  }
}
