import React, { useEffect, useRef, useState } from 'react';

/**
 * A numeric text input that behaves the way a number field should.
 *
 * ITEM 25. The fields were wired as
 *
 *     <input value={inputs.x} onChange={(e) => update('x', parseFloat(e.target.value) || 75)} />
 *
 * which fails in three ways:
 *
 *   1. IT COULD NOT BE CLEARED. parseFloat('') is NaN, NaN is falsy, so the `|| 75`
 *      fallback fired the instant the field was emptied and the box snapped back
 *      to 75. The user could not select-all and delete.
 *   2. TYPING APPENDED. Clearing was impossible, but even a partial entry like "7"
 *      committed immediately and re-rendered the value as "75", so typing "80"
 *      produced "758". The committed value was echoed back into the field mid-edit.
 *   3. OUT-OF-RANGE TEXT WAS INVISIBLE. Typing 758 committed 758, the engine
 *      silently clamped it, and the field still displayed 758. The number on
 *      screen was not the number being used.
 *
 * The fix is a controlled draft. The field keeps its own string while it is being
 * edited and only commits under defined conditions:
 *
 *   - a valid parse, while typing          -> commit, so the results update live
 *   - Enter                               -> commit and stop editing
 *   - blur, valid and in range             -> commit
 *   - blur, empty or unparseable           -> REVERT to the last valid value
 *   - blur, valid but out of range         -> SNAP to the nearest bound and say so
 *
 * The out-of-range note matters. The engine clamps every input internally and
 * records the substitution, but a user who types 758 and sees 758 has no way to
 * know 150 is what was used. Showing "adjusted to 150" closes that gap at the
 * point of entry rather than leaving the user to notice a check later.
 */
export interface NumericFieldProps {
  /**
   * Current committed value. Optional because several DryerInputs fields are
   * declared optional; the component falls back to `fallback` when it is
   * undefined or non-finite.
   */
  value: number | undefined;
  /** Inclusive lower bound. */
  min?: number;
  /** Inclusive upper bound. */
  max?: number;
  /** Value used when the input is blank and nothing valid has been entered. */
  fallback?: number;
  /** `type` attribute. Kept as number for spinner semantics, but the draft is a string. */
  step?: number;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  /** Called with a new committed value. */
  onCommit: (value: number) => void;
}

export const NumericField: React.FC<NumericFieldProps> = ({
  value,
  onCommit,
  min,
  max,
  fallback,
  step,
  id,
  name,
  disabled,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}) => {
  // An absent or non-finite incoming value falls back, so the field always has a
  // coherent committed state to revert to. Several DryerInputs fields are optional
  // and can legitimately arrive as undefined.
  const resolved = Number.isFinite(value) ? (value as number) : (fallback ?? 0);

  // The draft is the source of truth for what the box shows; `resolved` is the
  // source of truth for what the engine uses. They are deliberately separate.
  const [draft, setDraft] = useState<string>(String(resolved));
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Tracks the last value we ourselves committed, so a re-render driven by the
  // parent does not stomp on a draft the user is still editing.
  const committedRef = useRef(resolved);
  // Set when this component initiated a commit. The parent's re-render then arrives
  // as a `resolved` change indistinguishable from an external one, and the sync
  // effect below would clear the "adjusted to X" note the user needs to see. This
  // flag lets the effect adopt the value while leaving the note alone.
  const selfCommittedRef = useRef(false);

  // Adopt an externally changed value, but only when the user is not mid-edit.
  // Without the editing guard, every keystroke that committed a valid prefix
  // would reformat the field and fight the caret.
  useEffect(() => {
    if (!editing) {
      setDraft(String(resolved));
      committedRef.current = resolved;
      if (selfCommittedRef.current) {
        // Our own commit coming back around. Keep the note; it is the only place
        // the user learns their entry was adjusted.
        selfCommittedRef.current = false;
      } else {
        setNote(null);
      }
    }
  }, [resolved, editing]);

  const clamp = (n: number): number => {
    let out = n;
    if (typeof min === 'number' && out < min) out = min;
    if (typeof max === 'number' && out > max) out = max;
    return out;
  };

  const inRange = (n: number): boolean =>
    (typeof min !== 'number' || n >= min) && (typeof max !== 'number' || n <= max);

  const commit = (raw: string, opts: { fromBlur: boolean }) => {
    const text = raw.trim();

    // Empty or unparseable on blur: revert rather than committing NaN or a
    // silent default. The user asked for nothing, so nothing changes.
    if (text === '' || !Number.isFinite(Number(text))) {
      if (opts.fromBlur) {
        setDraft(String(committedRef.current));
        setNote(null);
        setEditing(false);
      }
      return;
    }

    const parsed = Number(text);
    const snapped = clamp(parsed);
    const wasOutOfRange = snapped !== parsed;

    setDraft(String(snapped));
    setEditing(false);

    if (wasOutOfRange) {
      // Tell the user, at the point of entry, what was actually used.
      setNote(`adjusted to ${snapped}`);
    } else {
      setNote(null);
    }

    if (snapped !== committedRef.current) {
      // Mark the re-render as ours so the sync effect keeps the note.
      selfCommittedRef.current = true;
      committedRef.current = snapped;
    }
    onCommit(snapped);
  };

  return (
    <div className="min-w-0">
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={testId}
        value={draft}
        placeholder={fallback !== undefined ? String(fallback) : undefined}
        aria-invalid={note !== null}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          setEditing(true);
          // Commit on a valid, IN-RANGE parse so the results update live.
          //
          // The in-range condition is what makes "revert to the last valid value"
          // mean anything. An earlier version committed the CLAMPED value while
          // typing, so typing 758 immediately committed 150 and the field had no
          // record of a last valid entry to revert to — blurring then had nothing
          // to restore. Committing out-of-range text is deferred to blur, which
          // snaps it and says so.
          //
          // The draft is never rewritten here, which is what used to append
          // digits: typing 80 produced 4080.
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n) && inRange(n)) {
            if (n !== committedRef.current) {
              committedRef.current = n;
              onCommit(n);
            }
            setNote(null);
          }
        }}
        onBlur={(e) => commit(e.target.value, { fromBlur: true })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value, { fromBlur: false });
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            // Abandon the edit entirely.
            setDraft(String(committedRef.current));
            setNote(null);
            setEditing(false);
          }
        }}
        className={className}
      />
      {note && (
        <span
          className="block text-[10px] text-oxide mt-0.5"
          role="status"
          data-testid={testId ? `${testId}-note` : undefined}
        >
          {note}
        </span>
      )}
    </div>
  );
};

export default NumericField;
