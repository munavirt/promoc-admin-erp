export type CurrencyCode = "INR";

export type FinanceRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface ManagerPermissionConfig {
  canCreateInvoices: boolean;
  canRecordPayments: boolean;
  canManageIncomeExpenses: boolean;
  canDeleteOrReverse: boolean;
  canViewAuditHistory: boolean;
}

export interface FinancePermissions {
  role: FinanceRole;
  canViewFinance: boolean;
  canManageIncome: boolean;
  canManageExpenses: boolean;
  canReverseExpenses: boolean;
  canCreateInvoices: boolean;
  canIssueInvoices: boolean;
  canCancelInvoices: boolean;
  canRecordPayments: boolean;
  canAllocateAdvances: boolean;
  canViewAuditHistory: boolean;
  canManageSettings: boolean;
}

export interface AgencyFinanceSettings {
  legalName: string;
  gstin: string;
  registeredAddress: string;
  stateCode: string;
  stateName: string;
  bankDetails: string;
  defaultPaymentInstructions: string;
  defaultTermsAndConditions: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type PaymentMethod = "Bank Transfer" | "UPI" | "Cash" | "Other";

export type IncomeCategory =
  | "Service Revenue"
  | "Consultation Fees"
  | "Maintenance Revenue"
  | "Other Income";

export type ExpenseCategory =
  | "Employee Salaries"
  | "Software & Subscriptions"
  | "Hosting & Domains"
  | "Marketing & Advertising"
  | "Freelancers & Contractors"
  | "Office & Utilities"
  | "Travel & Transportation"
  | "Equipment"
  | "Other Expenses";

export type ExpenseStatus = "Active" | "Reversed";

export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

export type InvoiceType =
  | "Manual"
  | "Full Project"
  | "Milestone"
  | "Advance"
  | "Partial";

export type SupplyType = "intra_state" | "inter_state";

export type DiscountType = "percentage" | "fixed";

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** The selected file, uploaded to the backend as multipart (never stored in the browser). */
  file?: File;
  /** URL of a file already stored on the backend. */
  url?: string;
  uploadedAt: string;
}

export interface FinanceClient {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  billingAddress: string;
  gstin?: string;
  status: "Active" | "Inactive";
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  amount: number;
  dueDate: string;
  completionStatus: "Completed" | "In Progress" | "Pending";
}

export interface FinanceProject {
  id: string;
  name: string;
  clientId: string;
  agreedCost: number;
  status: "Planning" | "In Progress" | "Review" | "Completed";
  startDate: string;
  dueDate: string;
  milestones: ProjectMilestone[];
}

export interface IncomeRecord {
  id: string;
  transactionCode: string;
  title: string;
  amount: number;
  category: IncomeCategory;
  clientId?: string;
  projectId?: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  attachment?: AttachmentFile | null;
  status?: ExpenseStatus;
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ExpenseRecord {
  id: string;
  expenseCode: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  vendor?: string;
  projectId?: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  description?: string;
  receipt?: AttachmentFile | null;
  status: ExpenseStatus;
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  hsnSacCode?: string;
  quantity: number;
  unitPrice: number;
  gstRate?: number;
  milestoneId?: string;
}

export interface TaxConfig {
  label: string;
  rate: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  clientId: string;
  projectId?: string;
  milestoneIds?: string[];
  invoiceDate: string;
  dueDate: string;
  items: InvoiceLineItem[];
  discountType: DiscountType;
  discountValue: number;
  taxConfig: TaxConfig;
  supplyType: SupplyType;
  placeOfSupplyStateCode?: string;
  notes?: string;
  paymentInstructions?: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  status: InvoiceStatus;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  issuedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  revisionOfInvoiceId?: string;
  revisionOfInvoiceNumber?: string;
  projectBillingConfirmed?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  allocatedAt: string;
}

export interface PaymentRecord {
  id: string;
  paymentCode: string;
  clientId: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  notes?: string;
  attachment?: AttachmentFile | null;
  isAdvance: boolean;
  allocations: PaymentAllocation[];
  createdAt: string;
  createdBy: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: "INCOME" | "EXPENSE" | "INVOICE" | "PAYMENT" | "PERMISSIONS" | "SETTINGS";
  entityId: string;
  entityCode: string;
  action: string;
  description: string;
  performedBy: string;
  performedAt: string;
}

export type OverviewDatePreset =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "this_year"
  | "custom";

export interface OverviewDateFilter {
  preset: OverviewDatePreset;
  startDate?: string;
  endDate?: string;
}

export interface MonthlyPerformancePoint {
  monthKey: string;
  monthLabel: string;
  manualIncome: number;
  invoicePayments: number;
  totalIncome: number;
  expenses: number;
  netCashMovement: number;
}

export interface ExpenseCategoryBreakdownItem {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  count: number;
}

export interface RecentTransactionItem {
  id: string;
  code: string;
  type: "Manual Income" | "Invoice Payment" | "Advance Payment" | "Expense";
  categoryLabel: string;
  title: string;
  partyName: string;
  date: string;
  amount: number;
  direction: "inflow" | "outflow";
  paymentMethod: PaymentMethod;
  referenceId?: string;
}

export interface FinanceOverviewSummary {
  rangeStart: string;
  rangeEnd: string;
  totalIncomeReceived: number;
  manualIncomeReceived: number;
  invoicePaymentsReceived: number;
  totalExpenses: number;
  netCashMovement: number;
  outstandingInvoicesTotal: number;
  overdueInvoicesTotal: number;
  overdueInvoicesCount: number;
  unallocatedAdvanceTotal: number;
  incomeChangePct?: number | null;
  expenseChangePct?: number | null;
  netCashChangePct?: number | null;
  monthlyPerformance: MonthlyPerformancePoint[];
  expenseBreakdown: ExpenseCategoryBreakdownItem[];
  recentTransactions: RecentTransactionItem[];
  recentInvoices: InvoiceRecord[];
  overdueInvoices: InvoiceRecord[];
  upcomingDeadlines: InvoiceRecord[];
}
