export type SchedulerCycleStatus = 'running' | 'completed' | 'partial_failure';

export interface SchedulerCycle {
  cycleId: string; // ex: "cycle-2024-01-15-2"
  status: SchedulerCycleStatus;
  invoiceIds: string[];
  invoiceCount: number;
  createdAt: Date;
  updatedAt: Date;
}
