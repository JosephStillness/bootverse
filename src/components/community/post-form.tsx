"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  categories,
  postSchema,
  type PostInput,
} from "@/lib/community/validation";
import type { BootReference } from "@/lib/community/service";
import { PostMarkdown } from "./markdown";
type Fields = Partial<Record<keyof PostInput, string[]>>;
export function PostForm({
  boots,
  initial,
  editing,
}: {
  boots: BootReference[];
  initial?: PostInput;
  editing?: { slug: string; version: number };
}) {
  const router = useRouter();
  const [content, setContent] = useState(initial?.content ?? ""),
    [preview, setPreview] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [fields, setFields] = useState<Fields>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFields({});
    setMessage("");
    const form = new FormData(event.currentTarget);
    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const result = postSchema.safeParse({
      title: form.get("title"),
      sponsorship: form.get("sponsorship") || null,
      content: form.get("content"),
      categoryId: form.get("categoryId"),
      bootEntryId: form.get("bootEntryId") || null,
      tags,
    });
    if (!result.success) {
      setFields(result.error.flatten().fieldErrors);
      return;
    }
    setPending(true);
    try {
      const response = await fetch(
        editing
          ? `/api/community/posts/${editing.slug}`
          : "/api/community/posts",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...result.data,
            ...(editing && { version: editing.version }),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setFields(data.fields ?? {});
        setMessage(data.error ?? "Your post could not be saved.");
        return;
      }
      router.push(`/community/${data.post.slug}`);
      router.refresh();
    } catch {
      setMessage("Connection lost. Your draft is still here; try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="post-form" onSubmit={submit} method="post">
      <noscript>
        <p className="field-error">
          Enable JavaScript to preview and publish a post.
        </p>
      </noscript>
      <p className="field-help">Publish or save your post first, then add photos and creator videos on its detail page.</p>
      <div className="account-field">
        <label htmlFor="post-title">Title</label>
        <Input
          id="post-title"
          name="title"
          defaultValue={initial?.title}
          required
          minLength={5}
          maxLength={160}
          disabled={pending}
          aria-invalid={!!fields.title}
          aria-describedby="title-help title-error"
        />
        <p id="title-help" className="field-help">
          Be specific. 5–160 characters.
        </p>
        <p id="title-error" role="alert" className="field-error">
          {fields.title?.[0]}
        </p>
      </div>
      <label>Sponsor / paid partnership (optional)<Input name="sponsorship" defaultValue={initial?.sponsorship ?? ""} minLength={2} maxLength={120} disabled={pending} aria-describedby="sponsorship-error"/><span className="field-error" id="sponsorship-error" role="alert">{fields.sponsorship?.[0]}</span></label>
      <div className="post-form-grid">
        <div className="account-field">
          <label htmlFor="post-category">Category</label>
          <select
            id="post-category"
            name="categoryId"
            className="community-select"
            defaultValue={initial?.categoryId ?? "questions"}
            disabled={pending}
            aria-invalid={!!fields.categoryId}
            aria-describedby="category-error"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <p id="category-error" role="alert" className="field-error">
            {fields.categoryId?.[0]}
          </p>
        </div>
        <div className="account-field">
          <label htmlFor="post-boot">
            Link a boot{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <select
            id="post-boot"
            name="bootEntryId"
            className="community-select"
            defaultValue={initial?.bootEntryId ?? ""}
            disabled={pending}
            aria-invalid={!!fields.bootEntryId}
            aria-describedby="boot-help boot-error"
          >
            <option value="">No linked boot</option>
            {boots.map((boot) => (
              <option key={boot.id} value={boot.id}>
                {boot.label}
                {boot.sample ? " (sample)" : ""}
              </option>
            ))}
          </select>
          <p className="field-help" id="boot-help">
            Catalogue configurations are unverified samples. Select the exact
            tier, outsole and colorway.
          </p>
          <p id="boot-error" role="alert" className="field-error">
            {fields.bootEntryId?.[0]}
          </p>
        </div>
      </div>
      <div className="account-field">
        <label htmlFor="post-content">Your post</label>
        <textarea
          id="post-content"
          name="content"
          className="account-textarea post-editor"
          required
          minLength={20}
          maxLength={10000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={12}
          disabled={pending}
          aria-invalid={!!fields.content}
          aria-describedby="content-help content-error"
        />
        <p id="content-help" className="field-help">
          20–10,000 characters. Markdown supports headings, bold, lists and
          links. Raw HTML and Markdown images are disabled. Add photos after
          saving.
        </p>
        <p id="content-error" role="alert" className="field-error">
          {fields.content?.[0]}
        </p>
        <Button
          variant="outline"
          type="button"
          aria-expanded={preview}
          aria-controls="markdown-preview"
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Hide preview" : "Preview Markdown"}
        </Button>
        {preview && (
          <div id="markdown-preview" className="post-preview">
            <h3>Preview</h3>
            {content ? (
              <PostMarkdown content={content} />
            ) : (
              <p className="field-help">Start writing to see a preview.</p>
            )}
          </div>
        )}
      </div>
      <div className="account-field">
        <label htmlFor="post-tags">
          Tags{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="post-tags"
          name="tags"
          defaultValue={initial?.tags.join(", ")}
          maxLength={130}
          disabled={pending}
          aria-invalid={!!fields.tags}
          aria-describedby="tags-help tags-error"
        />
        <p id="tags-help" className="field-help">
          Up to 5 comma-separated tags. Use letters, numbers and hyphens; 24
          characters per tag.
        </p>
        <p id="tags-error" role="alert" className="field-error">
          {fields.tags?.[0]}
        </p>
      </div>
      <p role="alert" className="field-error">
        {message}
      </p>
      <p className="field-help">
        Share your own experience. Community opinions and technical claims are
        unverified. Avoid publishing personal contact details.
      </p>
      <div className="account-actions">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Publish post"}
        </Button>
        <Link
          href={editing ? `/community/${editing.slug}` : "/community"}
          className="text-link"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
