export type Organization = {
  id: string;
  name: string;
  kind: string;
  approved: boolean;
  licenseNumber: string;
};

export type Batch = {
  id: string;
  medicineName: string;
  batchNumber: string;
  createdAt: string;
  expiryDate: string;
  manufacturer: string;
  currentHolder: string;
  recalled: boolean;
  custodyCompleteness: number;
  pendingTransfers: number;
};

export type AdminDashboard = {
  kpis: {
    totalBatches: number;
    batchesThisMonth: number;
    totalOrganizations: number;
    approvedOrganizations: number;
    pendingApprovals: number;
    activeRecalls: number;
    transferRecords: number;
  };
  batchFlow: { month: string; count: number }[];
  orgDistribution: { kind: string; count: number }[];
  activeRecalls: {
    id: string;
    batchNumber: string;
    medicineName: string;
    manufacturer: string;
    expiryDate: string;
    quantity: number;
    reason: string | null;
    severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    totalDownstream: number;
    acknowledgedCount: number;
  }[];
  recentEvents: {
    id: string;
    type: string;
    actor: string;
    batchNumber: string;
    medicineName: string;
    details: string;
    createdAt: string;
  }[];
  custodyActivity: {
    id: string;
    batchNumber: string;
    medicineName: string;
    from: string;
    to: string;
    status: string;
    offeredAt: string;
  }[];
  chainStatus: null;
  recallProgressAvailable: false;
  custodyCompletenessAvailable: true;
  averageCustodyCompleteness: number | null;
  alerts: { type: string; severity: string; message: string }[];
  organizations: Organization[];
  batches: Batch[];
};
