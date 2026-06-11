import {
  Component,
  OnInit,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
  OnDestroy,
  AfterViewInit
} from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

import { WebSocketService } from '../../services/websocket.service';
import { WebrtcService } from '../../services/webrtc.service';

@Component({
  selector: 'app-room-session',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule],
  templateUrl: './room-session.component.html',
  styleUrls: ['./room-session.component.css']
})
export class RoomSessionComponent implements OnInit, AfterViewInit, OnDestroy {

  roomId!: string | null;
  clientId!: string | null;

  message = '';
  messages: { senderId: string; payload: string }[] = [];

  remoteVideos: { id: string; stream: MediaStream }[] = [];

  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChildren('remoteVideo') remoteVideoEls!: QueryList<ElementRef<HTMLVideoElement>>;

  private remoteVideoSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ws: WebSocketService,
    private webrtc: WebrtcService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.roomId = this.route.snapshot.paramMap.get('roomId');
  }

  ngAfterViewInit() {
    this.remoteVideoSub = this.remoteVideoEls.changes.subscribe(() => {
      this.attachStreams();
    });
  }

  async ngOnInit() {

    console.log('[ROOM] init room:', this.roomId);

    this.webrtc.resetRoomState();
    this.ws.connect();

    window.addEventListener('webrtc-ice', this.iceListener);

    // =========================
    // STREAMS
    // =========================
    this.webrtc.onRemoteStream = (id, stream) => {

      this.zone.run(() => {

        const existing = this.remoteVideos.find(v => v.id === id);

        if (existing) {
          existing.stream = stream;
          this.cdr.detectChanges();
          this.attachStreamForId(id, stream);
        } else {
          this.remoteVideos = [...this.remoteVideos, { id, stream }];
          this.cdr.detectChanges();
        }
      });
    };

    // =========================
    // PEER LEFT
    // =========================
    this.webrtc.onPeerLeft = (id) => {

      this.zone.run(() => {
        this.remoteVideos = this.remoteVideos.filter(v => v.id !== id);
        this.cdr.detectChanges();
      });
    };

    // =========================
    // WS
    // =========================
    this.ws.onMessage(async (data) => {

      this.zone.run(async () => {

        switch (data.type) {

          case 'ASSIGN_ID': {

            this.clientId = data.senderId;

            const stream = await this.webrtc.initLocalStream();
            this.localVideo.nativeElement.srcObject = stream;

            this.ws.sendMessage({
              type: 'JOIN',
              roomId: this.roomId,
              senderId: this.clientId,
              payload: null
            });

            break;
          }

          case 'USER_JOINED': {
            // Server tells us who is already in the room.
            // We do NOT offer — we wait for their PLEASE_OFFER-triggered offer and answer as polite peer.
            console.log('[USER_JOINED] peer already in room:', data.senderId, '— waiting for their offer');
            break;
          }

          case 'PLEASE_OFFER': {
            // Server tells us to initiate an offer to a newly joined peer.
            // We are the existing (impolite) peer.
            const offer = await this.webrtc.createOffer(data.senderId, false);
            if (!offer) return;

            this.ws.sendMessage({
              type: 'OFFER',
              roomId: this.roomId,
              senderId: this.clientId,
              targetId: data.senderId,
              payload: offer
            });

            break;
          }

          case 'OFFER': {
            // We are the new joiner receiving an offer — polite peer, we answer.
            const answer = await this.webrtc.handleOffer(
              data.senderId,
              data.payload,
              true
            );

            if (!answer) return;

            this.ws.sendMessage({
              type: 'ANSWER',
              roomId: this.roomId,
              senderId: this.clientId,
              targetId: data.senderId,
              payload: answer
            });

            break;
          }

          case 'ANSWER':
            await this.webrtc.handleAnswer(data.senderId, data.payload);
            break;

          case 'ICE':
            await this.webrtc.addIce(data.senderId, data.payload);
            break;

          case 'USER_LEFT':
            this.webrtc.removePeer(data.senderId);
            break;

          case 'CHAT':
            this.messages = [
              ...this.messages,
              { senderId: data.senderId, payload: data.payload }
            ];
            break;
        }

        this.cdr.detectChanges();
      });
    });
  }

  private attachStreams() {

    if (!this.remoteVideoEls) return;

    this.remoteVideoEls.forEach((el) => {

      const video = el.nativeElement;
      const id = video.getAttribute('data-id');
      const entry = this.remoteVideos.find(v => v.id === id);

      if (entry) {
        this.setVideoStream(video, entry.stream);
      }
    });
  }

  private attachStreamForId(id: string, stream: MediaStream) {

    if (!this.remoteVideoEls) return;

    const el = this.remoteVideoEls.find(
      ref => ref.nativeElement.getAttribute('data-id') === id
    );

    if (el) {
      this.setVideoStream(el.nativeElement, stream);
    } else {
      console.warn('[ATTACH] element not in DOM yet for', id, '— retrying');
      Promise.resolve().then(() => this.attachStreamForId(id, stream));
    }
  }

  private setVideoStream(video: HTMLVideoElement, stream: MediaStream) {

    // Do NOT bail out when srcObject === stream.
    // The stream object may be the same reference but the video track
    // may have just become active — always reassign and replay.
    console.log('[ATTACH STREAM]', video.getAttribute('data-id'),
      '| video tracks:', stream.getVideoTracks().length,
      '| audio tracks:', stream.getAudioTracks().length
    );

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play().catch(err => console.warn('[VIDEO PLAY loadedmetadata]', err));
    };

    video.play().catch(() => {});
  }

  sendMessage() {

    if (!this.message.trim() || !this.clientId) return;

    this.ws.sendMessage({
      type: 'CHAT',
      roomId: this.roomId,
      senderId: this.clientId,
      payload: this.message
    });

    this.message = '';
  }

  goHome() {

    this.ws.sendMessage({
      type: 'LEAVE',
      roomId: this.roomId,
      senderId: this.clientId,
      payload: null
    });

    this.webrtc.cleanupAllPeers();
    this.remoteVideos = [];

    window.removeEventListener('webrtc-ice', this.iceListener);

    this.router.navigate(['/']);
  }

  ngOnDestroy() {
    window.removeEventListener('webrtc-ice', this.iceListener);
    this.remoteVideoSub?.unsubscribe();
  }

  private iceListener = (event: any) => {

    const { userId, candidate } = event.detail;

    this.ws.sendMessage({
      type: 'ICE',
      roomId: this.roomId,
      senderId: this.clientId,
      targetId: userId,
      payload: candidate
    });
  };

  trackByUserId(_: number, item: any) {
    return item.id;
  }
}
