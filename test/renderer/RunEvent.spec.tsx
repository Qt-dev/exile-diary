import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import RunEvent from '../../src/renderer/components/RunEvent/RunEvent';

vi.mock('../../src/renderer/electron.service', () => ({
  electronService: {
    logger: {
      scope: () => ({
        info: vi.fn(),
      }),
    },
  },
}));

const enteredEvent = {
  event_type: 'entered',
  event_text: 'Dunes',
  timestamp: '2026-07-28T12:00:00.000Z',
};

describe('RunEvent', () => {
  it('hides duplicate entered events without labeling them unknown', () => {
    const { container } = render(
      <RunEvent event={enteredEvent} runInfo={{}} previousEvent={{ ...enteredEvent }} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Unknown event type: entered')).not.toBeInTheDocument();
  });

  it('labels event types without a formatter as unknown', () => {
    render(
      <RunEvent
        event={{ ...enteredEvent, event_type: 'new-event-type' }}
        runInfo={{}}
        previousEvent={null}
      />
    );

    expect(screen.getByText('Unknown event type: new-event-type')).toBeInTheDocument();
  });
});
