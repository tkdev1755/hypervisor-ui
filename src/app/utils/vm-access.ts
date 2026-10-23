import { VirtualMachine } from '../models/virtual-machine.model';

/**
 * Les droits de l'utilisateur connecté sur une VM, d'après son champ `access`
 * ('admin' | 'owner' | 'shared', voir virtual-machine.model.ts).
 */

/** Une VM qu'on nous a prêtée : console, démarrer et arrêter seulement. */
export function isBorrowed(vm: VirtualMachine): boolean {
  return vm.access === 'shared';
}

/** Cloner, supprimer et prêter : le propriétaire ou un administrateur (pas un emprunteur). */
export function canManage(vm: VirtualMachine): boolean {
  return !isBorrowed(vm);
}

/** Qui possède la VM, pour l'afficher : « prêtée par alice », « propriétaire : bob », « sans propriétaire ». */
export function ownerLabel(vm: VirtualMachine): string | null {
  if (vm.access === 'owner') {
    return null; // C'est la mienne : inutile de le dire.
  }
  if (!vm.owner) {
    return 'sans propriétaire';
  }
  return vm.access === 'shared' ? `prêtée par ${vm.owner}` : `propriétaire : ${vm.owner}`;
}
