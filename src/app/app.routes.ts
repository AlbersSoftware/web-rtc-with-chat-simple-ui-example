import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { JoinCallComponent } from './components/join-call/join-call.component';
import { RoomSessionComponent } from './components/room-session/room-session.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'join', component: JoinCallComponent },
  { path: 'room/:roomId/:clientId', component: RoomSessionComponent },
];
