# WebRTC Angular UI Example

## Project Overview

This project is a minimal Angular-based UI that demonstrates how to use the WebRTC Spring Boot Starter for real-time video and chat.

It provides a working reference implementation of:

* Peer-to-peer video streaming
* WebRTC signaling via WebSocket
* Multi-user room support
* Basic chat alongside video

### Who this is for

* Developers using the WebRTC Spring Boot Starter who want a ready-to-run UI
* Engineers learning how WebRTC integrates with Angular
* Anyone looking for a simple, readable example of WebRTC + WebSocket signaling

This project is intentionally simple and designed to be easy to understand and extend.

---

## Tech Stack Overview

### Frontend

* Angular (standalone components)
* TypeScript
* Angular Material (UI components)

### Real-Time Communication

* WebRTC (RTCPeerConnection, MediaStream)
* WebSocket (signaling layer)

### Backend (required)

* WebRTC Spring Boot Starter
  https://github.com/AlbersSoftware/webrtc-spring-boot-starter

---

## Project Structure

```id="w2n5pj"
src/app/
├── components/
│   └── room-session/        # Main video/chat room UI
│
├── services/
│   ├── websocket.service.ts # WebSocket signaling
│   └── webrtc.service.ts    # WebRTC peer handling
│
└── app.routes.ts            # Routing
```

Key responsibilities:

* `WebrtcService` → manages peer connections, streams, ICE
* `WebSocketService` → handles signaling messages
* `RoomSessionComponent` → UI + orchestration

---

## How to Use

### 1. Start the Backend

Make sure the WebRTC Spring Boot backend is running.

---

### 2. Install Dependencies

```bash id="6yjajc"
npm install
```

---

### 3. Run the App

```bash id="6q1l1p"
ng serve
```

Navigate to:

```
http://localhost:4200
```

---

### 4. Join a Room

* Open multiple browser tabs (or different devices)
* Navigate to the same room ID
* Video streams should automatically connect

---

## Features

* Real-time video streaming (peer-to-peer)
* Multi-user room support
* Automatic ICE candidate exchange
* Basic chat system
* Dynamic video grid
* Automatic stream binding to video elements

---

## Limitations

* No authentication
* No TURN server (may fail behind strict NAT/firewalls)
* No media controls (mute, camera toggle, etc.)
* Basic UI styling
* No reconnection handling

---

## Security

This project currently has **no security layer**:

* No user authentication
* No room access control
* No message validation

It is intended for:

* Local development
* Demonstrations
* Learning purposes

---

## Where the Project is Heading

Potential improvements include:

* Media controls (mute, camera toggle)
* Better UI/UX (grid layouts, responsive design)
* TURN server support for production reliability
* Improved connection state handling
* Screen sharing support
* Device selection (camera/mic switching)
* Integration with authentication systems

---

## Contact

Maintained by: Christopher David Albers
Email: [Chrisalberssoftware@gmail.com](mailto:Chrisalberssoftware@gmail.com)

If you build on this UI or improve it, feel free to reach out or contribute.


## Video Demonstration



https://github.com/user-attachments/assets/118cd7e5-c82a-4e82-abb9-8ca33dd872a9

