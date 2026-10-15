"use client";
import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  criteria,
  footShapes,
  widthObservations,
  reviewSchema,
  type ReviewInput,
} from "@/lib/reviews/validation";
export function ReviewForm({
  variantId,
  initial,
  editing,
}: {
  variantId: string;
  initial?: ReviewInput;
  editing?: { id: string; version: number };
}) {
  const router = useRouter(),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [fields, setFields] = useState<Record<string, string[] | undefined>>({});
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    setFields({});
    setMessage("");
    const f = new FormData(e.currentTarget);
    const number = (key: string) =>
      f.get(key) === "" || f.get(key) === null ? null : Number(f.get(key));
    const data: Record<string, unknown> = {
      variantId,
      shareFootInfo: f.get("shareFootInfo") === "on",
    };
    for (const key of Object.keys(reviewSchema.shape)) {
      if (key === "variantId" || key === "shareFootInfo") continue;
      data[key] = [
        ...Object.keys(criteria),
        "ownershipMonths",
        "matchesPlayed",
        "footLengthCm",
        "footWidthCm",
        "purchasePrice",
      ].includes(key)
        ? number(key)
        : f.get(key) || null;
    }
    const parsed = reviewSchema.safeParse(data);
    if (!parsed.success) {
      setFields(parsed.error.flatten().fieldErrors);
      setMessage("Check the highlighted fields.");
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch(
        editing ? `/api/reviews/${editing.id}` : "/api/reviews",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...parsed.data,
            ...(editing ? { version: editing.version } : {}),
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        setFields(body.fields ?? {});
        setMessage(body.error ?? "Unable to save review.");
        return;
      }
      router.push(`/reviews/${body.review.id}?saved=1`);
      router.refresh();
    } catch {
      setMessage("Connection lost. Your draft is still here.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function error(key: string) {
    return (
      <p id={`${key}-error`} className="field-error" role="alert">
        {fields[key]?.[0]}
      </p>
    );
  }
  function input(
    key: keyof ReviewInput,
    label: string,
    type = "text",
    required = false,
    min?: number,
    max?: number,
    step?: number,
  ) {
    return (
      <div className="account-field">
        <label htmlFor={key}>{label}</label>
        <Input
          id={key}
          name={key}
          type={type}
          required={required}
          min={min}
          max={max}
          step={step}
          defaultValue={String(initial?.[key] ?? "")}
          maxLength={key === "sponsorship" ? 120 : key === "position" ? 50 : key === "currency" ? 3 : 12}
          aria-invalid={!!fields[key]}
          aria-describedby={`${key}-error`}
        />
        {error(key)}
      </div>
    );
  }
  function select(
    key: keyof ReviewInput,
    label: string,
    options: readonly string[],
    required = false,
  ) {
    return (
      <div className="account-field">
        <label htmlFor={key}>{label}</label>
        <select
          className="community-select"
          id={key}
          name={key}
          defaultValue={String(initial?.[key] ?? "")}
          required={required}
          aria-invalid={!!fields[key]}
          aria-describedby={`${key}-error`}
        >
          {!required && <option value="">Not shared / unknown</option>}
          {options.map((x) => (
            <option key={x} value={x}>
              {x.replaceAll("-", " ")}
            </option>
          ))}
        </select>
        {error(key)}
      </div>
    );
  }
  function textarea(
    key: keyof ReviewInput,
    label: string,
    required = false,
    max = 300,
    min = 1,
  ) {
    return (
      <div className="account-field">
        <label htmlFor={key}>{label}</label>
        <textarea
          id={key}
          name={key}
          className="account-textarea"
          rows={required ? 4 : 2}
          required={required}
          minLength={min}
          maxLength={max}
          defaultValue={String(initial?.[key] ?? "")}
          aria-invalid={!!fields[key]}
          aria-describedby={`${key}-error`}
        />
        {error(key)}
      </div>
    );
  }
  return (
    <form method="post" onSubmit={submit} className="post-form">
      <noscript>Enable JavaScript to submit a review.</noscript>
      <fieldset disabled={pending} className="review-form-fields">
        <legend className="sr-only">Review details</legend>
        <p className="field-help">
          One review per exact variant. Ownership and opinions are
          self-reported. Use your actual experience; catalogue configurations
          are unverified samples. Add photos and creator videos after saving.
        </p>
        <div className="post-form-grid">
          {input("sizeWorn", "Boot size worn", "text", true)}
          {select("sizeSystem", "Size system", ["UK", "US", "EU", "CM"], true)}
          {input(
            "ownershipMonths",
            "Ownership (whole months)",
            "number",
            true,
            0,
            600,
            1,
          )}
          {input(
            "matchesPlayed",
            "Approximate matches played",
            "number",
            true,
            0,
            10000,
            1,
          )}
        </div>
        <section>
          <h2>Your ratings</h2>
          <p className="field-help">
            1 = very poor, 5 = excellent. Overall is the equal-weight mean of
            all six.
          </p>
          <div className="rating-fields">
            {Object.entries(criteria).map(([key, label]) => (
              <fieldset
                className="rating-field"
                key={key}
                aria-describedby={`${key}-error`}
              >
                <legend>{label}</legend>
                <div className="star-options">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n}>
                      <input
                        type="radio"
                        name={key}
                        value={n}
                        defaultChecked={
                          initial?.[key as keyof typeof criteria] === n
                        }
                        required
                        aria-label={`${label}: ${n} of 5`}
                      />
                      <span aria-hidden="true">★</span>
                      <span className="sr-only">{n} of 5</span>
                    </label>
                  ))}
                </div>
                {error(key)}
              </fieldset>
            ))}
          </div>
        </section>
        {textarea(
          "experience",
          "Overall experience (40–5,000 characters)",
          true,
          5000,
          40,
        )}
        {input("sponsorship", "Sponsor / paid partnership (optional)")}
        <div className="post-form-grid">
          {textarea("pros", "Pros", true, 1500, 3)}
          {textarea("cons", "Cons", true, 1500, 3)}
        </div>
        <details
          className="review-optional"
          open={
            !!fields.footLengthCm ||
            !!fields.footWidthCm ||
            !!fields.footShape ||
            !!fields.shareFootInfo
          }
        >
          <summary>Optional foot information & privacy</summary>
          <p className="field-help">
            Private by default. Shared foot information is visible to everyone
            and may appear in filters. Do not put private measurements into your
            written review.
          </p>
          <div className="post-form-grid">
            {input(
              "footLengthCm",
              "Foot length (cm)",
              "number",
              false,
              10,
              40,
              0.1,
            )}
            {input(
              "footWidthCm",
              "Foot width (cm)",
              "number",
              false,
              3,
              20,
              0.1,
            )}
            {select("footShape", "Self-reported foot shape", footShapes)}
          </div>
          <label className="review-consent">
            <input
              type="checkbox"
              name="shareFootInfo"
              defaultChecked={initial?.shareFootInfo ?? false}
            />{" "}
            I consent to publicly displaying my optional foot length, width and
            shape.
          </label>
          {error("shareFootInfo")}
        </details>
        <details
          className="review-optional"
          open={
            !!fields.position ||
            !!fields.playingSurface ||
            !!fields.widthObservation ||
            !!fields.toeRoom ||
            !!fields.midfootPressure ||
            !!fields.heelLockdown ||
            !!fields.breakIn ||
            !!fields.sizingAdvice
          }
        >
          <summary>Optional playing context & fit observations</summary>
          <p className="field-help">
            Subjective observations, not measured shoe dimensions or verified
            fit advice.
          </p>
          <div className="post-form-grid">
            {input("position", "Playing position")}
            {select("playingSurface", "Typical playing surface", [
              "FG",
              "AG",
              "TF",
              "SG",
              "IN",
              "OTHER",
            ])}
            {select("widthObservation", "Width experience", widthObservations)}
          </div>
          {textarea("toeRoom", "Toe room")}
          {textarea("midfootPressure", "Midfoot pressure")}
          {textarea("heelLockdown", "Heel lockdown")}
          {textarea("breakIn", "Break-in experience")}
          {textarea("sizingAdvice", "Sizing advice from your experience")}
        </details>
        <details
          className="review-optional"
          open={!!fields.purchasePrice || !!fields.currency}
        >
          <summary>Optional purchase context</summary>
          <p className="field-help">
            Self-reported purchase price, not a current catalogue price. Provide
            both fields.
          </p>
          <div className="post-form-grid">
            {input(
              "purchasePrice",
              "Price paid",
              "number",
              false,
              0,
              99999999.99,
              0.01,
            )}
            {input("currency", "Currency code (e.g. GBP)")}
          </div>
        </details>
        <p role="alert" className="field-error">
          {message}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Publish review"}
        </Button>
      </fieldset>
    </form>
  );
}
