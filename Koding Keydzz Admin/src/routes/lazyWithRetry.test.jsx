import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { retryImport, lazyWithRetry, RouteErrorBoundary } from './lazyWithRetry';

/**
 * A LOST PAGE CHUNK MUST NOT BLANK THE PORTAL.
 *
 * Each page is a separate chunk fetched when a staff member clicks a nav item.
 * React.lazy treats a failed fetch as a render error, and with no boundary
 * above it React unmounts the tree — the administrator gets a white page with
 * no message. The audience here cannot be expected to know that reloading
 * fixes it, so the app has to say so.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function Page() {
  return <p>the page</p>;
}

function renderLazy(importer) {
  const Lazy = lazyWithRetry(importer);
  return render(
    <RouteErrorBoundary>
      <Suspense fallback={<p>loading</p>}>
        <Lazy />
      </Suspense>
    </RouteErrorBoundary>
  );
}

describe('retryImport', () => {
  it('retries a dropped chunk and succeeds, invisibly', async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Importing a module script failed.'))
      .mockResolvedValue({ default: Page });

    await expect(retryImport(importer, { backoffMs: 1 })).resolves.toBeTruthy();
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('gives up after a bounded number of attempts', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('gone'));
    await expect(retryImport(importer, { backoffMs: 1 })).rejects.toThrow('gone');
    expect(importer).toHaveBeenCalledTimes(3);
  });
});

describe('a page that loads', () => {
  it('renders normally, with no error UI', async () => {
    renderLazy(vi.fn().mockResolvedValue({ default: Page }));
    expect(await screen.findByText('the page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('a page whose chunk never arrives', () => {
  it('shows what happened and how to fix it, not a blank screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLazy(vi.fn().mockRejectedValue(new TypeError('Importing a module script failed.')));

    const alert = await waitFor(() => screen.getByRole('alert'), { timeout: 5000 });
    expect(alert).toHaveTextContent(/didn.t load/i);
    // Reassures that no work was lost — the thing an admin actually worries about.
    expect(alert).toHaveTextContent(/nothing was lost/i);
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('the reload button actually reloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const original = window.location;
    delete window.location;
    window.location = { ...original, reload };

    renderLazy(vi.fn().mockRejectedValue(new Error('gone')));
    await waitFor(() => screen.getByRole('alert'), { timeout: 5000 });
    await userEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(reload).toHaveBeenCalled();

    window.location = original;
  });
});
