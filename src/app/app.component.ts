import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Le composant racine : il affiche la page correspondant à l'adresse.
 * La mise en page (barre latérale) est dans components/shell, déclarée dans app.routes.ts.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
