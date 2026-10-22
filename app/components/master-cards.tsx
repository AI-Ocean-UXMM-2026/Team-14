"use client";
import Icon from "./ui-icon";
import { Badge, EmptyState } from "./prototype-ui";
export type TeacherCardData = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  active: boolean;
  subjects: string[];
  rate: number | null;
  tone?: number;
};
export type ClassCardData = {
  id: string;
  code: string;
  name: string;
  subject: string;
  active: boolean;
  teachers: { id: string; name: string }[];
};
export function TeacherCards({
  teachers,
  onAction,
}: {
  teachers: TeacherCardData[];
  onAction: (action: string, id: string) => void;
}) {
  return (
    <section className="teacher-grid">
      {teachers.map((t, i) => (
        <article className="card teacher-card" key={t.id}>
          <header>
            <span
              className={"avatar tone-" + ((t.tone ?? i) % 5)}
              aria-hidden="true"
            >
              {t.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <Badge label={t.active ? "Active" : "Inactive"} />
          </header>
          <h2>{t.name}</h2>
          <p>
            {t.email ?? "No email on profile"}
            <br />
            {t.code} · {t.subjects.join(" / ") || "No classes assigned"}
          </p>
          <div className="rate">
            <span>Current hourly rate</span>
            <strong>
              {t.rate === null ? "—" : t.rate.toLocaleString("en-US")}{" "}
              <small>MMK/hr</small>
            </strong>
          </div>
          <div className="card-actions">
            <button
              className="btn primary small"
              onClick={() => onAction("profile", t.id)}
            >
              Profile &amp; rates
            </button>
            <button
              className="btn small"
              onClick={() => onAction("active", t.id)}
            >
              {t.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </article>
      ))}
      {!teachers.length && (
        <div className="card">
          <EmptyState
            title="No matching teachers"
            text="Try another search or add a teacher."
          />
        </div>
      )}
    </section>
  );
}
export function ClassCards({
  classes,
  onAction,
}: {
  classes: ClassCardData[];
  onAction: (action: string, id: string) => void;
}) {
  return (
    <section className="teacher-grid">
      {classes.map((c) => (
        <article className="card teacher-card" key={c.id}>
          <header>
            <span className="class-glyph">
              <Icon name="classes" />
            </span>
            <Badge label={c.active ? "Active" : "Inactive"} />
          </header>
          <h2>{c.name}</h2>
          <p>
            {c.code} · {c.subject}
          </p>
          <hr className="divider" />
          <div className="eyebrow">ASSIGNED TEACHERS</div>
          {c.teachers.map((t, i) => (
            <div className="person class-teacher" key={t.id}>
              <span className={"avatar tone-" + (i % 5)} aria-hidden="true">
                {t.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <strong>{t.name}</strong>
            </div>
          ))}
          {!c.teachers.length && <p>No teachers assigned yet.</p>}
          <div className="card-actions">
            <button
              className="btn small icon-only"
              aria-label={"Edit assignments for " + c.name}
              onClick={() => onAction("assign", c.id)}
            >
              <Icon name="edit" />
            </button>
            <button
              className="btn small"
              onClick={() => onAction("active", c.id)}
            >
              {c.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </article>
      ))}
      {!classes.length && (
        <div className="card">
          <EmptyState
            title="No classes yet"
            text="Add a class, then assign teachers."
          />
        </div>
      )}
    </section>
  );
}
