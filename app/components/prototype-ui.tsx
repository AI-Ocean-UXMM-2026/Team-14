import Icon from "./ui-icon";
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="subtext">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </section>
  );
}
export function StatCard({
  label,
  value,
  unit = "",
  note,
  icon,
  warm = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note: string;
  icon: string;
  warm?: boolean;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={"stat-icon " + (warm ? "warm" : "")}>
          <Icon name={icon} />
        </span>
      </div>
      <div className="stat-value">
        {value} <small>{unit}</small>
      </div>
      <div className="stat-foot">
        <span className="pill-dot" />
        {note}
      </div>
    </article>
  );
}
export function Person({
  name,
  code,
  tone = 0,
}: {
  name: string;
  code: string;
  tone?: number;
}) {
  return (
    <div className="person">
      <span className={"avatar tone-" + (tone % 5)} aria-hidden="true">
        {name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")}
      </span>
      <div>
        <strong>{name}</strong>
        <small>{code}</small>
      </div>
    </div>
  );
}
export function Badge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    Verified: "verified",
    Approved: "approved",
    Paid: "paid",
    Pending: "pending",
    Draft: "draft",
    Rejected: "rejected",
    "Missing checkout": "missing",
    "In progress": "progress",
    Void: "void",
    Reversed: "void",
    Active: "verified",
    Inactive: "void",
    Withdrawn: "void",
    "Not paid": "unpaid",
    "Out of date": "missing",
    Cancelled: "void",
  };
  return (
    <span className={"badge " + (styles[label] ?? "pending")}>{label}</span>
  );
}
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name="leaf" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
export function ScrollTable({
  headings,
  children,
  label = "Scrollable records table",
}: {
  headings: string[];
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table>
        <thead>
          <tr>
            {headings.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function WorkflowHelp() {
  return (
    <details className="workflow-help">
      <summary>How your teaching time becomes pay</summary>
      <p>
        Check out after class. Your administrator verifies the record, includes
        eligible minutes in payroll, and records your payment.
      </p>
    </details>
  );
}
