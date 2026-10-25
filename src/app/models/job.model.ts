import { VirtualMachine } from './virtual-machine.model';

export type JobStatus = 'running' | 'succeeded' | 'failed';

/** Une opération longue (clonage, VM depuis un template) exécutée en arrière-plan par l'API. */
export interface Job {
  id: string;
  kind: string;
  status: JobStatus;
  /** La VM obtenue, quand `status` vaut 'succeeded'. */
  result?: VirtualMachine;
  /** La raison de l'échec, quand `status` vaut 'failed'. */
  error?: string;
}
