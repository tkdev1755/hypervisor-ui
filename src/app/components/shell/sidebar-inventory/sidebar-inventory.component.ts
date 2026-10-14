import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent } from '@app/components/ui/icon/icon.component';
import { InventoryService } from '@app/services/inventory.service';

/**
 * SIDEBAR INVENTORY — l'arbre « hyperviseurs → VM » de la barre latérale.
 * Un clic sur un hyperviseur ouvre sa page, un clic sur une VM ouvre la sienne ;
 * la flèche à gauche plie ou déplie la liste des VM.
 * Les données viennent de InventoryService (rechargé par les pages après chaque changement).
 */
@Component({
  selector: 'app-sidebar-inventory',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar-inventory.component.html',
  styleUrl: './sidebar-inventory.component.scss',
})
export class SidebarInventoryComponent implements OnInit {
  protected readonly inventory = inject(InventoryService);

  /** Les ids des hyperviseurs repliés (tout est déplié au départ). */
  protected readonly collapsed = signal<string[]>([]);

  ngOnInit(): void {
    this.inventory.refresh();
  }

  protected isOpen(id: string): boolean {
    return !this.collapsed().includes(id);
  }

  protected toggle(id: string): void {
    this.collapsed.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
}
