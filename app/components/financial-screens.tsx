"use client";
import {
  PageHeading,
  StatCard,
  Person,
  Badge,
  EmptyState,
  ScrollTable,
} from "./prototype-ui";
import Icon from "./ui-icon";
import {
  money,
  type Snapshot,
  type FinancialRow,
  type PaymentStats,
} from "@/lib/domain/financial-view";
export type FinanceAction = (action: string, row?: FinancialRow) => void;
export function PayrollScreen({
  run,
  toolbar,
  onAction,
}: {
  run: Snapshot | null;
  toolbar: React.ReactNode;
  onAction: FinanceAction;
}) {
  const rows = run?.rows ?? [],
    minutes = rows.reduce((n, r) => n + r.minutes, 0),
    total = rows.reduce((n, r) => n + r.net, 0);
  return (
    <>
      <PageHeading
        eyebrow="HOURS INTO PAYMENTS"
        title="Teacher payroll"
        subtitle="အတည်ပြုထားတဲ့ သင်ကြားချိန်များအတွက် ဆရာကြေးတွက်ပါ။"
        actions={<span className="mini-badge">Admin approval</span>}
      />
      <details className="workflow-help">
        <summary>How payroll is calculated</summary>
        <p>
          Only verified teaching records with complete times and no pending
          correction are eligible. Teaching minutes are multiplied by the
          effective hourly rate, then rounded to whole MMK per record. Approval
          saves the reviewed amounts; payments are recorded separately.
        </p>
      </details>
      <section className="card payroll-preview">
        {toolbar}
        {run ? (
          <>
            <div className="card-head">
              <div>
                <h2>
                  {run.status === "Draft"
                    ? "Payroll preview"
                    : run.status === "Void"
                      ? "Voided payroll snapshot"
                      : "Approved payroll snapshot"}
                </h2>
                <p className="subtext">
                  {run.from} → {run.to} · {run.included} eligible sessions
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <Badge label={run.stale ? "Out of date" : run.status} />
                {run.status === "Draft" ? (
                  <button
                    className="btn primary small"
                    onClick={() =>
                      onAction(run.stale ? "recalculate" : "approve")
                    }
                  >
                    {run.stale ? (
                      "Recalculate draft"
                    ) : (
                      <>
                        Approve payroll <Icon name="arrow" />
                      </>
                    )}
                  </button>
                ) : run.status === "Approved" ? (
                  <>
                    <button
                      className="btn primary small"
                      onClick={() => onAction("payments")}
                    >
                      Record payments
                    </button>
                    {!run.hasHistory ? (
                      <button
                        className="btn small"
                        onClick={() => onAction("void")}
                      >
                        Void unpaid run
                      </button>
                    ) : (
                      <span className="record-note">
                        Payment history retained
                      </span>
                    )}
                  </>
                ) : null}
              </div>
            </div>
            <ScrollTable
              headings={[
                "Teacher",
                "Minutes / hours",
                "Gross (MMK)",
                "Adjustment",
                "Net (MMK)",
                "",
              ]}
            >
              {rows.map((row, i) => (
                <tr key={row.teacher.id}>
                  <td>
                    <Person
                      name={row.teacher.name}
                      code={row.teacher.code}
                      tone={i}
                    />
                  </td>
                  <td>
                    {row.minutes}{" "}
                    <small className="muted">
                      / {(row.minutes / 60).toFixed(2)} hr
                    </small>
                  </td>
                  <td>{money(row.gross)}</td>
                  <td>
                    {money(row.adjustment)}{" "}
                    {run.status === "Draft" && (
                      <button
                        className="btn small icon-only"
                        aria-label={
                          "Edit payroll adjustment for " + row.teacher.name
                        }
                        title={
                          "Edit payroll adjustment for " + row.teacher.name
                        }
                        onClick={() => onAction("adjustment", row)}
                      >
                        <Icon name="edit" />
                      </button>
                    )}
                  </td>
                  <td>
                    <strong>{money(row.net)}</strong>
                  </td>
                  <td>
                    <button
                      className="btn small"
                      onClick={() => onAction("breakdown", row)}
                    >
                      Breakdown
                    </button>
                  </td>
                </tr>
              ))}
            </ScrollTable>
            <div className="payroll-totals">
              <div>
                <span>Verified teaching</span>
                <strong>
                  {(minutes / 60).toFixed(2)} <small>hours</small>
                </strong>
              </div>
              <div>
                <span>Teachers included</span>
                <strong>{rows.length}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span>Total payable · MMK</span>
                <strong>{money(total)}</strong>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="Your next payroll starts here"
            text="Choose a date range and calculate a draft. Review every line before approval."
          />
        )}
      </section>
      {Boolean(run?.held.length) && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Held records</h2>
              <p className="subtext">
                These sessions are excluded from this payroll snapshot.
              </p>
            </div>
            <span className="mini-badge">{run!.held.length} records</span>
          </div>
          <ScrollTable headings={["Teacher", "Session", "Why it is held", ""]}>
            {run!.held.map((h) => (
              <tr key={h.sessionId}>
                <td>
                  <Person name={h.teacher.name} code={h.teacher.code} />
                </td>
                <td>{h.sessionId.slice(0, 12)}</td>
                <td>{h.reason}</td>
                <td>
                  <button
                    className="btn small"
                    onClick={() =>
                      onAction("review", {
                        runId: run!.id,
                        version: run!.version,
                        from: run!.from,
                        to: run!.to,
                        teacher: h.teacher,
                        minutes: 0,
                        gross: 0,
                        adjustment: 0,
                        net: 0,
                        lines: [
                          {
                            id: h.sessionId,
                            sessionId: h.sessionId,
                            minutes: 0,
                            rate: 0,
                            amount: 0,
                          },
                        ],
                        adjustments: [],
                        payments: [],
                      })
                    }
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </ScrollTable>
        </section>
      )}
    </>
  );
}
export function PaymentsScreen({
  admin,
  rows,
  stats,
  runs,
  status,
  period,
  onFilter,
  onAction,
  pagination,
}: {
  admin: boolean;
  rows: FinancialRow[];
  stats: PaymentStats;
  runs: { id: string; from: string; to: string }[];
  status: string;
  period: string;
  onFilter: (status: string, period: string) => void;
  onAction: FinanceAction;
  pagination?: React.ReactNode;
}) {
  return (
    <>
      <PageHeading
        eyebrow={admin ? "PAYMENT RECORDS" : "MY PAYMENT SUMMARY"}
        title={admin ? "Payments" : "My payments"}
        subtitle={
          admin
            ? "ငွေပေးချေပြီးမှ Paid အဖြစ်မှတ်ပါ။ တကယ့် bank transfer မလုပ်ပါ။"
            : "Admin အတည်ပြုပြီး ဆရာကြေးနဲ့ ပေးချေမှုအခြေအနေကို ကြည့်ပါ။"
        }
      />
      <section className="stats-grid">
        <StatCard
          label="Matching payrolls"
          value={stats.periods}
          unit="periods"
          note="Frozen payroll snapshots"
          icon="payroll"
        />
        <StatCard
          label="Total approved"
          value={money(stats.approved_mmk)}
          unit="MMK"
          note="Approved amounts"
          icon="payments"
        />
        <StatCard
          label="Paid"
          value={money(stats.paid_mmk)}
          unit="MMK"
          note="Manually recorded"
          icon="check"
        />
        <StatCard
          label="Awaiting payment"
          value={stats.unpaid_count}
          unit="entries"
          note="Approved, not yet paid"
          icon="clock"
          warm
        />
      </section>
      <section className="card">
        <div className="card-head">
          <h2>{admin ? "Teacher payments" : "My approved payments"}</h2>
          <span className="mini-badge">Manual payment history</span>
        </div>
        <div className="toolbar">
          <label className="inline-filter">
            Status
            <select
              aria-label="Filter payment status"
              value={status}
              onChange={(e) => onFilter(e.target.value, period)}
            >
              <option value="all">All statuses</option>
              <option value="unpaid">Not paid</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="inline-filter">
            Payroll
            <select
              aria-label="Filter payroll period"
              value={period}
              onChange={(e) => onFilter(status, e.target.value)}
            >
              <option value="">All payroll periods</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.from} → {r.to}
                </option>
              ))}
            </select>
          </label>
          {(status !== "all" || period) && (
            <button className="btn small" onClick={() => onFilter("all", "")}>
              Clear filters
            </button>
          )}
        </div>
        <ScrollTable
          headings={[
            "Teacher",
            "Payroll period",
            "Net (MMK)",
            "Payment status",
            "",
          ]}
        >
          {rows.map((row, i) => {
            const paid = row.payments.find((p) => !p.reversed);
            return (
              <tr key={row.runId + row.teacher.id}>
                <td>
                  <Person
                    name={row.teacher.name}
                    code={row.teacher.code}
                    tone={i}
                  />
                </td>
                <td>
                  {row.from} → {row.to}
                </td>
                <td>
                  <strong>{money(row.net)}</strong>
                </td>
                <td>
                  <Badge label={paid ? "Paid" : "Not paid"} />
                  {paid && (
                    <div className="record-note">
                      {paid.method} · {paid.date}
                    </div>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className={
                        "btn small " + (admin && !paid ? "primary" : "")
                      }
                      onClick={() =>
                        onAction(admin && !paid ? "pay" : "breakdown", row)
                      }
                    >
                      {admin && !paid ? "Record payment" : "View details"}
                    </button>
                    {admin && paid && (
                      <button
                        className="btn small"
                        onClick={() => onAction("reverse", row)}
                      >
                        Reverse
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </ScrollTable>
        {!rows.length && (
          <EmptyState
            title={
              status !== "all" || period
                ? "No payments match these filters"
                : "No approved payments yet"
            }
            text={
              admin
                ? "Create and approve a payroll to record teacher payments."
                : "Approved pay appears here after your administrator completes payroll."
            }
          />
        )}{" "}
        {pagination}
      </section>
      {rows.some((r) => r.payments.some((p) => p.reversed)) && (
        <div className="notice">
          Reversed payment records are retained in payment details and activity
          history.
        </div>
      )}
    </>
  );
}
export function FinancialBreakdown({ row }: { row: FinancialRow }) {
  return (
    <>
      <Person name={row.teacher.name} code={row.teacher.code} />
      <p className="request-reason">
        {row.from} → {row.to}
      </p>
      <ScrollTable
        headings={["Session", "Minutes", "Hourly rate (MMK)", "Amount (MMK)"]}
      >
        {row.lines.map((l) => (
          <tr key={l.id}>
            <td>{l.sessionId.slice(0, 12)}</td>
            <td>{l.minutes}</td>
            <td>{money(l.rate)}</td>
            <td>{money(l.amount)}</td>
          </tr>
        ))}
      </ScrollTable>
      {row.adjustments.map((a, i) => (
        <div className="history-item" key={i}>
          <strong>Adjustment {money(a.amount)} MMK</strong>
          <p>
            {a.reason}
            {a.reference && " · " + a.reference}
          </p>
        </div>
      ))}
      <div className="detail-row">
        <span>Net payable</span>
        <strong>{money(row.net)} MMK</strong>
      </div>
      {row.payments.map((p) => (
        <article className="history-item" key={p.id}>
          <Badge label={p.reversed ? "Reversed" : "Paid"} />
          <strong> {money(p.amount)} MMK</strong>
          <p>
            {p.date} · {p.method} · {p.reference}
          </p>
          {p.reason && <p>Reversal reason: {p.reason}</p>}
        </article>
      ))}
    </>
  );
}
