import { Injectable } from '@angular/core';

type PeerEntry = {
  pc: RTCPeerConnection;
  stream?: MediaStream;
};

@Injectable({ providedIn: 'root' })
export class WebrtcService {

  localStream!: MediaStream;

  peers: Map<string, PeerEntry> = new Map();

  // callback for UI updates
  onRemoteStream?: (userId: string, stream: MediaStream) => void;

  async initLocalStream(): Promise<MediaStream> {

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    return this.localStream;
  }

  // =====================================================
  // CREATE PEER CONNECTION
  // =====================================================
  createPeer(userId: string) {

    if (this.peers.has(userId)) return this.peers.get(userId)!.pc;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // add local tracks
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    // receive remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];

      this.peers.get(userId)!.stream = stream;

      this.onRemoteStream?.(userId, stream);
    };

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        window.dispatchEvent(new CustomEvent('webrtc-ice', {
          detail: { userId, candidate: event.candidate }
        }));
      }
    };

    this.peers.set(userId, { pc });

    return pc;
  }

  // =====================================================
  // OFFER (caller)
  // =====================================================
  async createOffer(userId: string) {

    const pc = this.createPeer(userId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return offer;
  }

  // =====================================================
  // ANSWER (receiver)
  // =====================================================
  async handleOffer(userId: string, offer: RTCSessionDescriptionInit) {

    const pc = this.createPeer(userId);

    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return answer;
  }

  async handleAnswer(userId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peers.get(userId)?.pc;
    if (!pc) return;

    await pc.setRemoteDescription(answer);
  }

  async addIce(userId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peers.get(userId)?.pc;
    if (!pc) return;

    await pc.addIceCandidate(candidate);
  }
}
