import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { CardComponent } from '@app/components/layout/card/card.component';
import { CenterComponent } from '@app/components/layout/center/center.component';
import { ColumnComponent } from '@app/components/layout/column/column.component';
import { PaddingComponent } from '@app/components/layout/padding/padding.component';
import { SizedBoxComponent } from '@app/components/layout/sized-box/sized-box.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { CalloutComponent } from '@app/components/ui/callout/callout.component';
import { ErrorPanelComponent } from '@app/components/ui/error-panel/error-panel.component';
import { TextFieldComponent } from '@app/components/ui/text-field/text-field.component';
import { TextComponent } from '@app/components/ui/text/text.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { AuthService } from '@app/services/auth.service';

type Mode = 'login' | 'register';

/**
 * La page de connexion (et d'inscription, si l'admin a ouvert les inscriptions).
 *
 * `returnUrl` et `expired` viennent de l'adresse (/login?returnUrl=/hypervisors&expired=1) :
 * le routeur les passe en input() (withComponentInputBinding). Le garde de routes
 * renvoie ici avec `returnUrl` ; l'intercepteur avec `expired` quand la session a expiré.
 */
@Component({
  selector: 'app-login',
  imports: [
    PaddingComponent,
    CenterComponent,
    SizedBoxComponent,
    CardComponent,
    ColumnComponent,
    TextComponent,
    TextFieldComponent,
    ButtonComponent,
    CalloutComponent,
    ErrorPanelComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>();
  readonly expired = input<string>();

  protected readonly mode = signal<Mode>('login');
  /** Vrai si l'admin a ouvert les inscriptions (sinon, pas de lien « Créer un compte »). */
  protected readonly registrationOpen = signal(false);

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly confirmation = signal('');

  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<AppError | null>(null);

  // Les mêmes règles que l'API : nom de 3 à 32 caractères (lettres, chiffres, . _ -), mot de passe de 8 à 128.
  protected readonly usernameError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    if (this.mode() === 'login') {
      return this.username().trim() === '' ? "Saisissez votre nom d'utilisateur." : null;
    }
    return /^[a-zA-Z0-9._-]{3,32}$/.test(this.username()) ? null : '3 à 32 caractères : lettres, chiffres, point, tiret et tiret bas.';
  });
  protected readonly passwordError = computed(() => {
    if (!this.submitted()) {
      return null;
    }
    if (this.mode() === 'login') {
      return this.password() === '' ? 'Saisissez votre mot de passe.' : null;
    }
    return this.password().length >= 8 && this.password().length <= 128 ? null : 'Entre 8 et 128 caractères.';
  });
  protected readonly confirmationError = computed(() =>
    this.submitted() && this.mode() === 'register' && this.confirmation() !== this.password() ? 'Les deux mots de passe sont différents.' : null,
  );

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      void this.router.navigateByUrl('/');
      return;
    }
    // Un échec n'est pas grave : on n'affiche simplement pas le lien d'inscription.
    this.auth.config().subscribe({
      next: (config) => this.registrationOpen.set(config.registration_open),
      error: () => this.registrationOpen.set(false),
    });
  }

  protected switchMode(mode: Mode): void {
    this.mode.set(mode);
    this.submitted.set(false);
    this.error.set(null);
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.usernameError() || this.passwordError() || this.confirmationError()) {
      return;
    }
    const credentials = { username: this.username().trim(), password: this.password() };
    const request = this.mode() === 'login' ? this.auth.login(credentials) : this.auth.register(credentials);

    this.loading.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => void this.router.navigateByUrl(this.safeReturnUrl()),
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.loading.set(false);
      },
    });
  }

  /** On ne suit que les adresses de CETTE application (« /xxx »), jamais un lien externe (« //site.com »). */
  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
