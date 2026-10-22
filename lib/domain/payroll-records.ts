export type PayrollRun={id:string;starts_on:string;ends_on:string;status:'draft'|'approved'|'void';version:number;revision:number;policy_version:number;total_mmk:number|null;approved_at:string|null;void_reason:string|null};
export type PayrollLine={id:string;session_id:string;teacher_id:string;minutes:number;hourly_mmk:number;amount_mmk:number};
export type PayrollAdjustment={id:string;teacher_id:string;amount_mmk:number;reason:string;reference:string|null};
export type PayrollPayment={id:string;teacher_id:string;amount_mmk:number;paid_on:string;method:string;reference:string;reversed_at:string|null;reversal_reason:string|null};
export type PayrollSummary={teacher_id:string;gross_mmk:number;adjustment_mmk:number;net_mmk:number};
export type PayrollDetail={is_stale?:boolean;run:PayrollRun;held:{session_id:string;teacher_id:string;reason:string}[];lines:PayrollLine[];adjustments:PayrollAdjustment[];payments:PayrollPayment[];summaries:PayrollSummary[]};
export type MyPayroll={run_id:string;starts_on:string;ends_on:string;approved_at:string;summary:PayrollSummary;lines:PayrollLine[];adjustments:PayrollAdjustment[];payments:PayrollPayment[]};
