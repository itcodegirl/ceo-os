import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChiefAcceptList from './ChiefAcceptList';

describe('ChiefAcceptList', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(<ChiefAcceptList section="priorities" items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an unknown section', () => {
    const { container } = render(
      <ChiefAcceptList section="mystery" items={[{ title: 'x' }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the priorities variant with title, count, and owner/status copy', () => {
    render(
      <ChiefAcceptList
        section="priorities"
        items={[{ title: 'Ship pricing v2', reason: 'Revenue', owner: 'Jenna', status: 'In Progress' }]}
        onAccept={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Priorities' })).toBeInTheDocument();
    expect(screen.getByText('Ship pricing v2')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText(/Owner: Jenna · Status: In Progress/)).toBeInTheDocument();
    expect(screen.getByText('→ Weekly Brief priority')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add priority "Ship pricing v2"/ })).toBeInTheDocument();
  });

  it('renders the opportunities variant with company and next step', () => {
    render(
      <ChiefAcceptList
        section="opportunities"
        items={[{ name: 'Acme deal', company: 'Acme Co', priority: 'High', stage: 'Qualified', nextStep: 'Send proposal' }]}
        onAccept={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument();
    expect(screen.getByText('Acme deal')).toBeInTheDocument();
    expect(screen.getByText('Acme Co')).toBeInTheDocument();
    expect(screen.getByText('Next step: Send proposal')).toBeInTheDocument();
    expect(screen.getByText('→ Opportunities · Qualified')).toBeInTheDocument();
  });

  it('fires onAccept with the item when the button is clicked', () => {
    const onAccept = vi.fn();
    const item = { title: 'Launch post', summary: 'Teaser', platform: 'LinkedIn', status: 'Drafting' };
    render(<ChiefAcceptList section="contentItems" items={[item]} onAccept={onAccept} />);
    fireEvent.click(screen.getByRole('button', { name: /Add content draft "Launch post"/ }));
    expect(onAccept).toHaveBeenCalledWith(item);
  });

  it('disables the button and shows accepted copy when isAccepted is true', () => {
    render(
      <ChiefAcceptList
        section="tasks"
        items={[{ title: 'Email investors', status: 'Planned' }]}
        onAccept={() => {}}
        isAccepted={() => true}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('In Weekly Brief')).toBeInTheDocument();
  });

  it('disables the button while an item is accepting', () => {
    render(
      <ChiefAcceptList
        section="priorities"
        items={[{ title: 'Hire designer' }]}
        onAccept={() => {}}
        isAccepting={() => true}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
