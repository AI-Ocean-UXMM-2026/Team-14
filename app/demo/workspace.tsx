"use client";
import { useEffect, useState } from "react";
import WorkspaceShell, {
  adminGroups,
  teacherGroups,
} from "../components/workspace-shell";
import Dialog,{FormActions} from "../components/dialog";
import Icon from "../components/ui-icon";
import Activity from "../components/teaching-activity";
import {
  PageHeading,
  StatCard,
  Person,
  Badge,
  WorkflowHelp,
} from "../components/prototype-ui";
import {
  PayrollScreen,
  PaymentsScreen,
  FinancialBreakdown,
} from "../components/financial-screens";
import { demoSnapshot } from "@/lib/prototype/financial";
import type { FinancialRow } from "@/lib/domain/financial-view";
import { TeacherCards, ClassCards } from "../components/master-cards";
import ClassRecordsTable from "../components/class-records-table";
import ReviewSummary from "../components/review-summary";
import {CorrectionCards,ReviewNavigation} from "../components/correction-cards";
import {EmptyState} from "../components/prototype-ui";
import TeacherToday from "../components/teacher-today";
import ElapsedClock from "../components/elapsed-clock";
import {
  prototype,
  date,
  time,
  day,
  money,
  status,
  type Data,
  type Store,
  type Session,
  type Run,
} from "@/lib/prototype/model";
import { yangonTimestamp } from "@/lib/domain/datetime";
const KEY = "sayasync-react-prototype-v1";
type Modal = { type: string; id?: string; teacher?: string };
export default function Workspace({
  initialRole = "admin",
}: {
  initialRole?: "admin" | "teacher";
}) {
  const [store, setStore] = useState<Store>(() => new prototype.Store()),
    [role, setRole] = useState(initialRole),
    [page, setPage] = useState(initialRole === "admin" ? "overview" : "home"),
    [modal, setModal] = useState<Modal | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [reviewTab, setReviewTab] = useState("Pending"),
    [reviewView, setReviewView] = useState("corrections"),
    [draft, setDraft] = useState<Run | null>(null),
    [selectedRun, setSelectedRun] = useState(""),
    [paymentPeriod, setPaymentPeriod] = useState(""),
    [breakdown, setBreakdown] = useState<FinancialRow | null>(null);
  const teacherId = "T001",
    d = store.data,
    t = store.teacher(teacherId);
  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(KEY) ?? localStorage.getItem("ai14-blue-ui-v03");
      if (raw) {
        const parsed = JSON.parse(raw) as Data;
        if (
          parsed.schema === 1 &&
          Array.isArray(parsed.teachers) &&
          Array.isArray(parsed.classes) &&
          Array.isArray(parsed.sessions) &&
          Array.isArray(parsed.corrections) &&
          Array.isArray(parsed.runs) &&
          Array.isArray(parsed.payments) &&
          parsed.teachers.some((t) => t.id === "T001")
        )
          setStore(new prototype.Store(parsed));
      }
    } catch {}
    const hash = location.hash.slice(1).split("?")[0];
    const allowed = (
      initialRole === "admin" ? adminGroups : teacherGroups
    ).flatMap(([, items]) => items.map(([id]) => id as string));
    if (allowed.includes(hash)) setPage(hash);
  }, [initialRole]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const navigate = (target: string, condition = "") => {
    setPage(target);
    setQuery("");
    setFilter(condition);
    setError("");
    history.replaceState(null, "", "?role=" + role + "#" + target);
  };
  const open = (type: string, id?: string, teacher?: string) => {
    setError("");
    setModal({ type, id, teacher });
  };
  const change = (
    fn: (next: Store) => void,
    message = "Saved in this fictional demo.",
  ) => {
    try {
      const next = new prototype.Store(store.data);
      fn(next);
      setStore(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next.data));
      } catch {
        setToast(
          "Browser storage is unavailable. Changes last for this tab only.",
        );
      }
      setModal(null);
      setError("");
      setToast(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
      return false;
    }
  };
  const own = d.sessions.filter(
      (s) => role === "admin" || s.teacher === teacherId,
    ),
    rows = own
      .filter(
        (s) =>
          (!filter || status(s) === filter) &&
          (!query ||
            [
              s.id,
              store.teacher(s.teacher).name,
              d.classes.find((c) => c.id === s.classId)?.subject,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase())),
      )
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  const pending = d.corrections.filter(
    (c) =>
      c.status === "Pending" &&
      (role === "admin" || store.session(c.session).teacher === teacherId),
  );
  const verifyRows = d.sessions.filter(
    (s) =>
      s.end && s.status === "Pending" && !store.pending(s) && !store.locked(s),
  );
  const eligible = d.sessions.filter((s) => !store.reason(s));
  const minutes = eligible.reduce(
      (n, s) => n + prototype.mins(s.start, s.end),
      0,
    ),
    pay = eligible.reduce(
      (n, s) =>
        n + prototype.money(prototype.mins(s.start, s.end), store.rate(s)!),
      0,
    );
  const currentRun =
    draft && (!selectedRun || selectedRun === draft.id)
      ? draft
      : (d.runs.find((r) => r.id === selectedRun) ?? d.runs[0]);
  const cls = (id: string) => d.classes.find((c) => c.id === id)!;
  const badge = (label: string) => <Badge label={label} />;
  const person = (id: string) => {
    const t = store.teacher(id);
    return <Person name={t.name} code={id} tone={t.tone} />;
  };
  const head = (
    eyebrow: string,
    title: string,
    subtitle: string,
    actions?: React.ReactNode,
  ) => <PageHeading {...{ eyebrow, title, subtitle, actions }} />;
  const button = (label: React.ReactNode, fn: () => void, primary = false) => (
    <button className={"btn " + (primary ? "primary" : "")} onClick={fn}>
      {label}
    </button>
  );
  const stat = (
    label: string,
    value: string | number,
    unit: string,
    note: string,
    icon: string,
    warm = false,
  ) => <StatCard {...{ label, value, unit, note, icon, warm }} />;
  const recordTable = (list: Session[], compact = false) => (
    <ClassRecordsTable
      rows={list.map((s) => ({
        id: s.id,
        teacher: {
          name: store.teacher(s.teacher).name,
          code: s.teacher,
          tone: store.teacher(s.teacher).tone,
        },
        subject: cls(s.classId).subject,
        start: s.start,
        end: s.end,
        minutes: prototype.mins(s.start, s.end),
        status: status(s),
        pending: Boolean(store.pending(s)),
        actions: (
          <>
            {button("Details", () => open("details", s.id))}
            {!compact &&
              (store.pending(s) ? (
                role === "admin" ? (
                  button("Review correction", () =>
                    open("review", pending.find((c) => c.session === s.id)?.id),
                  )
                ) : (
                  button("View correction", () => navigate("reviews"))
                )
              ) : store.locked(s) ? (
                <span className="record-note">
                  Included in approved payroll
                </span>
              ) : role === "admin" && s.end && s.status !== "Verified" ? (
                button("Verify record", () => open("verify", s.id), true)
              ) : !s.end && status(s) === "Missing checkout" ? (
                button("Fix checkout", () => open("request", s.id))
              ) : null)}
          </>
        ),
      }))}
    />
  );
  const calculate = (from: string, to: string,force=false) => {
    if(!force&&draft&&Object.keys(draft.adjustments).length&&(draft.from!==from||draft.to!==to)){open('replace-period',from,to);return;}
    try {
      const next = store.draft(from, to);
      if (draft?.from === from && draft.to === to)
        for(const [id,adjustment] of Object.entries(draft.adjustments)){if(next.lines.some(l=>l.teacher===id)&&store.total(next,id).net+adjustment.amount>=0)next.adjustments[id]=structuredClone(adjustment);}
      setDraft(next);
      setSelectedRun(next.id);
      setError("");
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  function submit(form: FormData) {
    if (!modal) return;
    const val = (key: string) => String(form.get(key) ?? "").trim(),
      stamp = (part: string) =>
        yangonTimestamp(val(part + "Date") + "T" + val(part + "Time"));
    try {
      switch (modal.type) {
        case "request":
          change((s) => {
            s.request(modal.id!, stamp("start"), stamp("end"), val("reason"));
          }, "Correction requested.");
          break;
        case "review":
          change(
            (s) => s.review(modal.id!, val("decision"), val("reason")),
            "Correction reviewed.",
          );
          break;
        case "verify":
          change(
            (s) => s.verify(modal.id!, val("decision"), val("reason")),
            "Record reviewed.",
          );
          break;
        case "add-session":
          change((s) => {
            s.addSession(
              val("teacher"),
              val("classId"),
              yangonTimestamp(val("start")),
              yangonTimestamp(val("end")),
              val("reason"),
            );
          }, "Completed class record saved for review.");
          break;
        case "add-teacher":
          change((s) => {
            if (!val("name") || !val("email") || Number(val("rate")) <= 0)
              throw Error("Enter a name, email and positive hourly rate.");
            const id =
              "T" +
              String(
                Math.max(
                  0,
                  ...s.data.teachers.map((t) => Number(t.id.slice(1)) || 0),
                ) + 1,
              ).padStart(3, "0");
            s.data.teachers.push({
              id,
              name: val("name"),
              email: val("email"),
              rates: [{ from: val("from"), rate: Number(val("rate")) }],
              assignments: form.getAll("classes").map(String),
              active: true,
              tone: s.data.teachers.length,
            });
            s.log("Teacher added", val("name"));
          });
          break;
        case "assign":
          change((s) => {
            if (!val("reason"))
              throw Error("Enter an assignment change reason.");
            s.teacher(modal.id!).assignments = form
              .getAll("classes")
              .map(String);
            s.log(
              "Assigned classes updated",
              s.teacher(modal.id!).name + " · " + val("reason"),
            );
          });
          break;
        case "rate":
          change((s) => {
            if (Number(val("rate")) <= 0 || !val("reason") || !val("from"))
              throw Error("Enter a positive rate, effective date and reason.");
            const teacher = s.teacher(modal.id!);
            if (teacher.rates.some((r) => r.from === val("from")))
              throw Error("A rate already exists for this effective date.");
            teacher.rates.push({
              from: val("from"),
              rate: Number(val("rate")),
            });
            s.log("Hourly rate updated", teacher.name + " · " + val("reason"));
          });
          break;
        case "class-assign":
          change((s) => {
            if (!val("reason")) throw Error("Enter an assignment reason.");
            const target = s.data.classes.find((c) => c.id === modal.id)!;
            const ids = form.getAll("teachers").map(String);
            if (!target.active && ids.length)
              throw Error("Activate this class before assigning teachers.");
            for (const t of s.data.teachers)
              t.assignments = ids.includes(t.id)
                ? [...new Set([...t.assignments, target.id])]
                : t.assignments.filter((id) => id !== target.id);
            s.log(
              "Class assignments updated",
              target.name + " · " + val("reason"),
            );
          });
          break;
        case "add-class":
          change((s) => {
            if (!val("name") || !val("subject"))
              throw Error("Enter the class name and subject.");
            const code =
              "C" +
              String(
                Math.max(
                  100,
                  ...s.data.classes.map((c) => Number(c.id.slice(1)) || 0),
                ) + 1,
              );
            s.data.classes.push({
              id: code,
              name: val("name"),
              subject: val("subject"),
              active: true,
            });
            s.log("Class added", val("name"));
          });
          break;
        case "adjust": {
          if (!draft) throw Error("Calculate a draft first.");
          const amount = Number(val("amount"));
          if (!Number.isSafeInteger(amount) || !val("reason"))
            throw Error("Enter a whole MMK amount and reason.");
          const next = structuredClone(draft);
          next.adjustments[modal.teacher!] = { amount, reason: val("reason") };
          if (store.total(next, modal.teacher).net < 0)
            throw Error("Teacher net pay cannot be negative.");
          setDraft(next);
          setModal(null);
          break;
        }
        case "pay":
          change((s) => {
            s.pay(
              modal.id!,
              modal.teacher!,
              val("method"),
              val("paidOn"),
              val("reference"),
            );
          }, "Full external payment recorded. No money was transferred.");
          break;
        case "reverse":
          change(
            (s) => s.reversePayment(modal.id!, val("reason")),
            "Payment record reversed.",
          );
          break;
        case "void":
          change((s) => {
            if (s.data.payments.some((p) => p.run === modal.id))
              throw Error(
                "Payment history prevents voiding this run, including reversed payments.",
              );
            s.voidRun(modal.id!, val("reason"));
          }, "Unpaid payroll voided.");
          break;
        default:
          break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    }
  }
  const financeAction = (action: string, row?: FinancialRow) => {
    if (action === "breakdown" && row) {
      setBreakdown(row);
      open("breakdown");
    } else if (action === "adjustment")
      open("adjust", row?.runId, row?.teacher.id);
    else if (action === "approve") open("approve", currentRun?.id);
    else if (action === "recalculate" && currentRun)
      calculate(currentRun.from, currentRun.to);
    else if (action === "payments") {
      navigate("payments");
      setPaymentPeriod(currentRun?.id ?? "");
    } else if (action === "void") open("void", currentRun?.id);
    else if (action === "pay") open("pay", row!.runId, row!.teacher.id);
    else if (action === "reverse")
      open("reverse", row!.payments.find((p) => !p.reversed)!.id);
    else if (action === "review" && row)
      open("details", row.lines[0].sessionId);
  };
  const paymentRuns = d.runs.filter((r) => r.status === "Approved"),
    allPaymentRows = paymentRuns
      .flatMap((r) => demoSnapshot(store, r).rows)
      .filter((r) => role === "admin" || r.teacher.id === teacherId),
    paymentStatus = ["paid", "unpaid"].includes(filter) ? filter : "all",
    paymentRows = allPaymentRows.filter(
      (r) =>
        (!paymentPeriod || r.runId === paymentPeriod) &&
        (paymentStatus === "all" ||
          r.payments.some((p) => !p.reversed) === (paymentStatus === "paid")),
    );
  const dialog = modal && (
    <Dialog
      key={modal.type + modal.id}
      title={
        {
          details: "Class record details",breakdown:"Payment & teaching breakdown",approve:"Approve payroll?",
 "replace-period":"Start a new payroll period?",
          request: "Request a time correction",
          review: "Review time correction",
          verify: "Verify class record",
          "add-session": "Add a completed class",
          "add-teacher": "Welcome a teacher",
          assign: "Assign classes",
          rate: "Update hourly rate",
          "add-class": "Add class",
          adjust: "Payroll adjustment",
          pay: "Record payment",
          reverse: "Reverse payment record",
          void: "Void unpaid payroll",
          reset: "Reset the workspace?",
          teacher: "Teacher profile & rates",
          "class-assign": "Assign teachers",
          "confirm-teacher": "Change teacher status",
          "confirm-class": "Change class status",
        }[modal.type] ?? "Workspace"
      }
      onClose={() => {
        setModal(null);
        setError("");
      }}
    >
      <>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        {["confirm-teacher", "confirm-class"].includes(modal.type) ? (
          <>
            <p>
              Change the active status? New check-ins will be disabled when
              inactive. Previous teaching and payment history remains.
            </p>
            <div className="form-actions">
              {button("Cancel", () => setModal(null))}
              {button(
                "Confirm status change",
                () =>
                  change((s) => {
                    const target =
                      modal.type === "confirm-teacher"
                        ? s.teacher(modal.id!)
                        : s.data.classes.find((c) => c.id === modal.id)!;
                    if (
                      target.active &&
                      s.data.sessions.some(
                        (session) =>
                          (modal.type === "confirm-teacher"
                            ? session.teacher
                            : session.classId) === modal.id && !session.end,
                      )
                    )
                      throw Error("Resolve open teaching records first.");
                    target.active = !target.active;
                    s.log("Active status changed", target.name);
                  }),
                true,
              )}
            </div>
          </>
        ) : modal.type === 'replace-period' ? <><p>The current draft has adjustments. Starting a different period replaces this local draft.</p><div className="form-actions">{button('Keep current draft',()=>setModal(null))}{button('Start new period',()=>calculate(modal.id!,modal.teacher!,true),true)}</div></> : modal.type === "breakdown" && breakdown ? (
          <FinancialBreakdown row={breakdown} />
        ) : modal.type === "approve" ? (
          <>
            <p>
              Review the included and held records and teacher net amounts.
              Approval freezes this payroll; payment remains separate.
            </p>
            <div className="form-actions">
              {button("Cancel", () => setModal(null))}
              {button(
                "Approve payroll",
                () =>
                  change((s) => {
                    const approved = s.approve(currentRun!);
                    setDraft(null);
                    setSelectedRun(approved.id);
                  }, "Payroll approved. Payment remains separate."),
                true,
              )}
            </div>
          </>
        ) : modal.type === "reset" ? (
          <>
            <p>
              This restores the fictional sample data in this browser. School
              records are unaffected.
            </p>
            <div className="form-actions">
              {button("Cancel", () => setModal(null))}
              {button(
                "Reset demo data",
                () => {
                  const next = new prototype.Store();
                  setStore(next);
                  localStorage.setItem(KEY, JSON.stringify(next.data));
                  setDraft(null);
                  setSelectedRun("");
                  setModal(null);
                  setToast("Demo workspace restored.");
                },
                true,
              )}
            </div>
          </>
        ) : modal.type === "details" ? (
          <>
            {person(store.session(modal.id!).teacher)}
            <div className="info-grid">
              {[
                [
                  "Class / date",
                  cls(store.session(modal.id!).classId).subject +
                    " · " +
                    day(store.session(modal.id!).start),
                ],
                [
                  "Effective teaching time",
                  time(store.session(modal.id!).start) +
                    " → " +
                    time(store.session(modal.id!).end),
                ],
                [
                  "Original time",
                  time(store.session(modal.id!).originalStart) +
                    " → " +
                    time(store.session(modal.id!).originalEnd),
                ],
                [
                  "Payroll eligibility",
                  store.reason(store.session(modal.id!)) ||
                    "Eligible for payroll",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            {d.corrections
              .filter((c) => c.session === modal.id)
              .map((c) => (
                <div className="history-item" key={c.id}>
                  {badge(c.status)}
                  <p>
                    {time(c.start)} → {time(c.end)} · {c.reason}
                  </p>
                  {c.comment && <p>Admin: {c.comment}</p>}
                </div>
              ))}
            <div className="form-actions">
              {!store.locked(store.session(modal.id!)) &&
                !store.pending(store.session(modal.id!)) &&
                button("Request correction", () => open("request", modal.id))}
              {button("Close", () => setModal(null))}
            </div>
          </>
        ) : modal.type === "teacher" ? (
          <>
            {person(modal.id!)}
            <p>{store.teacher(modal.id!).email}</p>
            <div className="next-step">
              {button("Assign classes", () => open("assign", modal.id))}
              {button("View class records", () => {
                setModal(null);
                navigate("sessions");
                setQuery(store.teacher(modal.id!).name);
              })}
            </div>
            <p>
              {store
                .teacher(modal.id!)
                .assignments.map((id) => cls(id)?.name)
                .join(", ")}
            </p>
            {store.teacher(modal.id!).rates.map((r) => (
              <div className="detail-row" key={r.from}>
                <span>Effective {r.from}</span>
                <strong>{money(r.rate)} MMK / hour</strong>
              </div>
            ))}
            <DemoForm
              modal={{ type: "rate", id: modal.id }}
              store={store}
              onSubmit={(data) => {
                const val = (name: string) =>
                  String(data.get(name) ?? "").trim();
                change((s) => {
                  const t = s.teacher(modal.id!);
                  if (Number(val("rate")) <= 0 || !val("reason"))
                    throw Error("Enter a positive rate and reason.");
                  if (t.rates.some((r) => r.from === val("from")))
                    throw Error("A rate already exists for this date.");
                  t.rates.push({
                    from: val("from"),
                    rate: Number(val("rate")),
                  });
                  s.log("Hourly rate updated", t.name + " · " + val("reason"));
                });
              }}
            />
          </>
        ) : (
          <DemoForm modal={modal} store={store} onSubmit={submit} />
        )}
      </>
    </Dialog>
  );
  const titles: Record<string, string> = {
    overview: "Overview",
    home: "Today & check-in",
    sessions: role === "admin" ? "Class records" : "My class records",
    reviews: role === "admin" ? "Review inbox" : "My corrections",
    payroll: "Payroll",
    payments: role === "admin" ? "Payments" : "My payments",
    teachers: "Teachers",
    classes: "Classes & assignments",
    audit: "Activity log",
  };
  return (
    <WorkspaceShell
      demo
      role={role}
      page={page}
      title={titles[page] ?? "Overview"}
      name={t.name}
      count={pending.length + (role === "admin" ? verifyRows.length : 0)}
      onNavigate={navigate}
      onReset={() => open("reset")}
      onRoleChange={(next) => {
        setRole(next);
        setPage(next === "admin" ? "overview" : "home");
        setQuery("");
        setFilter("");
        history.replaceState(null, "", "?role=" + next);
      }}
    >
      <div className="demo-disclaimer">
        Fictional demo · changes stay in this browser. School sign-in is
        separate.
      </div>
      {error && !modal && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {page === "overview" && (
        <>
          {head(
            "YOUR ACADEMY AT A GLANCE",
            "Academy overview",
            "သင်ကြားမှုမှတ်တမ်း၊ စစ်ဆေးမှုနဲ့ ဆရာကြေး — တစ်နေရာတည်းမှာ။",
            <>
              <span className="mini-badge">All teaching records</span>
              {button(
                <>
                  <Icon name="plus" /> Add class record
                </>,
                () => open("add-session"),
                true,
              )}
            </>,
          )}
          <section className="stats-grid">
            {stat(
              "Active teachers",
              d.teachers.filter((t) => t.active).length,
              "teachers",
              "Across " +
                d.classes.filter((c) => c.active).length +
                " active classes",
              "teachers",
            )}
            {stat(
              "Payroll-ready hours",
              (minutes / 60).toFixed(2),
              "hours",
              "Verified & not yet allocated",
              "clock",
            )}
            {stat(
              "Needs your review",
              verifyRows.length,
              "records",
              pending.length + " pending corrections",
              "reviews",
              true,
            )}
            {stat(
              "Eligible payroll",
              money(pay),
              "MMK",
              "Verified sessions only",
              "payments",
            )}
          </section>
          <section className="two-col">
            <Activity sessions={d.sessions} />
            <ReviewSummary
              verify={verifyRows.length}
              corrections={pending.length}
              missing={
                d.sessions.filter((s) => status(s) === "Missing checkout")
                  .length
              }
              onNavigate={(view) => {
                navigate(
                  view === "missing" ? "sessions" : "reviews",
                  view === "missing" ? "Missing checkout" : "",
                );
                setReviewView(view === "verify" ? "sessions" : "corrections");
              }}
            />
          </section>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Recent class records</h2>
                <p className="subtext">Every class has a clear record.</p>
              </div>
              <button
                className="text-link"
                onClick={() => navigate("sessions")}
              >
                View all records <Icon name="arrow" />
              </button>
            </div>
            {recordTable(
              [...d.sessions]
                .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
                .slice(0, 5),
              true,
            )}
            <div className="table-foot">
              {d.sessions.length} records in your workspace
            </div>
          </section>
        </>
      )}
      {page === "home" && (
        <>
          {head(
            "TEACHER WORKSPACE",
            "မင်္ဂလာပါ " + t.name.split(" ")[0],
            "Your teaching time, records and payment status.",
            <span className="mini-badge">
              {t.name} · {t.id}
            </span>,
          )}
          <TeacherHome
            store={store}
            teacherId={teacherId}
            onCheckIn={(id) =>
              change((s) => {
                s.checkIn(teacherId, id);
              }, "Checked in. Teaching time is now recording.")
            }
            onCheckout={(id) =>
              change((s) => {
                s.checkOut(id);
              }, "Checked out. Your record is ready for review.")
            }
            onRequest={(id) => open("request", id)}
            onReviews={() => navigate("reviews")}
          />
          <section className="stats-grid">
            {stat(
              "My class records",
              own.length,
              "classes",
              "Your teaching history",
              "sessions",
            )}
            {stat(
              "Verified hours",
              (
                own
                  .filter((s) => s.status === "Verified")
                  .reduce((n, s) => n + prototype.mins(s.start, s.end), 0) / 60
              ).toFixed(2),
              "hours",
              "Admin-reviewed records",
              "clock",
            )}
            {stat(
              "Pending corrections",
              pending.length,
              "requests",
              "View My corrections",
              "reviews",
              true,
            )}
            {stat(
              "Awaiting payment",
              money(
                d.runs
                  .filter(
                    (r) =>
                      r.status === "Approved" &&
                      !d.payments.some(
                        (p) =>
                          p.run === r.id &&
                          p.teacher === teacherId &&
                          p.status === "Paid",
                      ),
                  )
                  .reduce((n, r) => n + store.total(r, teacherId).net, 0),
              ),
              "MMK",
              "Approved and not yet paid",
              "payments",
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Your recent classes</h2>
            </div>
            {recordTable([...own].reverse().slice(0, 5))}
          </section>
        </>
      )}
      {page === "sessions" && (
        <>
          {head(
            role === "admin" ? "CLASS MANAGEMENT" : "MY TEACHING HISTORY",
            titles.sessions,
            "သင်ကြားမှုတစ်ခုချင်းစီရဲ့ အချိန်နဲ့ အတည်ပြုမှုအခြေအနေကို ကြည့်ပါ။",
            role === "admin" &&
              button(
                <>
                  <Icon name="plus" /> Add class record
                </>,
                () => open("add-session"),
                true,
              ),
          )}
          <section className="card">
            <div className="toolbar">
              <input
                type="search"
                aria-label="Search records"
                placeholder="Search teacher, subject or record…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="Filter session status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  "Pending",
                  "Verified",
                  "Rejected",
                  "Missing checkout",
                  "In progress",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <span className="spacer" />
              <span className="mini-badge">
                {role === "admin" ? "All teachers" : t.name}
              </span>
            </div>
            {recordTable(rows)}
            <div className="table-foot">{rows.length} class records</div>
          </section>
        </>
      )}
      {page==='reviews'&&<>{head(role==='admin'&&reviewView==='sessions'?'TEACHING REVIEW':'REVIEW & CORRECTIONS',titles.reviews,role==='admin'&&reviewView==='sessions'?'Verify completed class records, or review time corrections.':role==='admin'?'အချိန်ပြင်ဆင်မှုနှင့် အတည်ပြုမှုအခြေအနေများ':'မိမိတောင်းဆိုမှုအခြေအနေနဲ့ Admin ရဲ့မှတ်ချက်ကို ကြည့်ပါ။')}{role==='admin'&&<ReviewNavigation view={reviewView} verify={verifyRows.length} corrections={pending.length} missing={d.sessions.filter(s=>status(s)==='Missing checkout').length} onView={setReviewView} onMissing={()=>navigate('sessions','Missing checkout')}/>}{role==='admin'&&reviewView==='sessions'?<section className="card"><div className="card-head"><h2>Ready to verify</h2><span className="mini-badge">{verifyRows.length} records</span></div>{verifyRows.length?recordTable(verifyRows):<EmptyState title="No records waiting for verification" text="Review corrections or missing checkout records if any remain." action={button('View all class records',()=>navigate('sessions'))}/>}</section>:<CorrectionCards tab={reviewTab.toLowerCase()} onTab={tab=>setReviewTab(tab[0].toUpperCase()+tab.slice(1))} rows={d.corrections.filter(c=>(reviewTab==='All'||c.status===reviewTab)&&(role==='admin'||store.session(c.session).teacher===teacherId)).map(c=>{const s=store.session(c.session),t=store.teacher(s.teacher);return {id:c.id,sessionId:s.id,teacher:{name:t.name,code:t.id,tone:t.tone},subject:cls(s.classId).subject,day:day(s.start),status:c.status,originalStart:s.originalStart,originalEnd:s.originalEnd,requestedStart:c.start,requestedEnd:c.end,reason:c.reason,comment:c.comment,actions:c.status==='Pending'?role==='admin'?<>{button(<><Icon name="check"/>Review request</>,()=>open('review',c.id),true)}{button('View session',()=>open('details',s.id))}</>:button('Withdraw request',()=>change(s=>s.withdraw(c.id),'Correction withdrawn.')):role==='admin'&&c.status==='Approved'&&s.status==='Pending'&&!store.pending(s)&&!store.locked(s)?button('Verify corrected record',()=>open('verify',s.id),true):button('View session',()=>open('details',s.id))};})}/>}</>}
      {page === "teachers" && (
        <>
          {head(
            "PEOPLE & PROFILES",
            "Teachers",
            "ဆရာအချက်အလက်၊ အတန်းသတ်မှတ်မှုနဲ့ hourly rate များကို စီမံပါ။",
            button(
              <>
                <Icon name="plus" />
                Add teacher
              </>,
              () => open("add-teacher"),
              true,
            ),
          )}
          <TeacherCards
            teachers={d.teachers.map((t) => ({
              id: t.id,
              code: t.id,
              name: t.name,
              email: t.email,
              active: t.active,
              subjects: t.assignments.map((id) => cls(id)?.subject ?? "Class"),
              rate:
                [...t.rates]
                  .sort((a, b) => b.from.localeCompare(a.from))
                  .find((r) => r.from <= date())?.rate ?? null,
              tone: t.tone,
            }))}
            onAction={(action, id) =>
              action === "profile"
                ? open("teacher", id)
                : open("confirm-teacher", id)
            }
          />
        </>
      )}
      {page === "classes" && (
        <>
          {head(
            "CLASSES & ASSIGNMENTS",
            "Classes & assignments",
            "ဆရာနဲ့ အတန်းချိတ်ဆက်မှုကို စီမံပါ။",
            button(
              <>
                <Icon name="plus" />
                Add class
              </>,
              () => open("add-class"),
              true,
            ),
          )}
          <ClassCards
            classes={d.classes.map((c) => ({
              id: c.id,
              code: c.id,
              name: c.name,
              subject: c.subject,
              active: c.active,
              teachers: d.teachers
                .filter((t) => t.assignments.includes(c.id))
                .map((t) => ({ id: t.id, name: t.name })),
            }))}
            onAction={(action, id) =>
              open(action === "assign" ? "class-assign" : "confirm-class", id)
            }
          />
        </>
      )}
      {page === "payroll" && (
        <PayrollScreen
          run={currentRun ? demoSnapshot(store, currentRun) : null}
          onAction={financeAction}
          toolbar={
            <form
              className="toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                calculate(String(data.get("from")), String(data.get("to")));
              }}
            >
              <label className="inline-filter">
                Period start
                <input
                  name="from"
                  type="date"
                  defaultValue={currentRun?.from ?? "2026-10-12"}
                  required
                />
              </label>
              <label className="inline-filter">
                Period end
                <input
                  name="to"
                  type="date"
                  defaultValue={currentRun?.to ?? "2026-10-18"}
                  required
                />
              </label>
              <button className="btn primary">Calculate draft</button>
              <span className="spacer" />
              <select
                aria-label="Select saved payroll"
                value={selectedRun === draft?.id ? "" : selectedRun}
                onChange={(e) => setSelectedRun(e.target.value)}
              >
                <option value="">Current draft</option>
                {d.runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.from} → {r.to} · {r.status} · {r.id.slice(-6)}
                  </option>
                ))}
              </select>
            </form>
          }
        />
      )}
      {page === "payments" && (
        <PaymentsScreen
          admin={role === "admin"}
          rows={paymentRows}
          stats={{
            periods: new Set(paymentRows.map((r) => r.runId)).size,
            approved_mmk: paymentRows.reduce((n, r) => n + r.net, 0),
            paid_mmk: paymentRows
              .filter((r) => r.payments.some((p) => !p.reversed))
              .reduce((n, r) => n + r.net, 0),
            unpaid_count: paymentRows.filter(
              (r) => !r.payments.some((p) => !p.reversed),
            ).length,
          }}
          runs={paymentRuns
            .filter((r) => allPaymentRows.some((row) => row.runId === r.id))
            .map((r) => ({ id: r.id, from: r.from, to: r.to }))}
          status={paymentStatus}
          period={paymentPeriod}
          onFilter={(status, period) => {
            setFilter(status);
            setPaymentPeriod(period);
          }}
          onAction={financeAction}
        />
      )}
      {page === "audit" && (
        <>
          {head(
            "WORKSPACE ACTIVITY",
            "Activity log",
            "မှတ်တမ်းပြောင်းလဲမှု၊ စစ်ဆေးမှုနဲ့ ငွေပေးချေမှု history။",
          )}
          <section className="card">
            <div className="card-head">
              <h2>Activity log</h2>
              <span className="mini-badge">{d.audit.length} events</span>
            </div>
            {d.audit.map((a) => (
              <div className="activity-item" key={a.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{a.action}</strong>
                  <p>
                    {a.detail}
                    <br />
                    {a.actor}
                  </p>
                </div>
                <time>
                  {day(a.at)} · {time(a.at)}
                </time>
              </div>
            ))}
          </section>
        </>
      )}
      {dialog}
      {toast && (
        <div className="prototype-toast" role="status">
          {toast}
        </div>
      )}
    </WorkspaceShell>
  );
}
function TeacherHome({
  store,
  teacherId,
  onCheckIn,
  onCheckout,
  onRequest,
  onReviews,
}: {
  store: Store;
  teacherId: string;
  onCheckIn: (id: string) => void;
  onCheckout: (id: string) => void;
  onRequest: (id: string) => void;
  onReviews: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const t = store.teacher(teacherId),
    blocker = store.checkInBlocker(teacherId),
    open =
      blocker ??
      store.data.sessions
        .filter((s) => s.teacher === teacherId && !s.end)
        .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0],
    correction = open && store.pending(open),
    overdue = open && status(open) === "Missing checkout";
  return (
    <TeacherToday
      blocked={Boolean(blocker)}
      active={t.active}
      current={
        open
          ? {
              name:
                store.data.classes.find((c) => c.id === open.classId)?.name ??
                "Class",
              start: open.start,
              correction: Boolean(correction),
              overdue: Boolean(overdue),
              action: (
                <button
                  className="btn primary"
                  onClick={() =>
                    correction
                      ? onReviews()
                      : overdue
                        ? onRequest(open.id)
                        : onCheckout(open.id)
                  }
                >
                  {correction
                    ? "View my correction"
                    : overdue
                      ? "Fix missing checkout"
                      : "Check out"}
                </button>
              ),
            }
          : undefined
      }
      classes={store.data.classes
        .filter((c) => c.active && t.assignments.includes(c.id))
        .map((c) => ({
          id: c.id,
          code: c.id,
          subject: c.subject,
          action: (
            <button
              className={"btn " + (!blocker && t.active ? "primary" : "")}
              disabled={Boolean(blocker) || !t.active}
              aria-label={"Check in to " + c.subject}
              aria-describedby="checkin-guidance"
              onClick={() => onCheckIn(c.id)}
            >
              <Icon name="plus" />
              Check in
            </button>
          ),
        }))}
      earlierCorrection={Boolean(
        open &&
          !correction &&
          store.data.sessions.some(
            (s) => s.teacher === teacherId && store.pending(s),
          ),
      )}
      correctionsLink={
        <button className="text-link" onClick={onReviews}>
          View my corrections
        </button>
      }
    />
  );
}
function DemoForm({
  modal,
  store,
  onSubmit,
}: {
  modal: Modal;
  store: Store;
  onSubmit: (data: FormData) => void;
}) {
  const session = modal.type === "request" ? store.session(modal.id!) : null,
    c =
      modal.type === "review"
        ? store.data.corrections.find((c) => c.id === modal.id)
        : null;
  const [teacher, setTeacher] = useState(
    store.data.teachers.find((t) => t.active && t.assignments.length)?.id ??
      store.data.teachers[0].id,
  );
  const field = (
    label: string,
    name: string,
    type = "text",
    value = "",
    required = true,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        step={type === "number" ? "1" : undefined}
      />
    </label>
  );
  const reason = (
    <label className="field">
      <span>Reason / Admin comment</span>
      <textarea
        name="reason"
        rows={3}
        required={!["verify", "review"].includes(modal.type)}
        maxLength={2000}
      />
    </label>
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      {modal.type === "request" && session && (
        <>
          <p className="record-note">
            Original record stays in your history. For an overnight class,
            choose the next date for the end.
          </p>
          <div className="form-grid">
            {field(
              "Correct start date",
              "startDate",
              "date",
              date(session.start),
            )}
            {field(
              "Correct start time",
              "startTime",
              "time",
              time(session.start),
            )}
            {field(
              "Correct end date",
              "endDate",
              "date",
              date(session.end ?? session.start),
            )}
            {field(
              "Correct end time",
              "endTime",
              "time",
              session.end ? time(session.end) : "",
            )}
          </div>
          {reason}
        </>
      )}
      {modal.type === "review" && c && (
        <>
          <p>{c.reason}</p>
          <div className="time-compare">
            <div className="time-box">
              <label>ORIGINAL</label>
              <strong>
                {time(store.session(c.session).originalStart)} →{" "}
                {time(store.session(c.session).originalEnd)}
              </strong>
            </div>
            <Icon name="arrow" />
            <div className="time-box new">
              <label>REQUESTED</label>
              <strong>
                {time(c.start)} → {time(c.end)}
              </strong>
            </div>
          </div>
          <label className="field">
            <span>Decision</span>
            <select name="decision">
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </label>
          {reason}
          <p className="record-note">
            An Admin comment is required when rejecting.
          </p>
        </>
      )}
      {modal.type === "verify" && (
        <>
          <p>
            {store.teacher(store.session(modal.id!).teacher).name} ·{" "}
            {time(store.session(modal.id!).start)} →{" "}
            {time(store.session(modal.id!).end)}
          </p>
          {store.session(modal.id!).flag && (
            <p className="notice">{store.session(modal.id!).flag}</p>
          )}
          <label className="field">
            <span>Review decision</span>
            <select name="decision">
              <option>Verified</option>
              <option>Rejected</option>
            </select>
          </label>
          {reason}
          <p className="record-note">
            A reason is required for rejection or exception resolution.
          </p>
        </>
      )}
      {modal.type === "add-session" && (
        <>
          <div className="form-grid">
            <label className="field">
              <span>Teacher</span>
              <select
                name="teacher"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              >
                {store.data.teachers
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Class</span>
              <select key={teacher} name="classId" required>
                {store.data.classes
                  .filter(
                    (c) =>
                      c.active &&
                      store.teacher(teacher).assignments.includes(c.id),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            {field("Start time", "start", "datetime-local", date() + "T09:00")}
            {field("End time", "end", "datetime-local", date() + "T10:00")}
          </div>
          {reason}
          <p className="admin-note">
            Saved as Pending verification. The teacher can see this entry.
          </p>
        </>
      )}
      {modal.type === "add-teacher" && (
        <>
          {field("Full name", "name")}
          {field("Email", "email", "email")}
          <div className="form-grid">
            {field("Hourly rate · MMK", "rate", "number", "10000")}
            {field("Effective from", "from", "date", date())}
          </div>
        </>
      )}
      {["add-teacher", "assign"].includes(modal.type) && (
        <fieldset className="assignment-picker">
          <legend>Assigned classes</legend>
          {store.data.classes
            .filter((c) => c.active)
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  name="classes"
                  value={c.id}
                  defaultChecked={
                    modal.id
                      ? store.teacher(modal.id).assignments.includes(c.id)
                      : false
                  }
                />
                <span>{c.name}</span>
              </label>
            ))}
        </fieldset>
      )}
      {modal.type === "assign" && reason}
      {modal.type === "rate" && (
        <>
          {store.teacher(modal.id!).rates.map((r) => (
            <div className="detail-row" key={r.from}>
              <span>{r.from}</span>
              <strong>{money(r.rate)} MMK / hour</strong>
            </div>
          ))}
          <div className="form-grid">
            {field("New hourly rate · MMK", "rate", "number", "10000")}
            {field("Effective from", "from", "date", date())}
          </div>
          {reason}
        </>
      )}
      {modal.type === "class-assign" && (
        <>
          <fieldset className="assignment-picker">
            <legend>Assigned teachers</legend>
            {store.data.teachers.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  name="teachers"
                  value={t.id}
                  defaultChecked={t.assignments.includes(modal.id!)}
                />
                <span>{t.name}</span>
              </label>
            ))}
          </fieldset>
          {reason}
        </>
      )}
      {modal.type === "add-class" && (
        <>
          {field("Class name", "name")}
          {field("Subject", "subject")}
        </>
      )}
      {modal.type === "adjust" && (
        <>
          {field("Signed adjustment · MMK", "amount", "number", "0")}
          {reason}
        </>
      )}
      {modal.type === "pay" && (
        <>
          <p>
            Record a full payment already made outside Saya-Sync. This action
            does not transfer money.
          </p>
          <label className="field">
            <span>Method</span>
            <select name="method">
              <option>Bank transfer</option>
              <option>Cash</option>
            </select>
          </label>
          {field("Actual paid date", "paidOn", "date", date())}
          {field("Reference or cash receipt note", "reference")}
        </>
      )}
      {["reverse", "void"].includes(modal.type) && (
        <>
          <p>
            {modal.type === "reverse"
              ? "The original payment stays in history. This action does not transfer money."
              : "The unpaid approved snapshot stays in history. Its session allocations are released."}
          </p>
          {reason}
        </>
      )}
      <FormActions>
        <button className="btn primary" type="submit">
          {{
            request: "Submit request",
            review: "Save review",
            verify: "Save verification",
            "add-session": "Save class record",
            "add-teacher": "Add teacher",
            "add-class": "Add class",
            "class-assign": "Save assignments",
            assign: "Save assigned classes",
            rate: "Save rate",
            adjust: "Save adjustment",
            pay: "Record payment",
            reverse: "Reverse payment record",
            void: "Void unpaid payroll",
          }[modal.type] ?? "Save changes"}
        </button>
      </FormActions>
    </form>
  );
}
