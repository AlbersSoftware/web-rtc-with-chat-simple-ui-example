import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './home.component.html'
})
export class HomeComponent {
  constructor(private router: Router) {}

  goToJoin() {
    this.router.navigate(['/join']);
  }

  goToRoom() {
    this.router.navigate(['/room']);
  }
}
