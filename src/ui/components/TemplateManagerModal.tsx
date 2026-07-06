import { useEffect, useState } from "react";
import type { PageTemplate } from "../../vault/types";

type TemplateDraft = Pick<PageTemplate, "name" | "description" | "kind" | "body">;

const emptyDraft: TemplateDraft = {
  name: "",
  description: "",
  kind: "",
  body: "# {{title}}\n\n"
};

export default function TemplateManagerModal({
  isOpen,
  templates,
  onClose,
  onCreate,
  onUpdate,
  onDuplicate,
  onDelete
}: {
  isOpen: boolean;
  templates: PageTemplate[];
  onClose: () => void;
  onCreate: (draft: TemplateDraft) => Promise<void> | void;
  onUpdate: (templateId: string, draft: TemplateDraft) => Promise<void> | void;
  onDuplicate: (template: PageTemplate) => Promise<void> | void;
  onDelete: (templateId: string) => Promise<void> | void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const activeTemplate = templates.find((template) => template.id === activeId) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const first = templates[0] ?? null;
    setActiveId(first?.id ?? null);
    setDraft(
      first
        ? {
            name: first.name,
            description: first.description,
            kind: first.kind,
            body: first.body
          }
        : emptyDraft
    );
  }, [isOpen, templates]);

  if (!isOpen) return null;

  const selectTemplate = (templateId: string | null) => {
    setActiveId(templateId);
    const template = templates.find((entry) => entry.id === templateId);
    setDraft(
      template
        ? {
            name: template.name,
            description: template.description,
            kind: template.kind,
            body: template.body
          }
        : emptyDraft
    );
  };

  const save = async () => {
    if (activeTemplate) {
      await onUpdate(activeTemplate.id, draft);
    } else {
      await onCreate(draft);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-page-edge bg-parchment shadow-page">
        <div className="flex items-center justify-between border-b border-page-edge p-4">
          <div>
            <div className="font-display text-xl">Template Manager</div>
            <div className="text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              Campaign templates
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-page-edge px-3 py-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
          >
            Close
          </button>
        </div>
        <div className="grid max-h-[calc(90vh-5rem)] gap-0 overflow-hidden md:grid-cols-[16rem_1fr]">
          <div className="overflow-y-auto border-b border-page-edge p-4 md:border-b-0 md:border-r">
            <button
              type="button"
              onClick={() => selectTemplate(null)}
              className={`mb-3 w-full rounded-xl border border-page-edge px-3 py-2 text-left text-sm ${
                activeId === null ? "bg-parchment/80 text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              New Template
            </button>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template.id)}
                  className={`block w-full rounded-xl border border-page-edge px-3 py-2 text-left text-sm ${
                    template.id === activeId
                      ? "bg-parchment/80 text-ink"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  <div className="font-display">{template.name}</div>
                  {template.kind && (
                    <div className="text-[11px] font-ui uppercase tracking-[0.14em]">
                      {template.kind}
                    </div>
                  )}
                </button>
              ))}
              {templates.length === 0 && (
                <p className="marginal-note">No user templates yet.</p>
              )}
            </div>
          </div>
          <div className="overflow-y-auto p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                Name
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-body text-ink"
                />
              </label>
              <label className="space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
                Kind
                <input
                  value={draft.kind}
                  onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}
                  placeholder="npc, faction, location..."
                  className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-body text-ink"
                />
              </label>
            </div>
            <label className="mt-3 block space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              Description
              <input
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm font-body text-ink"
              />
            </label>
            <label className="mt-3 block space-y-1 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft">
              Markdown Body
              <textarea
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                rows={18}
                className="w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 font-mono text-sm text-ink"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-ink-soft">
                Use {"{{title}}"} in the body to insert the page title later.
              </div>
              <div className="flex gap-2">
                {activeTemplate && (
                  <>
                    <button
                      type="button"
                      onClick={() => onDuplicate(activeTemplate)}
                      className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(activeTemplate.id)}
                      className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={save}
                  className="rounded-full border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ink-soft hover:text-ember"
                >
                  {activeTemplate ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
