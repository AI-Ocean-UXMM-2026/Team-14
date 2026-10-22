import Icon from "./ui-icon";
export default function ReviewSummary({
  verify,
  corrections,
  missing,
  onNavigate,
}: {
  verify: number;
  corrections: number;
  missing: number;
  onNavigate: (view: string) => void;
}) {
  return (
    <div className="card review-summary">
      <div className="card-head">
        <div>
          <h2>Needs your review</h2>
          <p className="subtext">Resolve these items before payroll</p>
        </div>
        <Icon name="reviews" />
      </div>
      {[
        {
          name: "Class records to verify",
          text: "စစ်ဆေးရန် ကျန်ရှိသောမှတ်တမ်းများ",
          count: verify,
          view: "verify",
          action: "Verify records",
          icon: "sessions",
        },
        {
          name: "Time correction requests",
          text: "ဆရာများရဲ့ အချိန်ပြင်ဆင်ရန် တောင်းဆိုမှု",
          count: corrections,
          view: "corrections",
          action: "Review corrections",
          icon: "clock",
        },
        {
          name: "Missing checkout",
          text: "Checkout မပါသေးတဲ့ အတန်းမှတ်တမ်း",
          count: missing,
          view: "missing",
          action: "Fix missing checkout",
          icon: "alert",
        },
      ].map((item) => (
        <div className="review-row" key={item.view}>
          <span className="review-symbol">
            <Icon name={item.icon} />
          </span>
          <div>
            <strong>{item.name}</strong>
            <p lang="my">{item.text}</p>
            <button className="text-link" onClick={() => onNavigate(item.view)}>
              {item.action} <Icon name="arrow" />
            </button>
          </div>
          <span className="number">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
