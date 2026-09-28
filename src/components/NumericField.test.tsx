// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { NumericField } from './NumericField';

// Unmount between tests. Without this the previous test's DOM is still mounted and
// every getByTestId finds two elements.
afterEach(cleanup);

/**
 * ITEM 25: the four behaviours the review specified, exercised through a real DOM.
 *
 *   1. clear the field            -> the box becomes empty
 *   2. type 80                    -> commits 80
 *   3. type 758 and blur          -> snaps to the maximum, and says so
 *   4. clear then blur            -> reverts to the previous value
 *
 * A harness that holds committed state, so the parent behaves like InputPanel:
 * the value the engine would use is what `value` holds.
 */
function Harness({ initial = 40, min, max, testId = 'f' }: {
  initial?: number; min?: number; max?: number; testId?: string;
}) {
  const [v, setV] = useState(initial);
  return (
    <NumericField
      value={v}
      onCommit={setV}
      min={min}
      max={max}
      step={0.5}
      data-testid={testId}
      aria-label="test numeric"
      className="border"
    />
  );
}

const get = (id = 'f') => screen.getByTestId(id) as HTMLInputElement;

describe('item 25: NumericField can be cleared', () => {
  it('becomes empty when the user selects all and deletes', () => {
    render(<Harness initial={40} />);
    const input = get();
    expect(input.value).toBe('40');

    // Select-all then delete. The old implementation snapped straight back to the
    // previous value here, because parseFloat('') is NaN and `|| 40` fired.
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  it('stays empty across a blur-then-retype cycle without reinstating the old value', () => {
    render(<Harness initial={40} />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    // Typing a fresh value must not append to the old one. The old code echoed the
    // committed value back mid-edit, so typing 80 produced 408.
    fireEvent.change(input, { target: { value: '80' } });
    expect(input.value).toBe('80');
  });
});

describe('item 25: typing a valid value commits it', () => {
  it('typing 80 gives 80, not 4080', () => {
    const commits: number[] = [];
    function Rec() {
      const [v, setV] = useState(40);
      return (
        <NumericField
          value={v}
          onCommit={(n) => { commits.push(n); setV(n); }}
          step={0.5}
          data-testid="f"
          aria-label="t"
        />
      );
    }
    render(<Rec />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '80' } });
    expect(input.value).toBe('80');
    expect(commits).toContain(80);
    expect(commits).not.toContain(4080);
  });

  it('Enter commits and leaves the field', () => {
    const commits: number[] = [];
    function Rec() {
      const [v, setV] = useState(40);
      return (
        <NumericField
          value={v}
          onCommit={(n) => { commits.push(n); setV(n); }}
          step={0.5}
          data-testid="f"
          aria-label="t"
        />
      );
    }
    render(<Rec />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '55' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(commits[commits.length - 1]).toBe(55);
  });
});

describe('item 25: out-of-range snaps on blur and reports it', () => {
  it('typing 758 with a max of 150 snaps to 150 and shows a note', () => {
    render(<Harness initial={40} min={5} max={150} />);
    const input = get();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '758' } });
    // While typing, the raw text is preserved so the user can keep editing.
    expect(input.value).toBe('758');

    fireEvent.blur(input);
    // On blur it snaps to the bound.
    expect(input.value).toBe('150');
    // And it says so, because the old code displayed 758 while the engine used a
    // clamped value with no indication at the point of entry.
    const note = screen.getByTestId('f-note');
    expect(note.textContent).toMatch(/adjusted to 150/i);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('typing below the minimum snaps to the minimum', () => {
    render(<Harness initial={40} min={25} max={65} />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    expect(input.value).toBe('25');
    expect(screen.getByTestId('f-note').textContent).toMatch(/adjusted to 25/i);
  });

  it('an in-range value produces no note', () => {
    render(<Harness initial={40} min={5} max={150} />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.blur(input);
    expect(input.value).toBe('80');
    expect(screen.queryByTestId('f-note')).toBeNull();
  });
});

describe('item 25: empty on blur reverts to the last valid value', () => {
  it('clearing then blurring restores the previous value', () => {
    render(<Harness initial={40} min={5} max={150} />);
    const input = get();
    expect(input.value).toBe('40');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    fireEvent.blur(input);
    // Reverts rather than committing NaN or silently reinstating a default.
    expect(input.value).toBe('40');
  });

  it('unparseable text on blur also reverts', () => {
    render(<Harness initial={40} min={5} max={150} />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(input.value).toBe('40');
  });

  it('never commits a non-finite value', () => {
    const commits: number[] = [];
    function Rec() {
      const [v, setV] = useState(40);
      return (
        <NumericField
          value={v}
          onCommit={(n) => { commits.push(n); setV(n); }}
          min={5}
          max={150}
          data-testid="f"
          aria-label="t"
        />
      );
    }
    render(<Rec />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.blur(input);
    for (const n of commits) {
      expect(Number.isFinite(n), `committed ${n}`).toBe(true);
    }
  });
});

describe('item 25: Escape abandons the edit', () => {
  it('restores the last valid committed value', () => {
    render(<Harness initial={40} min={5} max={150} />);
    const input = get();
    expect(input.value).toBe('40');

    // 758 is out of range, so nothing is committed while typing it and the draft
    // still holds the raw text. Escape then has a real "last valid value" to
    // restore: the 40 the field started with.
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '758' } });
    expect(input.value).toBe('758');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('40');
  });

  it('an in-range value typed mid-edit is already committed, so Escape keeps it', () => {
    // Documents the live-commit semantics: a valid in-range value commits as you
    // type, so Escape has nothing to undo. This is deliberate — the results panel
    // is expected to update while typing.
    render(<Harness initial={40} min={5} max={150} />);
    const input = get();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('99');
  });
});

describe('item 25: a parent-driven value change is adopted', () => {
  it('picks up a new value when not mid-edit', () => {
    function Rec() {
      const [v, setV] = useState(40);
      return (
        <div>
          <button onClick={() => setV(77)}>set 77</button>
          <NumericField value={v} onCommit={setV} data-testid="f" aria-label="t" />
        </div>
      );
    }
    render(<Rec />);
    const input = get();
    expect(input.value).toBe('40');
    act(() => { screen.getByText('set 77').click(); });
    expect(input.value).toBe('77');
  });
});
