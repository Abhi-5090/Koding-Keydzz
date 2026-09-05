import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast, toast } from './ToastProvider';

/**
 * THE TOAST SYSTEM.
 *
 * Hand-written rather than pulled from a library, and these are the properties
 * that justified that: the ones a library would either not offer or would get
 * wrong for this product.
 */

function Harness({ onReady }) {
  const api = useToast();
  onReady?.(api);
  return <button type="button" onClick={() => api.success('Saved.')}>go</button>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('politeness', () => {
  it('puts ERRORS in an assertive region and everything else in a polite one', async () => {
    /**
     * The whole reason this is hand-written. A failed save must interrupt a
     * screen reader; "Saved" must not talk over what the user is reading.
     * Libraries almost universally use one region with one politeness, which
     * either interrupts constantly or never announces the failure.
     */
    let api;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>
    );

    act(() => {
      api.error('Could not save.');
      api.success('Saved.');
    });

    const assertive = document.querySelector('[aria-live="assertive"]');
    const polite = document.querySelector('[aria-live="polite"]');

    expect(assertive).toHaveTextContent('Could not save.');
    expect(assertive).not.toHaveTextContent('Saved.');
    expect(polite).toHaveTextContent('Saved.');
    expect(polite).not.toHaveTextContent('Could not save.');
  });

  it('gives the assertive region role="alert" and the polite one role="status"', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    expect(document.querySelector('[aria-live="assertive"]')).toHaveAttribute('role', 'alert');
    expect(document.querySelector('[aria-live="polite"]')).toHaveAttribute('role', 'status');
  });
});

describe('dismissal', () => {
  it('AUTO-DISMISSES a confirmation', async () => {
    /**
     * Real timers with a short explicit duration, not fake ones.
     *
     * `AnimatePresence` keeps an exiting element mounted until its transition
     * finishes, and framer-motion drives that from rAF rather than from
     * `setTimeout` — so under fake timers the state updates, the element stays
     * in the DOM, and the test fails while the component is working correctly.
     * Waiting for the real removal tests the thing a user actually sees.
     */
    let api;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>
    );

    act(() => { api.push({ type: 'success', message: 'Saved.', duration: 50 }); });
    expect(screen.getByText('Saved.')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText('Saved.')).not.toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('NEVER auto-dismisses an error', async () => {
    /**
     * The asymmetry that matters. A confirmation that vanishes is fine — the
     * user saw the thing happen. A failure that vanishes leaves somebody who
     * looked away believing their work saved, which is the single worst
     * outcome this component can produce.
     */
    vi.useFakeTimers();
    let api;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>
    );

    act(() => { api.error('Not saved.'); });
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(screen.getByText('Not saved.')).toBeInTheDocument();
  });

  it('can be dismissed by the user', async () => {
    const user = userEvent.setup();
    let api;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>
    );

    act(() => { api.error('Not saved.'); });
    await user.click(screen.getByRole('button', { name: /dismiss notification/i }));
    // Generous timeout: the exit animation keeps the node mounted for a beat.
    await waitFor(() => expect(screen.queryByText('Not saved.')).not.toBeInTheDocument(), {
      timeout: 3000,
    });
  });
});

describe('noise control', () => {
  it('DE-DUPLICATES an identical message', () => {
    // A failing request retried three times, or a mutation firing per row,
    // would otherwise stack three copies of the same sentence.
    let api;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>
    );

    act(() => {
      api.error('Could not save.');
      api.error('Could not save.');
      api.error('Could not save.');
    });

    expect(screen.getAllByText('Could not save.')).toHaveLength(1);
  });

  it('caps how many are on screen, dropping the OLDEST', () => {
    // A burst must not bury the page, and the newest is the one the user's
    // action just produced.
    let api;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>
    );

    act(() => {
      for (let i = 1; i <= 8; i += 1) api.info(`Message ${i}`);
    });

    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
    expect(screen.getByText('Message 8')).toBeInTheDocument();
  });
});

describe('the non-React entry point', () => {
  it('lets the API middleware raise a toast without a hook', () => {
    /**
     * The RTK Query error middleware is not a component and cannot use a hook,
     * but it is the single most valuable place to raise a toast from — one
     * listener there covers every failed request in the application.
     */
    render(<ToastProvider><Harness /></ToastProvider>);
    act(() => { toast().error('From middleware.'); });
    expect(screen.getByText('From middleware.')).toBeInTheDocument();
  });

  it('is a NO-OP when no provider is mounted, rather than throwing', () => {
    // A missing notification must never break a render or a request.
    expect(() => toast().error('nobody listening')).not.toThrow();
  });
});

describe('without a provider', () => {
  it('useToast returns a safe no-op so a component can render in isolation', () => {
    let api;
    render(<Harness onReady={(a) => { api = a; }} />);
    expect(() => api.success('x')).not.toThrow();
  });
});
