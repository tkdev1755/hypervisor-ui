import { Component, computed, input } from '@angular/core';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

/** Le libellé français et la couleur de chaque statut renvoyé par l'API. */
const STATUSES: Record<string, { label: string; tone: Tone }> = {
  connected: { label: 'Connecté', tone: 'success' },
  disconnected: { label: 'Déconnecté', tone: 'danger' },
  running: { label: 'En marche', tone: 'success' },
  stopped: { label: 'Arrêtée', tone: 'neutral' },
  shutoff: { label: 'Éteinte', tone: 'neutral' },
  paused: { label: 'En pause', tone: 'warning' },
  shutting_down: { label: 'Arrêt en cours', tone: 'warning' },
  crashed: { label: 'Planté', tone: 'danger' },
  active: { label: 'Actif', tone: 'success' },
  inactive: { label: 'Inactif', tone: 'neutral' },
  // Versions de templates : la construction par Packer.
  pending: { label: 'En attente', tone: 'warning' },
  in_progress: { label: 'En construction', tone: 'warning' },
  stopping: { label: 'Arrêt en cours', tone: 'warning' },
  created: { label: 'Prêt', tone: 'success' },
  failed: { label: 'Échec', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};

/**
 * STATUS BADGE — une pastille colorée avec le statut en français.
 *
 *   <app-status-badge status="connected" />     →  ● Connecté (en vert)
 */
@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  private readonly known = computed(() => STATUSES[this.status().toLowerCase()]);
  protected readonly label = computed(() => this.known()?.label ?? this.status());
  protected readonly tone = computed<Tone>(() => this.known()?.tone ?? 'neutral');
}
