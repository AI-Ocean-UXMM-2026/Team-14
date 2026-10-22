"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceShell from "@/app/components/workspace-shell";
import Dialog from "@/app/components/dialog";
import {
  PayrollScreen,
  PaymentsScreen,
  FinancialBreakdown,
} from "@/app/components/financial-screens";
import {
  snapshot,
  financialRow,
  title,
  type FinancialRow,
  type FinancialTeacher,
  type PaymentRegister,
} from "@/lib/domain/financial-view";
import type { PayrollRun, PayrollDetail } from "@/lib/domain/payroll-records";
import { logout } from "@/app/login/actions";
import PayrollForm from "./payroll-form";
export type PayrollClientProps = {
 navCount?:number;
  admin: boolean;
  paymentsView: boolean;
  runs: PayrollRun[];
  detail: PayrollDetail | null;
  teachers: FinancialTeacher[];
  register: PaymentRegister | null;
  status: string;
  period: string;
  offset: number;
  today: string;
  requestKey: string;
  historyOffset: number;
  hasMoreRuns: boolean;
};
export default function PayrollClient(p: PayrollClientProps) {
  const router = useRouter(),
    [modal, setModal] = useState<{
      action: string;
      row?: FinancialRow;
      key: string;
    } | null>(null),
    [notice, setNotice] = useState("");
  const run = p.detail ? snapshot(p.detail, p.teachers) : null;
  const action = (action: string, row?: FinancialRow) => {
    if (action === "payments") {
      router.push("/workspace/payroll?view=payments&period=" + run!.id);
      return;
    }
    if (action === "review" && row) {
      const id = row.lines[0].sessionId;
      router.push("/workspace?view=sessions&q=" + id + "&detail=" + id);
      return;
    }
    setModal({ action, row, key: crypto.randomUUID() });
  };
  const go = (status: string, period: string, offset = 0) =>
    router.push(
      "/workspace/payroll?" +
        new URLSearchParams({
          view: "payments",
          status,
          period,
          offset: String(offset),
        }),
    );
  const row = modal?.row,
    paid = row?.payments.find((payment) => !payment.reversed),
    adjustment = row?.adjustments[0];
  const onSaved = (id?: string) => {
    setModal(null);
    setNotice("Saved successfully.");
    if (id) router.push("/workspace/payroll?run=" + id);
    else router.refresh();
  };
  const rows =
    p.register?.rows.map((r) =>
      financialRow(
        {
          id: r.run_id,
          version: r.run_version,
          starts_on: r.starts_on,
          ends_on: r.ends_on,
        },
        { id: r.teacher_id, name: r.name, code: r.code },
        r,
        r.lines,
        r.adjustments,
        r.payments,
      ),
    ) ?? [];
  const pagination = p.register && (
    <div className="table-foot pagination">
      <span>
        {p.register.total ? p.offset + 1 : 0}–
        {Math.min(p.offset + 50, p.register.total)} of {p.register.total}{" "}
        payments
      </span>
      <button
        className="btn small"
        disabled={!p.offset}
        onClick={() => go(p.status, p.period, Math.max(0, p.offset - 50))}
      >
        Previous
      </button>
      <button
        className="btn small"
        disabled={p.offset + 50 >= p.register.total}
        onClick={() => go(p.status, p.period, p.offset + 50)}
      >
        Next
      </button>
    </div>
  );
  return (
    <WorkspaceShell
      role={p.admin ? "admin" : "teacher"}
 count={p.navCount??p.register?.nav_count??0} name={p.register?.profile?.name}
      page={p.paymentsView ? "payments" : "payroll"}
      title={
        p.paymentsView ? (p.admin ? "Payments" : "My payments") : "Payroll"
      }
      signOut={
        <form action={logout}>
          <button className="btn small">Sign out</button>
        </form>
      }
    >
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {p.paymentsView ? (
        <PaymentsScreen
          admin={p.admin}
          rows={rows}
          stats={p.register!.stats}
          runs={p.register!.runs.map((r) => ({
            id: r.run_id,
            from: r.starts_on,
            to: r.ends_on,
          }))}
          status={p.status}
          period={p.period}
          onFilter={go}
          onAction={action}
          pagination={pagination}
        />
      ) : (
        <PayrollScreen
          run={run}
          onAction={action}
          toolbar={
            <div className="toolbar">
              <PayrollForm
                compact
                operation="calculate_payroll"
                requestKey={p.requestKey}
                label="Calculate draft"
                start={run?.from ?? p.today.slice(0, 7) + "-01"}
                end={run?.to ?? p.today}
                onSaved={onSaved}
              />
              {run?.status==='Draft'&&<button className="text-link" onClick={()=>action('add-adjustment')}>Add teacher adjustment</button>}
<span className="spacer" />
              <label className="sr-only" htmlFor="saved-run">
                Select saved payroll
              </label>
              <select
                id="saved-run"
                aria-label="Select saved payroll"
                value={run?.id ?? ""}
                onChange={(e) =>
                  router.push(
                    "/workspace/payroll" +
                      (e.target.value ? "?run=" + e.target.value : ""),
                  )
                }
              >
                <option value="">Current draft</option>
                {p.runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.starts_on} → {r.ends_on} · {title(r.status)} ·{" "}
                    {r.id.slice(-6)}
                  </option>
                ))}
              </select>
              {(p.historyOffset > 0 || p.hasMoreRuns) && (
                <div className="history-paging">
                  <a
                    className="text-link"
                    href={
                      "/workspace/payroll?history=" +
                      Math.max(0, p.historyOffset - 50)
                    }
                  >
                    Newer runs
                  </a>
                  {p.hasMoreRuns && (
                    <a
                      className="text-link"
                      href={
                        "/workspace/payroll?history=" + (p.historyOffset + 50)
                      }
                    >
                      Older runs
                    </a>
                  )}
                </div>
              )}
            </div>
          }
        />
      )}
      {modal && (
        <Dialog
          key={modal.key}
          title={
            {
              breakdown: "Payment & teaching breakdown",
              adjustment: "Payroll adjustment", "add-adjustment":"Payroll adjustment",
              approve: "Approve payroll?",
              recalculate: "Recalculate draft",
              pay: "Record payment",
              reverse: "Reverse payment record",
              void: "Void unpaid payroll",
            }[modal.action] ?? "Payroll"
          }
          onClose={() => setModal(null)}
        >
          {row && modal.action === "breakdown" ? (
            <FinancialBreakdown row={row} />
          ) : (
            <>
              {row && (
                <p className="request-reason">
                  {row.teacher.name} · {row.from} → {row.to}
                </p>
              )}
              {modal.action === "pay" && (
                <p>
                  Record a full payment already made outside Saya-Sync. This
                  action does not transfer money.
                </p>
              )}
              {modal.action === "reverse" && (
                <p>
                  The original payment remains in history. This action does not
                  transfer money.
                </p>
              )}
              {modal.action === "void" && (
                <p>
                  The unpaid snapshot stays in history. Its session allocations
                  will be released.
                </p>
              )}
              <PayrollForm
                operation={
                  {
                    adjustment: "set_payroll_adjustment", "add-adjustment":"set_payroll_adjustment",
                    approve: "approve_payroll",
                    recalculate: "recalculate_payroll",
                    pay: "record_payment",
                    reverse: "reverse_payment",
                    void: "void_payroll",
                  }[modal.action]!
                }
                entity={
                  modal.action === "reverse"
                    ? paid?.id
                    : (row?.runId ?? run?.id)
                }
                version={row?.version ?? run?.version}
                requestKey={modal.key}
                label={
                  {
                    adjustment: "Save adjustment", "add-adjustment":"Save adjustment",
                    approve: "Approve payroll",
                    recalculate: "Recalculate draft",
                    pay: "Record payment",
                    reverse: "Reverse payment record",
                    void: "Void unpaid payroll",
                  }[modal.action] ?? "Save"
                }
                teachers={modal.action==="add-adjustment"?p.teachers:undefined}
 teacherId={row?.teacher.id}
                initialAmount={adjustment?.amount}
                initialReason={adjustment?.reason}
                initialReference={adjustment?.reference ?? ""}
                today={p.today}
                onSaved={onSaved}
              />
            </>
          )}
        </Dialog>
      )}
    </WorkspaceShell>
  );
}
