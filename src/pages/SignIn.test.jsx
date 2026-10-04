import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignIn from './SignIn';

vi.mock('../hooks/useAuthSession', () => ({
  useAuthSession: vi.fn(),
}));

import { useAuthSession } from '../hooks/useAuthSession';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderSignInAt(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SignIn post-auth redirect', () => {
  beforeEach(() => {
    useAuthSession.mockReturnValue({
      isAuthenticated: true,
      isInitializing: false,
      isDisabled: false,
    });
  });

  it('follows a same-origin relative redirectTo', async () => {
    renderSignInAt(`/sign-in?redirectTo=${encodeURIComponent('/capture?x=1')}`);
    expect(await screen.findByTestId('location')).toHaveTextContent('/capture?x=1');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)'])(
    'falls back to "/" for unsafe redirectTo %j',
    async (redirectTo) => {
      renderSignInAt(`/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`);
      const probe = await screen.findByTestId('location');
      expect(probe.textContent).toBe('/');
    },
  );

  it('defaults to "/" when redirectTo is absent', async () => {
    renderSignInAt('/sign-in');
    expect((await screen.findByTestId('location')).textContent).toBe('/');
  });
});
