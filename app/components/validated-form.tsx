"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormHTMLAttributes,
  type ReactNode,
  type ReactElement,
} from "react";
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Props = FormHTMLAttributes<HTMLFormElement> & {
  serverError?: string;
  submitting?: boolean;
  validate?: (data: FormData) => Record<string, string>;
};
function labelText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number")
        return String(child);
      if (
        !isValidElement(child) ||
        ["input", "select", "textarea", "button"].includes(String(child.type))
      )
        return "";
      return labelText((child.props as { children?: ReactNode }).children);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
function invalidMessage(control: Control) {
  if (
    control.required &&
    control.type !== "checkbox" &&
    control.type !== "radio" &&
    control.type !== "password" &&
    !control.value.trim()
  )
    return "This field is required.";
  if (control.validity.valid) return "";
  if (control.validity.valueMissing)
    return control.type === "checkbox"
      ? "Confirm this before continuing."
      : "This field is required.";
  if (control.validity.typeMismatch && control.type === "email")
    return "Enter a valid email address.";
  return control.validationMessage;
}
export default function ValidatedForm({
  children,
  serverError,
  submitting = false,
  validate,
  onSubmit,
  onInputCapture,
  ...props
}: Props) {
  const prefix = useId(),
    summary = useRef<HTMLDivElement>(null),
    [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (serverError && !submitting) summary.current?.focus();
  }, [serverError, submitting]);
  const decorate = (nodes: ReactNode, parentLabel = "", path = ""): ReactNode =>
    Children.map(nodes, (child, index) => {
      if (!isValidElement(child)) return child;
      const element = child as ReactElement<Record<string, any>>,
        p = element.props,
        key = path + "-" + index,
        label = child.type === "label" ? labelText(p.children) : parentLabel;
      if (
        ["input", "select", "textarea"].includes(String(child.type)) &&
        p.type !== "hidden"
      ) {
        const field = p.name || p.id || key,
          id = prefix + "-" + field.replace(/[^a-zA-Z0-9_-]/g, "-"),
          message = errors[field];
        return (
          <>
            {cloneElement(element, {
              "data-validation-field": field,
              "aria-label": p["aria-label"] || label || undefined,
              "aria-invalid": message ? true : undefined,
              "aria-describedby":
                [p["aria-describedby"], message ? id : undefined]
                  .filter(Boolean)
                  .join(" ") || undefined,
            })}
            {message && (
              <span id={id} className="field-error" aria-hidden="true">
                {message}
              </span>
            )}
          </>
        );
      }
      return p.children
        ? cloneElement(element, {}, decorate(p.children, label, key))
        : child;
    });
  return (
    <form
      {...props}
      noValidate
      aria-busy={submitting}
      onSubmit={(event) => {
        const form = event.currentTarget,
          next: Record<string, string> = {};
        let first: Control | undefined;
        for (const element of Array.from(form.elements)) {
          if (!("willValidate" in element)) continue;
          const control = element as Control;
          if (!control.willValidate) continue;
          const message = invalidMessage(control);
          if (message) {
            next[control.dataset.validationField!] = message;
            first ??= control;
          }
        }
        Object.assign(next, validate?.(new FormData(form)) ?? {});
        setErrors(next);
        if (Object.keys(next).length) {
          event.preventDefault();
          first ??= Array.from(form.elements).find(
            (e) => e instanceof HTMLElement && next[e.dataset.validationField!],
          ) as Control | undefined;
          requestAnimationFrame(() => first?.focus());
          return;
        }
        onSubmit?.(event);
      }}
      onInputCapture={(event) => {
        const form = event.currentTarget;
        if (Object.keys(errors).length)
          requestAnimationFrame(() => {
            const extra = validate?.(new FormData(form)) ?? {};
            setErrors((previous) => {
              const next = { ...previous };
              for (const element of Array.from(form.elements)) {
                if (!("willValidate" in element)) continue;
                const control = element as Control,
                  field = control.dataset.validationField;
                if (field && field in next) {
                  const message = invalidMessage(control) || extra[field];
                  if (message) next[field] = message;
                  else delete next[field];
                }
              }
              return next;
            });
          });
        onInputCapture?.(event);
      }}
    >
      {(Object.keys(errors).length > 0 || (serverError && !submitting)) && (
        <div
          ref={summary}
          tabIndex={-1}
          className="inline-error form-validation-summary"
          role="alert"
        >
          {serverError && !submitting && !Object.keys(errors).length
            ? serverError
            : "Check the highlighted fields below."}
        </div>
      )}
      {decorate(children)}
    </form>
  );
}
