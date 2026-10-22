"use client";
import { useEffect, useState } from "react";
import WorkspaceShell from "../components/workspace-shell";
import Dialog from "../components/dialog";
import Icon from "../components/ui-icon";
import Activity from "../components/teaching-activity";
import ClassRecordsTable from "../components/class-records-table";
import ReviewSummary from "../components/review-summary";
import {CorrectionCards,ReviewNavigation} from "../components/correction-cards";
import {EmptyState} from "../components/prototype-ui";
import SaveNotice from "../components/save-notice";
import TeacherToday from "../components/teacher-today";
import {
  PageHeading,
  StatCard,
  Person,
  Badge,
} from "../components/prototype-ui";
import type {
  WorkspaceStats,
  WorkspacePaging,
  ActivityDay,
} from "@/lib/domain/workspace";
import { useRouter } from "next/navigation";
import ElapsedClock from "../components/elapsed-clock";
import MutationForm from "./mutation-form";
import { yangonInput } from "@/lib/domain/datetime";
import { logout } from "../login/actions";
type Session = {
  id: string;
  teacher_id: string;
  class_id: string;
  original_start: string;
  original_end: string | null;
  effective_start: string;
  effective_end: string | null;
  capture_status: string;
  verification: string;
  source: string;
  version: number;
  entry_reason?: string | null;
};
type Correction = {
  id: string;
  session_id: string;
  proposed_start: string;
  proposed_end: string;
  reason: string;
  status: string;
  decision_reason: string | null;
};
type Exception = {
  id: string;
  session_id: string;
  flag: string;
  resolved_at: string | null;
  resolution_reason: string | null;
};
type Review = {
  id: string;
  session_id: string;
  reviewed_version: number;
  result: string;
  reason: string | null;
  created_at: string;
};
export type Props = {
  initialDetail?: string;
  stats: WorkspaceStats;
  activity: ActivityDay[];
  paging: WorkspacePaging;
  role: "admin" | "teacher";
  view: string;
  sessions: Session[];
  teachers: { id: string; name: string; code: string; active: boolean }[];
  classes: {
    id: string;
    code: string;
    name: string | null;
    subject: string;
    active: boolean;
  }[];
  assignments: {
    id: string;
    teacher_id: string;
    class_id: string;
    request_key: string;
  }[];
  corrections: Correction[];
  exceptions: Exception[];
  allocations: { session_id: string }[];
  reviews: Review[];
};
export default function RecordsClient(p: Props) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const admin = p.role === "admin",
    page = ["overview", "home", "sessions", "reviews"].includes(p.view)
      ? p.view
      : admin
        ? "overview"
        : "home";
  const router = useRouter();
 const [notice,setNotice]=useState("");const saved=(message:string)=>{setModal(null);setNotice(message);};
  const [query, setQuery] = useState(p.paging.query),
    [filter, setFilter] = useState(p.paging.status),


    [modal, setModal] = useState<{
      type: string;
      id: string;
      key: string;
    } | null>(null);
  const reviewView=p.paging.review,reviewTab=p.paging.tab;
  useEffect(()=>{if(document.activeElement?.getAttribute("aria-label")!=="Search records")setQuery(p.paging.query);setFilter(p.paging.status);},[p.paging.query,p.paging.status]);
  const go = (values: Record<string, string>) => {
    const search = new URLSearchParams({
      view: page,
      q: query,
      status: filter,
      review: reviewView,
      tab: reviewTab,
      ...values,
    });
    search.delete("offset");
    if (values.offset) search.set("offset", values.offset);
    router.push("/workspace?" + search);
  };
  useEffect(()=>{if(page!=='sessions'||query===p.paging.query)return;const timer=setTimeout(()=>go({q:query}),300);return()=>clearTimeout(timer);},[query,p.paging.query,page]);
  const setReviewView = (review: string) => go({ review }),
    setReviewTab = (tab: string) => go({ tab });
  const open = (type: string, id: string) =>
    setModal({ type, id, key: crypto.randomUUID() });
  useEffect(() => {
    if (p.initialDetail && p.sessions.some((s) => s.id === p.initialDetail))
      setModal({
        type: "details",
        id: p.initialDetail,
        key: crypto.randomUUID(),
      });
  }, [p.initialDetail]);
  const name = (id: string) =>
      p.teachers.find((t) => t.id === id)?.name ?? "Teacher",
    cls = (id: string) => p.classes.find((c) => c.id === id),
    pending = (id: string) =>
      p.corrections.find((c) => c.session_id === id && c.status === "pending"),
    locked = (id: string) => p.allocations.some((a) => a.session_id === id);
  const day = (v: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Yangon",
      day: "2-digit",
      month: "short",
    }).format(new Date(v));
  const time = (v: string | null) =>
    v
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Yangon",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(v))
      : "—";
  const mins = (s: Session) =>
    s.effective_end
      ? Math.floor(
          (Date.parse(s.effective_end) - Date.parse(s.effective_start)) / 60000,
        )
      : 0;
  const status = (s: Session) =>
    !s.effective_end
      ? s.capture_status === "correction_hold" ||
        yangonInput(s.effective_start).slice(0, 10) <
          yangonInput(new Date(now || Date.now()).toISOString()).slice(0, 10)
        ? "Missing checkout"
        : "In progress"
      : s.verification[0].toUpperCase() + s.verification.slice(1);
  const person = (id: string) => (
    <Person
      name={name(id)}
      code={p.teachers.find((t) => t.id === id)?.code ?? id.slice(0, 8)}
      tone={Math.max(
        0,
        p.teachers.findIndex((t) => t.id === id),
      )}
    />
  );
  const badge = (value: string) => (
    <Badge label={value[0].toUpperCase() + value.slice(1)} />
  );
  const verify = p.sessions.filter(
      (s) =>
        s.effective_end &&
        s.verification === "pending" &&
        !pending(s.id) &&
        !locked(s.id),
    ),
    corrections = p.corrections.filter((c) => c.status === "pending");
  const table = (sessions: Session[], compact = false) => (
    <ClassRecordsTable
      rows={sessions.map((s) => ({
        id: s.id,
        teacher: {
          name: name(s.teacher_id),
          code:
            p.teachers.find((t) => t.id === s.teacher_id)?.code ??
            s.teacher_id.slice(0, 8),
          tone: p.teachers.findIndex((t) => t.id === s.teacher_id),
        },
        subject: cls(s.class_id)?.subject ?? "Class",
 classLabel:cls(s.class_id)?.code,
        start: s.effective_start,
        end: s.effective_end,
        minutes: mins(s),
        status: status(s),
        pending: Boolean(pending(s.id)),
        actions: (
          <>
            <button className="btn small" onClick={() => open("details", s.id)}>
              Details
            </button>
            {!compact &&
              (locked(s.id) ? (
                <span className="record-note">
                  Included in approved payroll
                </span>
              ) : pending(s.id) ? (
                admin ? (
                  <button
                    className="btn small"
                    onClick={() => open("review", pending(s.id)!.id)}
                  >
                    Review correction
                  </button>
                ) : (
                  <a className="text-link" href="/workspace?view=reviews">
                    View correction
                  </a>
                )
              ) : admin && s.effective_end && s.verification !== "verified" ? (
                <button
                  className="btn primary small"
                  onClick={() => open("verify", s.id)}
                >
                  Verify record
                </button>
              ) : !s.effective_end && status(s) === "Missing checkout" ? (
                <button
                  className="btn small"
                  onClick={() => open("request", s.id)}
                >
                  Fix checkout
                </button>
              ) : null)}
          </>
        ),
      }))}
    />
  );
  const rows = p.sessions.filter((s) => p.paging.record_ids.includes(s.id));
  const current =
      p.sessions.find((s) => s.capture_status === "in_progress") ??
      p.sessions.find((s) => !s.effective_end),
    currentCorrection = current && pending(current.id),
    running =
      current && !currentCorrection && status(current) === "In progress";
  const blocked = p.sessions.some(
    (s) =>
      !s.effective_end &&
      (!pending(s.id) ||
        Date.parse(pending(s.id)!.proposed_end) > (now || Date.now())),
  );
  const head = (title: string, eyebrow: string, subtitle: string,add=true) => (
    <PageHeading
      {...{ title, eyebrow, subtitle }}
      actions={
        admin&&add ? (
          <>
            <span className="mini-badge">All teaching records</span>
            <button
              className="btn primary"
              onClick={() => open("add-session", "")}
            >
              <Icon name="plus" />
              Add class record
            </button>
          </>
        ) : !admin ? (
          <span className="mini-badge">
            {p.teachers[0]?.name} · {p.teachers[0]?.code}
          </span>
        ) : undefined
      }
    />
  );
  const pagination = (
    <div className="table-foot pagination">
      <span>
        {p.paging.total === 0 ? 0 : p.paging.offset + 1}–
        {Math.min(p.paging.offset + p.paging.limit, p.paging.total)} of{" "}
        {p.paging.total} records
      </span>
      <button
        className="btn small"
        disabled={!p.paging.offset}
        onClick={() =>
          go({ offset: String(Math.max(0, p.paging.offset - p.paging.limit)) })
        }
      >
        Previous
      </button>
      <button
        className="btn small"
        disabled={p.paging.offset + p.paging.limit >= p.paging.total}
        onClick={() => go({ offset: String(p.paging.offset + p.paging.limit) })}
      >
        Next
      </button>
    </div>
  );
  let chosen = modal && p.sessions.find((s) => s.id === modal.id);
  const correction =
    modal?.type === "review"
      ? p.corrections.find((c) => c.id === modal.id)
      : undefined;
  if (correction)
    chosen = p.sessions.find((s) => s.id === correction.session_id);
  const titles: Record<string, string> = {
    overview: "Overview",
    home: "Today & check-in",
    sessions: admin ? "Class records" : "My class records",
    reviews: admin ? "Review inbox" : "My corrections",
  };
  return (
    <WorkspaceShell
      role={p.role}
      page={page}
      title={titles[page]}
      name={p.teachers[0]?.name}
      count={p.stats.correction_count + (admin ? p.stats.verify_count : 0)}
      signOut={
        <form action={logout}>
          <button className="btn small">Sign out</button>
        </form>
      }
    >
      <SaveNotice message={notice} onDismiss={()=>setNotice("")}/>
      {page === "overview" && (
        <>
          {head(
            "Academy overview",
            "YOUR ACADEMY AT A GLANCE",
            "သင်ကြားမှုမှတ်တမ်း၊ စစ်ဆေးမှုနဲ့ ဆရာကြေး — တစ်နေရာတည်းမှာ။",
          )}
          <section className="stats-grid">
            <StatCard
              label="Active teachers"
              value={p.stats.active_teachers}
              unit="teachers"
              note={"Across " + p.stats.active_classes + " active classes"}
              icon="teachers"
            />
            <StatCard
              label="Payroll-ready hours"
              value={(p.stats.eligible_minutes / 60).toFixed(2)}
              unit="hours"
              note="Verified & not yet allocated"
              icon="clock"
            />
            <StatCard
              label="Needs your review"
              value={p.stats.verify_count}
              unit="records"
              note={p.stats.correction_count + " pending corrections"}
              icon="reviews"
              warm
            />
            <StatCard
              label="Eligible payroll"
              value={p.stats.eligible_mmk.toLocaleString("en-US")}
              unit="MMK"
              note="Verified sessions only"
              icon="payments"
            />
          </section>
          <div className="two-col">
            <Activity activity={p.activity} />
            <ReviewSummary
              verify={p.stats.verify_count}
              corrections={p.stats.correction_count}
              missing={p.stats.missing_count}
              onNavigate={(view) =>
                router.push(
                  view === "missing"
                    ? "/workspace?view=sessions&status=Missing+checkout"
                    : view === "verify"
                      ? "/workspace?view=reviews&review=sessions"
                      : "/workspace?view=reviews",
                )
              }
            />
          </div>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Recent class records</h2>
                <p className="subtext">Every class has a clear record.</p>
              </div>
              <a className="text-link" href="/workspace?view=sessions">
                View all records →
              </a>
            </div>
            {table(p.sessions.slice(0, 5), true)}
          </section>
        </>
      )}
      {page === "home" && (
        <>
          {head(
            "မင်္ဂလာပါ " + (p.teachers[0]?.name.split(" ")[0] ?? "Teacher"),
            "TEACHER WORKSPACE",
            "Your teaching time, records and payment status.",
          )}
          <TeacherToday
            blocked={blocked}
            active={p.teachers[0]?.active}
            current={
              current
                ? {
                    name:
                      cls(current.class_id)?.name ??
                      cls(current.class_id)?.subject ??
                      "Class",
                    start: current.effective_start,
                    correction: Boolean(currentCorrection),
                    overdue: status(current) === "Missing checkout",
                    action: currentCorrection ? (
                      <a className="btn primary" href="/workspace?view=reviews">
                        View my correction
                      </a>
                    ) : running ? (
                      <MutationForm
                        onSaved={saved}
                        key={p.assignments[0]?.request_key ?? current.id}
                        operation="check_out"
                        entity={current.id}
                        version={current.version}
                        requestKey={p.assignments[0]?.request_key ?? current.id}
                        label="Check out"
                      />
                    ) : (
                      <button
                        className="btn primary"
                        onClick={() => open("request", current.id)}
                      >
                        Fix missing checkout
                      </button>
                    ),
                  }
                : undefined
            }
            classes={p.assignments
              .filter(
                (a) =>
                  p.teachers.some((t) => t.id === a.teacher_id && t.active) &&
                  cls(a.class_id)?.active,
              )
              .map((a) => ({
                id: a.id,
                code: cls(a.class_id)!.code,
                subject: cls(a.class_id)!.subject,
 status:current?.class_id===a.class_id?(currentCorrection?"Correction pending":running?"In progress":"Missing checkout"):undefined,
                action: (
                  <MutationForm
                    onSaved={saved}
                    key={a.request_key}
                    operation="check_in"
                    ariaLabel={"Check in to "+cls(a.class_id)!.subject}
                    entity={a.id}
                    requestKey={a.request_key}
                    label="Check in"
                    disabled={blocked}
                  />
                ),
              }))}
            earlierCorrection={Boolean(
              current && !currentCorrection && corrections.length,
            )}
            correctionsLink={
              <a href="/workspace?view=reviews">View my corrections</a>
            }
          />
          <section className="stats-grid">
            <StatCard
              label="My class records"
              value={p.stats.record_count}
              unit="classes"
              note="Your teaching history"
              icon="sessions"
            />
            <StatCard
              label="Verified hours"
              value={(p.stats.verified_minutes / 60).toFixed(2)}
              unit="hours"
              note="Admin-reviewed records"
              icon="clock"
            />
            <StatCard
              label="Pending corrections"
              value={p.stats.correction_count}
              unit="requests"
              note="View My corrections"
              icon="reviews"
              warm
            />
            <StatCard
              label="Awaiting payment"
              value={p.stats.awaiting_mmk.toLocaleString("en-US")}
              unit="MMK"
              note="Approved and not yet paid"
              icon="payments"
            />
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Your recent classes</h2><a className="text-link" href="/workspace?view=sessions">All my records <Icon name="arrow"/></a>
            </div>
            {table(p.sessions.slice(0, 5))}
          </section>
        </>
      )}
      {page === "sessions" && (
        <>
          {head(
            titles.sessions,
            admin ? "CLASS MANAGEMENT" : "MY TEACHING HISTORY",
            "သင်ကြားမှုတစ်ခုချင်းစီရဲ့ အချိန်နဲ့ အတည်ပြုမှုအခြေအနေကို ကြည့်ပါ။",
          )}
          <section className="card">
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                go({});
              }}
            >
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
                onChange={(e) => {
                  setFilter(e.target.value);
                  go({ status: e.target.value });
                }}
              >
                <option value="">All statuses</option>
                {[
                  "Pending",
                  "Verified",
                  "Rejected",
                  "Missing checkout",
                  "In progress",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>

            </form>
            {table(rows)}
            {pagination}
          </section>
        </>
      )}
      {page==='reviews'&&<>{head(titles.reviews,admin&&reviewView==='sessions'?'TEACHING REVIEW':'REVIEW & CORRECTIONS',admin&&reviewView==='sessions'?'Verify completed class records, or review time corrections.':admin?'အချိန်ပြင်ဆင်မှုနှင့် အတည်ပြုမှုအခြေအနေများ':'မိမိတောင်းဆိုမှုအခြေအနေနဲ့ Admin ရဲ့မှတ်ချက်ကို ကြည့်ပါ။',false)}{admin&&<ReviewNavigation view={reviewView} verify={p.stats.verify_count} corrections={p.stats.correction_count} missing={p.stats.missing_count} onView={setReviewView} onMissing={()=>router.push('/workspace?view=sessions&status=Missing+checkout')}/>}{admin&&reviewView==='sessions'?<section className="card"><div className="card-head"><h2>Ready to verify</h2><span className="mini-badge">{p.stats.verify_count} records</span></div>{verify.length?table(verify):<EmptyState title="No records waiting for verification" text="Review corrections or missing checkout records if any remain." action={<a className="btn small" href="/workspace?view=sessions">View all class records</a>}/>} {pagination}</section>:<CorrectionCards tab={reviewTab} onTab={setReviewTab} pagination={pagination} rows={p.corrections.filter(c=>p.paging.record_ids.includes(c.session_id)&&(reviewTab==='all'||c.status===reviewTab)).map(c=>{const s=p.sessions.find(s=>s.id===c.session_id)!;return {id:c.id,sessionId:s.id,teacher:{name:name(s.teacher_id),code:p.teachers.find(t=>t.id===s.teacher_id)?.code??s.teacher_id.slice(0,8)},subject:cls(s.class_id)?.subject??'Class',day:day(s.effective_start),status:c.status[0].toUpperCase()+c.status.slice(1),originalStart:s.original_start,originalEnd:s.original_end,requestedStart:c.proposed_start,requestedEnd:c.proposed_end,reason:c.reason,comment:c.decision_reason,actions:c.status==='pending'?admin?<><button className="btn primary small" onClick={()=>open('review',c.id)}><Icon name="check"/>Review request</button><button className="btn small" onClick={()=>open('details',s.id)}>View session</button></>:<MutationForm onSaved={saved} operation="withdraw_correction" entity={c.id} version={s.version} requestKey={c.id} label="Withdraw request"/>:admin&&c.status==='approved'&&s.verification==='pending'&&!pending(s.id)&&!locked(s.id)?<button className="btn primary small" onClick={()=>open('verify',s.id)}>Verify corrected record</button>:<button className="btn small" onClick={()=>open('details',s.id)}>View session</button>};})}/>}</>}
      {modal && (
        <Dialog
          key={modal.type + modal.id}
          title={
            {
              details: "Class record details",
              request: "Request a time correction",
              verify: "Verify class record",
              review: "Review time correction",
              "add-session": "Add a completed class",
              resolve: "Resolve session exception",
            }[modal.type] ?? "Workspace"
          }
          onClose={() => setModal(null)}
        >
          {chosen && (
            <>
              <div className="flex items-center justify-between">
                {person(chosen.teacher_id)}
                {badge(status(chosen))}
              </div>
              <div className="info-grid">
                <div>
                  <small>Class / date</small>
                  <strong>
                    {cls(chosen.class_id)?.subject} ·{" "}
                    {day(chosen.effective_start)}
                  </strong>
                </div>
                <div>
                  <small>Effective teaching time</small>
                  <strong>
                    {time(chosen.effective_start)} →{" "}
                    {time(chosen.effective_end)}
                  </strong>
                </div>
                <div>
                  <small>Original time</small>
                  <strong>
                    {time(chosen.original_start)} → {time(chosen.original_end)}
                  </strong>
                </div>
                <div>
                  <small>Duration / source</small>
                  <strong>
                    {mins(chosen)} min ·{" "}
                    {chosen.source === "admin"
                      ? "Admin entry"
                      : "Teacher check-in"}
                  </strong>
                </div>
              </div>
              <details className="record-reference"><summary>Record reference</summary><code>{chosen.id}</code></details>
{chosen.entry_reason && (
                <p className="request-reason">{chosen.entry_reason}</p>
              )}
              {locked(chosen.id) && (
                <p className="notice">
                  This record is locked in approved payroll. Contact your
                  administrator about a later adjustment.
                </p>
              )}
            </>
          )}
          {modal.type === "details" && chosen && (
            <>
              {p.exceptions
                .filter((e) => e.session_id === chosen!.id)
                .map((e) => (
                  <div className="notice" key={e.id}>
                    {e.flag.replaceAll("_", " ")} ·{" "}
                    {e.resolved_at
                      ? e.resolution_reason
                      : "Awaiting Admin review"}
                    {admin && !e.resolved_at && !locked(chosen!.id) && (
                      <MutationForm
                        onSaved={saved}
                        operation="resolve_exception"
                        entity={e.id}
                        version={chosen!.version}
                        requestKey={modal.key}
                        label="Resolve exception"
                        reason
                        reasonRequired
                      />
                    )}
                  </div>
                ))}
              {p.corrections
                .filter((c) => c.session_id === chosen!.id)
                .map((c) => (
                  <div className="history-item" key={c.id}>
                    {badge(c.status)}
                    <p>
                      {time(c.proposed_start)} → {time(c.proposed_end)} ·{" "}
                      {c.reason}
                    </p>
                    {c.decision_reason && <p>Admin: {c.decision_reason}</p>}
                  </div>
                ))}
              {p.reviews
                .filter((r) => r.session_id === chosen!.id)
                .map((r) => (
                  <p className="history-item" key={r.id}>
                    {r.result} · {day(r.created_at)} · {r.reason}
                  </p>
                ))}
              <div className="form-actions">
                {!locked(chosen.id) && !pending(chosen.id) && (
                  <button
                    className="btn"
                    onClick={() => open("request", chosen!.id)}
                  >
                    Request correction
                  </button>
                )}
                {admin &&
                  chosen.effective_end &&
                  !locked(chosen.id) &&
                  !pending(chosen.id) && (
                    <button
                      className="btn primary"
                      onClick={() => open("verify", chosen!.id)}
                    >
                      Review & verify
                    </button>
                  )}
              </div>
            </>
          )}
          {modal.type === "request" && chosen && (
            <>
              <p className="record-note">
                Enter the actual dates and times. Original records stay in
                history.
              </p>
              <MutationForm
                onSaved={saved}
                operation="request_correction"
                entity={chosen.id}
                version={chosen.version}
                requestKey={modal.key}
                label="Submit request"
                dates
                start={yangonInput(chosen.effective_start)}
                end={
                  chosen.effective_end ? yangonInput(chosen.effective_end) : ""
                }
                reason
                reasonRequired
              />
            </>
          )}
          {modal.type === "verify" && chosen && (
            <>
              <p className="record-note">
                A reason is required when rejecting or resolving an exception.
              </p>
              <MutationForm
                onSaved={saved}
                operation="verify_session"
 reasonRequired={p.exceptions.some(e=>e.session_id===chosen!.id&&!e.resolved_at)}
                entity={chosen.id}
                version={chosen.version}
                requestKey={modal.key}
                label="Save verification"
                decisions={["verified", "rejected"]}
                reason
              />
            </>
          )}
          {modal.type === "review" && chosen && correction && (
            <>
              <p className="request-reason">{correction.reason}</p>
              <div className="time-compare">
                <div className="time-box">
                  <label>ORIGINAL</label>
                  <strong>
                    {time(chosen.original_start)} → {time(chosen.original_end)}
                  </strong>
                </div>
                <Icon name="arrow" />
                <div className="time-box new">
                  <label>REQUESTED</label>
                  <strong>
                    {time(correction.proposed_start)} →{" "}
                    {time(correction.proposed_end)}
                  </strong>
                </div>
              </div>
              <MutationForm
                onSaved={saved}
                operation="review_correction"
                entity={correction.id}
                version={chosen.version}
                requestKey={modal.key}
                label="Save review"
                decisions={["approved", "rejected"]}
                reason
              />
              <details>
                <summary>Withdraw a stale pending request</summary>
                <MutationForm
                  onSaved={saved}
                  operation="withdraw_correction"
                  entity={correction.id}
                  version={chosen.version}
                  requestKey={modal.key}
                  label="Withdraw pending request"
                />
              </details>
            </>
          )}
          {modal.type === "add-session" &&
          p.teachers.length > 0 &&
          p.classes.length > 0 ? (
            <MutationForm
              onSaved={saved}
              operation="create_admin_session"
 start={yangonInput(new Date().toISOString()).slice(0,10)+"T09:00"} end={yangonInput(new Date().toISOString()).slice(0,10)+"T10:00"}
              assignments={p.assignments}
              entity={
                (
                  p.teachers.find(
                    (t) =>
                      t.active &&
                      p.assignments.some((a) => a.teacher_id === t.id),
                  ) ?? p.teachers[0]
                ).id
              }
              teachers={p.teachers
                .filter((t) => t.active)
                .map((t) => ({ id: t.id, label: t.name }))}
              classes={p.classes
                .filter((c) => c.active)
                .map((c) => ({ id: c.id, label: c.code + " · " + c.subject }))}
              requestKey={modal.key}
              dates
              reason
              reasonRequired
              label="Save class record"
            />
          ) : (
            modal.type === "add-session" && (
              <p>
                Add an active teacher, class and assignment before recording a
                lesson.
              </p>
            )
          )}
        </Dialog>
      )}
    </WorkspaceShell>
  );
}
