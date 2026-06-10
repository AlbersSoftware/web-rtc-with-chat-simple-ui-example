import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-join-call',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatInputModule],
  templateUrl: './join-call.component.html'
})
export class JoinCallComponent {

  roomId = '';
  clientId = '';

  constructor(private router: Router) {}

join() {
  if (!this.roomId.trim() || !this.clientId.trim()) {
    alert('Room ID and Client ID are required');
    return;
  }

  this.router.navigate(['/room', this.roomId, this.clientId]);
}

  goHome() {
    this.router.navigate(['/']);
  }
}
