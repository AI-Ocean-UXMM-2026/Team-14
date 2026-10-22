import {schoolDate} from "@/lib/domain/display";
import { Person, Badge, ScrollTable, EmptyState } from "./prototype-ui";
export type ClassRecordRow = {
  id: string;
  teacher: { name: string; code: string; tone?: number };
  subject: string;
  classLabel?:string;
  start: string;
  end: string | null;
  minutes: number;
  status: string;
  pending: boolean;
  actions: React.ReactNode;
};
export default function ClassRecordsTable({
  rows,
}: {
  rows: ClassRecordRow[];
}) {
  const time = (v: string | null) =>
    v
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Yangon",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(v))
      : "—";
  return (
    <>
      <ScrollTable
        headings={[
          "Teacher",
          "Class / subject",
          "Date",
          "Teaching time",
          "Duration",
          "Status",
          "Actions",
        ]}
      >
        {rows.map((s) => (
          <tr key={s.id} data-record-id={s.id}>
            <td>
              <Person {...s.teacher} />
            </td>
            <td>
              <strong>{s.subject}</strong>
              <div className="record-note">{/^[0-9a-f]{8}-/i.test(s.id)?s.classLabel??"Class record":s.id}</div>
            </td>
            <td>{schoolDate(s.start)}</td>
            <td>
              {time(s.start)} <span className="muted">→</span>{" "}
              {time(s.end)}
            </td>
            <td>{s.end ? s.minutes + " min" : "—"}</td>
            <td>
              <Badge label={s.status} />
              {s.pending && (
                <div className="record-note">Correction pending</div>
              )}
            </td>
            <td>
              <div className="row-actions">{s.actions}</div>
            </td>
          </tr>
        ))}
      </ScrollTable>
      {!rows.length && (
        <EmptyState
          title="No matching class records"
          text="Try another filter or choose a different class."
        />
      )}
    </>
  );
}
