"use client";

const STEPS = ["Voice note", "Interview", "Draft", "Schedule"];

type Props = {
  // Index of the current step. -1 means the flow has not started yet.
  active: number;
};

// Shows where the founder is in the flow: voice note, interview, draft,
// then schedule. Steps before the current one read as done.
export default function StepIndicator({ active }: Props) {
  return (
    <ol
      className="mb-6 flex items-center gap-1 sm:gap-2"
      aria-label="Your progress"
    >
      {STEPS.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                current
                  ? "bg-brass text-white"
                  : done
                    ? "bg-ink text-white"
                    : "bg-stone-200 text-stone-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`truncate text-xs font-medium sm:text-sm ${
                current ? "text-ink" : "text-stone-500"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px min-w-2 flex-1 ${
                  done ? "bg-ink" : "bg-stone-300"
                }`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
