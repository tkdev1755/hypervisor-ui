import { User } from '../models/user.model';

/** Une ligne de quota : ce qui est consommé, et la limite (`null` = illimité). */
export interface QuotaRow {
  label: string;
  used: number;
  limit: number | null;
  unit: string;
}

/** Les quatre limites d'un utilisateur, avec sa consommation, prêtes à afficher. */
export function quotaRows(user: User): QuotaRow[] {
  const { quota, usage } = user;
  return [
    { label: 'Machines virtuelles', used: usage.vms, limit: quota.max_vms, unit: '' },
    { label: 'vCPU', used: usage.vcpus, limit: quota.max_vcpus, unit: '' },
    { label: 'Mémoire', used: usage.memory_mb, limit: quota.max_memory_mb, unit: ' Mo' },
    { label: 'Disque', used: usage.disk_gb, limit: quota.max_disk_gb, unit: ' Go' },
  ];
}

/** « 2 / 3 », ou « 2 / illimité ». */
export function formatQuotaRow(row: QuotaRow): string {
  return `${row.used}${row.unit} / ${row.limit === null ? 'illimité' : row.limit + row.unit}`;
}
