import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import Dashboard from './Dashboard';
import Capture from './Capture';
import Journal from './Journal';
import Opportunities from './Opportunities';
import ContentOS from './ContentOS';
import WeeklyBrief from './WeeklyBrief';
import ChiefOfStaff from './ChiefOfStaff';
import OpsReliability from './experimental/OpsReliability';
import Settings from './Settings';

const ROUTE_CASES = [
  {
    path: '/',
    heading: 'Focus Home',
  },
  {
    path: '/opportunities',
    heading: 'Opportunities',
  },
  {
    path: '/capture',
    heading: 'Capture',
  },
  {
    path: '/journal',
    heading: 'Journal',
  },
  {
    path: '/content',
    heading: 'Content OS',
  },
  {
    path: '/weekly-brief',
    heading: 'Weekly Brief',
  },
  {
    path: '/chief-of-staff',
    heading: 'Chief of Staff',
  },
  {
    path: '/ops-reliability',
    heading: 'Ops Reliability',
  },
  {
    path: '/settings',
    heading: 'Settings',
  },
];

describe('src/pages route accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  ROUTE_CASES.forEach(({ path, heading }) => {
    it(`renders one page heading and a main landmark for ${path}`, async () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="capture" element={<Capture />} />
              <Route path="journal" element={<Journal />} />
              <Route path="opportunities" element={<Opportunities />} />
              <Route path="content" element={<ContentOS />} />
              <Route path="weekly-brief" element={<WeeklyBrief />} />
              <Route path="chief-of-staff" element={<ChiefOfStaff />} />
              <Route path="ops-reliability" element={<OpsReliability />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByRole('heading', { level: 1, name: heading });

      const h1Headings = screen.getAllByRole('heading', { level: 1 });
      expect(h1Headings).toHaveLength(1);

      const main = document.getElementById('main-content');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('tabindex', '-1');
    });
  });
});
