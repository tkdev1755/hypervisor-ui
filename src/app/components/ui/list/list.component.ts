import { Component } from '@angular/core';

/**
 * LIST — un cadre pour une liste de <app-list-tile>, séparées par un trait
 * (comme un ListView de ListTile en Flutter).
 *
 *   <app-list>
 *     <app-list-tile icon="cpu" title="web-01" subtitle="2 vCPU · 4 Go" />
 *     <app-list-tile icon="cpu" title="db-01" subtitle="4 vCPU · 8 Go" />
 *   </app-list>
 */
@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss',
})
export class ListComponent {}
