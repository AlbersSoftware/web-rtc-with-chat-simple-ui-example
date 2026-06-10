import {
  Component,
  OnInit,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { WebSocketService } from '../../services/websocket.service';
import { WebrtcService } from '../../services/webrtc.service';

@Component({
  selector: 'app-room-session',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule],
  templateUrl: './room-session.component.html',
  styleUrls: ['./room-session.component.css']
})
export class RoomSessionComponent implements OnInit {

  roomId!: string | null;
  clientId!: string | null;

  message = '';

  messages: { senderId: string; payload: string }[] = [];

  remoteVideos: { id: string; stream: MediaStream }[] = [];

  @ViewChild('localVideo') localVideo!: ElementRef;
  @ViewChildren('remoteVideo') remoteVideoEls!: QueryList<ElementRef>;

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

  async ngOnInit() {

    this.ws.connect();

    // =====================================================
    // 🔥 LISTEN FOR ICE EVENTS FROM WebRTC SERVICE
    // =====================================================
    window.addEventListener('webrtc-ice', (event: any) => {

      const { userId, candidate } = event.detail;

      this.ws.sendMessage({
        type: 'ICE',
        roomId: this.roomId,
        senderId: this.clientId,
        targetId: userId,
        payload: candidate
      });
    });

    // =====================================================
    // 🔥 WHEN VIDEO ELEMENTS CHANGE → BIND STREAMS
    // =====================================================
    setTimeout(() => {
      this.remoteVideoEls.changes.subscribe(() => {
        this.attachStreamsToVideoElements();
      });
    });

    // =====================================================
    // 🔥 REMOTE STREAM HANDLER
    // =====================================================
    this.webrtc.onRemoteStream = (id, stream) => {
      this.zone.run(() => {

        const existing = this.remoteVideos.find(v => v.id === id);

        if (existing) {
          existing.stream = stream;
        } else {
          this.remoteVideos.push({ id, stream });
        }

        this.cdr.detectChanges();

        // 🔥 wait for DOM render → then attach streams
        setTimeout(() => {
          this.attachStreamsToVideoElements();
        });
      });
    };

    // =====================================================
    // 🔥 WEBSOCKET MESSAGE HANDLER
    // =====================================================
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

            const offer = await this.webrtc.createOffer(data.senderId);

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

            const answer = await this.webrtc.handleOffer(
              data.senderId,
              data.payload
            );

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

  // =====================================================
  // 🔥 STREAM → VIDEO BINDER
  // =====================================================
  private attachStreamsToVideoElements() {

    this.remoteVideoEls.forEach((el, index) => {

      const video = el.nativeElement;
      const stream = this.remoteVideos[index]?.stream;

      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }

    });
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
    this.router.navigate(['/']);
  }
}
