"use client";
import Icon from "./ui-icon";
import ElapsedClock from "./elapsed-clock";
import { WorkflowHelp } from "./prototype-ui";
export default function TeacherToday({
  current,
  blocked,
  active = true,
  classes,
  earlierCorrection,
  correctionsLink,
}: {
  current?: {
    name: string;
    start: string;
    correction: boolean;
    overdue: boolean;
    action: React.ReactNode;
  };
  blocked: boolean;
  active?: boolean;
  classes: {
    id: string;
    code: string;
    subject: string;
    status?: string;
    action: React.ReactNode;
  }[];
  earlierCorrection?: boolean;
  correctionsLink: React.ReactNode;
}) {
  const day = (v: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Yangon",
      day: "2-digit",
      month: "short",
    }).format(new Date(v));
  const time = (v: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Yangon",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(v));
  const running = current && !current.correction && !current.overdue;
  const guidance = !active
    ? "Your account is inactive. Contact your administrator."
    : blocked
      ? current?.correction
        ? "Your requested end time has not passed. Check the correction before checking in."
        : current?.overdue
          ? "Add the actual end time for your previous class to enable check-in."
          : "Check out of your active class before starting another."
      : "Select the class you are teaching.";
  return (
    <>
      <section className="teaching-layout">
        <section
          className={"clock-card " + (running ? "is-running" : "")}
          aria-label="Class timer"
        >
          <div className="timer-status">
            <span className="timer-dot" aria-hidden="true" />
            <span>
              {current?.correction
                ? "Correction pending"
                : current?.overdue
                  ? "Missing checkout"
                  : current
                    ? "Teaching in progress"
                    : "Ready to teach"}
            </span>
          </div>
          <h2>{current?.name ?? "Your next class"}</h2>
          {current ? (
            <>
              {running ? (
                <div className="timer-reading">
                  <span className="timer-reading-label">Time elapsed</span>
                  <ElapsedClock start={current.start} />
                </div>
              ) : (
                <p className="timer-guidance">
                  {current.correction
                    ? blocked
                      ? "Your correction is awaiting review. Check the requested end time if you need to start a new class."
                      : "Your correction is awaiting review. You can check in to your next class."
                    : "Add the actual end date and time to complete this record."}
                </p>
              )}
              <p className="record-note">
                Checked in {day(current.start)} at {time(current.start)}
              </p>
              <div className="timer-actions">{current.action}</div>
            </>
          ) : (
            <>
              <p className="idle-clock-label">Current time</p>
              <ElapsedClock />
              <p className="record-note">Choose a class to check in.</p>
            </>
          )}
        </section>
        <section className="card assigned-classes">
          <div className="card-head">
            <div>
              <h2>Your assigned classes</h2>
              <p className="subtext" id="checkin-guidance">
                {guidance}
              </p>
            </div>
            <Icon name="classes" />
          </div>
          {classes.map((c) => (
            <div className="class-option" key={c.id}>
              <span className="class-glyph">
                <Icon name="classes" />
              </span>
              <div>
                <h3>{c.subject}</h3>
                <p>{c.code}{c.status&&<span className="class-live-status"> · {c.status}</span>}</p>
              </div>
              {c.action}
            </div>
          ))}
          {!classes.length && (
            <div className="empty">
              <h3>No assigned classes</h3>
              <p>
                Contact your administrator to assign a class before checking in.
              </p>
            </div>
          )}
        </section>
      </section>
      {earlierCorrection && (
        <p className="notice">
          An earlier time correction is awaiting review. {correctionsLink}
        </p>
      )}
      <WorkflowHelp />
    </>
  );
}
