"use client";
import SaveNotice from "@/app/components/save-notice";
import { useState } from "react";
import WorkspaceShell from "@/app/components/workspace-shell";
import Dialog from "@/app/components/dialog";
import { TeacherCards, ClassCards } from "@/app/components/master-cards";
import { PageHeading, Person } from "@/app/components/prototype-ui";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/ui-icon";
import { logout } from "@/app/login/actions";
import MasterForm from "./master-form";
type Teacher = {
  id: string;
  name: string;
  code: string;
  email: string | null;
  active: boolean;
  version: number;
  membership_id: string | null;
};
type Class = {
  id: string;
  name: string | null;
  code: string;
  subject: string;
  active: boolean;
  version: number;
};
type Rate = {
  id: string;
  teacher_id: string;
  starts_at: string;
  ends_at: string | null;
  hourly_mmk: number;
  reason: string;
};
type Assignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  starts_at: string;
  ends_at: string | null;
  reason: string;
};
type Audit = {
  id: string;
  action: string;
  entity_id: string;
  created_at: string;
  actor_id: string;
  actor_name: string;
  entity_name: string;
  reason: string;
};
export default function ManageClient({
  view,
  teachers,
  classes,
  rates,
  assignments,
  audit,
  today,
  nav_count=0,
  audit_total,
  offset,
}: {
  nav_count?:number;
  audit_total: number;
  offset: number;
  view: string;
  teachers: Teacher[];
  classes: Class[];
  rates: Rate[];
  assignments: Assignment[];
  audit: Audit[];
  today: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<{
      op: string;
      id: string;
      key: string;
    } | null>(null),
    [query, setQuery] = useState("");
  const open = (op: string, id = "") =>
    setModal({ op, id, key: crypto.randomUUID() });
  const teacher = teachers.find((t) => t.id === modal?.id),
    cls = classes.find((c) => c.id === modal?.id),
    titles: Record<string, string> = {
      teachers: "Teachers",
      classes: "Classes & assignments",
      audit: "Activity log",
    };
  const currentAssignments = (id: string) =>
    assignments.filter(
      (a) =>
        a.teacher_id === id &&
        Date.parse(a.starts_at) <= Date.now() &&
        (!a.ends_at || Date.parse(a.ends_at) > Date.now()),
    );
  const person = (t: Teacher) => (
    <Person name={t.name} code={t.code} tone={teachers.indexOf(t)} />
  );
  const saved = (message:string) => {
    setModal(null);
    setNotice(message);
    router.refresh();
  };
  return (
    <WorkspaceShell
      role="admin" count={nav_count}
      page={view}
      title={titles[view]}
      signOut={
        <form action={logout}>
          <button className="btn small">Sign out</button>
        </form>
      }
    >
      <SaveNotice message={notice} onDismiss={()=>setNotice("")}/>
      <PageHeading
        eyebrow={
          view === "teachers"
            ? "PEOPLE & PROFILES"
            : view === "classes"
              ? "CLASSES & ASSIGNMENTS"
              : "WORKSPACE ACTIVITY"
        }
        title={titles[view]}
        subtitle={
          view === "teachers"
            ? "ဆရာအချက်အလက်၊ အတန်းသတ်မှတ်မှုနဲ့ hourly rate များကို စီမံပါ။"
            : view === "classes"
              ? "ဆရာနဲ့ အတန်းချိတ်ဆက်မှုကို စီမံပါ။"
              : "မှတ်တမ်းပြောင်းလဲမှု၊ စစ်ဆေးမှုနဲ့ ငွေပေးချေမှု history။"
        }
        actions={
          view !== "audit" && (
            <button
              className="btn primary"
              onClick={() =>
                open(view === "teachers" ? "create_teacher" : "create_class")
              }
            >
              <Icon name="plus" />
              Add {view === "teachers" ? "teacher" : "class"}
            </button>
          )
        }
      />
      {view === "teachers" && (
        <>
          <div className="toolbar">
            <input
              type="search"
              placeholder="Search teachers…"
              aria-label="Search teachers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <TeacherCards
            teachers={teachers
              .filter((t) =>
                (t.name + " " + t.code)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((t) => ({
                id: t.id,
                code: t.code,
                name: t.name,
                email: t.email,
                active: t.active,
                subjects: currentAssignments(t.id).map(
                  (a) =>
                    classes.find((c) => c.id === a.class_id)?.subject ??
                    "Class",
                ),
                rate:
                  rates.find(
                    (r) =>
                      r.teacher_id === t.id &&
                      Date.parse(r.starts_at) <= Date.now() &&
                      (!r.ends_at || Date.parse(r.ends_at) > Date.now()),
                  )?.hourly_mmk ?? null,
                tone: teachers.indexOf(t),
              }))}
            onAction={(action, id) =>
              open(action === "profile" ? "profile" : "set_teacher_active", id)
            }
          />
        </>
      )}
      {view === "classes" && (
        <ClassCards
          classes={classes.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name ?? c.subject,
            subject: c.subject,
            active: c.active,
            teachers: teachers
              .filter((t) =>
                currentAssignments(t.id).some((a) => a.class_id === c.id),
              )
              .map((t) => ({ id: t.id, name: t.name })),
          }))}
          onAction={(action, id) =>
            open(
              action === "assign"
                ? "set_class_assignments"
                : "set_class_active",
              id,
            )
          }
        />
      )}
      {view === "audit" && (
        <section className="card">
          <div className="card-head">
            <h2>Activity log</h2>
            <span className="mini-badge">{audit_total} events</span>
          </div>
          {audit.map((a) => (
            <div className="activity-item" key={a.id}>
              <span className="activity-dot" />
              <div>
                <strong>{a.action.replaceAll("_", " ")}</strong>
                <p>
                  {a.entity_name} · {a.actor_name}
                  {a.reason && (
                    <>
                      <br />
                      {a.reason}
                    </>
                  )}
                </p>
              </div>
              <time>
                {new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Yangon",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(a.created_at))}
              </time>
            </div>
          ))}
          <div className="table-foot pagination">
            <span>
              {audit_total ? offset + 1 : 0}–
              {Math.min(offset + 50, audit_total)} of {audit_total} events
            </span>
            <a
              className="btn small"
              aria-disabled={!offset}
              href={
                "/workspace/manage?view=audit&offset=" +
                Math.max(0, offset - 50)
              }
            >
              Previous
            </a>
            {offset + 50 < audit_total && (
              <a
                className="btn small"
                href={"/workspace/manage?view=audit&offset=" + (offset + 50)}
              >
                Next
              </a>
            )}
          </div>
          {audit.length === 0 && (
            <div className="empty">
              <h3>No activity yet</h3>
            </div>
          )}
        </section>
      )}
      {modal && (
        <Dialog
          key={modal.op + modal.id}
          title={
            {
              create_teacher: "Welcome a teacher",
              create_class: "Add class",
              set_teacher_assignments: "Assign classes",
              profile: "Teacher profile & rates",
              set_class_assignments: "Assign teachers",
              set_teacher_rate: "Update hourly rate",
              link_teacher_account: "Link invited Teacher account",
            }[modal.op] ?? "Change active status"
          }
          onClose={() => setModal(null)}
        >
          {teacher && <div className="mb-4">{person(teacher)}</div>}
          {modal.op === "profile" && teacher && (
            <>
              <p className="request-reason">
                {teacher.email}
                <br />
                {currentAssignments(teacher.id)
                  .map((a) => classes.find((c) => c.id === a.class_id)?.subject)
                  .join(" · ") || "No classes assigned"}
              </p>
              <div className="next-step">
                <button
                  className="btn small"
                  onClick={() => open("set_teacher_assignments", teacher.id)}
                >
                  Assign classes
                </button>
                <a
                  className="btn small"
                  href={
                    "/workspace?view=sessions&q=" +
                    encodeURIComponent(teacher.name)
                  }
                >
                  View class records
                </a>
                <button
                  className="btn small"
                  onClick={() => open("link_teacher_account", teacher.id)}
                >
                  {teacher.membership_id
                    ? "Account linked"
                    : "Link invited account"}
                </button>
              </div>
              <div className="eyebrow">HOURLY RATE HISTORY</div>
            </>
          )}
          {["profile", "set_teacher_rate"].includes(modal.op) &&
            rates
              .filter((r) => r.teacher_id === modal.id)
              .map((r) => (
                <div className="detail-row" key={r.id}>
                  <span>
                    {new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Asia/Yangon",
                    }).format(new Date(r.starts_at))}
                  </span>
                  <strong>{r.hourly_mmk.toLocaleString()} MMK / hour</strong>
                </div>
              ))}
          <MasterForm
            onSaved={saved}
            teachers={teachers.map((t) => ({ id: t.id, label: t.name }))}
            expectedTeachers={
              modal.op === "set_class_assignments"
                ? teachers
                    .filter((t) =>
                      currentAssignments(t.id).some(
                        (a) => a.class_id === modal.id,
                      ),
                    )
                    .map((t) => t.id)
                : undefined
            }
            operation={modal.op === "profile" ? "set_teacher_rate" : modal.op}
            entity={modal.id}
            version={teacher?.version ?? cls?.version}
            requestKey={modal.key}
            classes={classes
              .filter((c) => c.active)
              .map((c) => ({ id: c.id, label: c.name ?? c.subject }))}
            assigned={
              modal.op === "set_class_assignments"
                ? teachers
                    .filter((t) =>
                      currentAssignments(t.id).some(
                        (a) => a.class_id === modal.id,
                      ),
                    )
                    .map((t) => t.id)
                : currentAssignments(modal.id).map((a) => a.class_id)
            }
            active={teacher?.active ?? cls?.active}
            today={today}
          />
        </Dialog>
      )}
    </WorkspaceShell>
  );
}
