import { Component, OnInit, inject, input, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { RowComponent } from '@app/components/layout/row/row.component';
import { ModalShellComponent, ModalState } from '@app/components/modal/modal-shell/modal-shell.component';
import { ButtonComponent } from '@app/components/ui/button/button.component';
import { FrameComponent } from '@app/components/ui/frame/frame.component';
import { AppError, isAppError } from '@app/models/app-error.model';
import { VirtualMachine } from '@app/models/virtual-machine.model';
import { VncResponse } from '@app/models/vnc.model';
import { ModalRef } from '@app/services/modal-ref';
import { VmService } from '@app/services/vm.service';

/**
 * La console VNC d'une VM en marche : on demande à l'API l'adresse noVNC,
 * puis on l'affiche dans la modale (ou dans un onglet à part).
 */
@Component({
  selector: 'app-vm-console-modal',
  imports: [ModalShellComponent, ColumnComponent, RowComponent, ButtonComponent, FrameComponent],
  templateUrl: './vm-console-modal.component.html',
  styleUrl: './vm-console-modal.component.scss',
})
export class VmConsoleModalComponent implements OnInit {
  protected readonly modalRef = inject(ModalRef<void>);
  private readonly vms = inject(VmService);

  readonly hypervisorId = input.required<string>();
  readonly vm = input.required<VirtualMachine>();

  protected readonly state = signal<ModalState>('loading');
  protected readonly error = signal<AppError | null>(null);
  protected readonly vnc = signal<VncResponse | null>(null);

  ngOnInit(): void {
    this.connect();
  }

  protected connect(): void {
    this.state.set('loading');
    this.vms.vnc(this.hypervisorId(), this.vm().id).subscribe({
      next: (vnc) => {
        this.vnc.set(vnc);
        this.state.set('form');
      },
      error: (error: unknown) => {
        this.error.set(isAppError(error) ? error : null);
        this.state.set('error');
      },
    });
  }

  protected openInTab(): void {
    window.open(this.vnc()?.novnc_url, '_blank', 'noopener');
  }
}
