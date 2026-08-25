import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskList } from '../components/TaskList.js';
import type { GeneratedTask } from '../types/line.js';

/** Two resolved tasks plus one unresolved ("missing") row. */
const tasks: GeneratedTask[] = [
  { step: 1, key: '1-1', crane_name: '7A', tank_name: '1-1A', time: 60, previous_task: 0, next_task: 3, status: 0 },
  { step: 2, key: '1-2', crane_name: '7A', tank_name: '1-2', time: 30, previous_task: 1, next_task: 4, status: 0 },
  { step: 3, key: '20-1', crane_name: 'missing', tank_name: 'missing', time: 60, previous_task: 3, next_task: 'missing', status: 0 },
];

describe('TaskList', () => {
  it('renders the tasks and badges missing cells', () => {
    render(<TaskList tasks={tasks} lineName="line4" />);
    expect(screen.getByText('1-1A')).toBeInTheDocument();
    expect(screen.getByText(/3 tasks/i)).toBeInTheDocument();
    // The unresolved row shows "missing" badges (crane, tank, next_task).
    expect(screen.getAllByText('missing').length).toBeGreaterThanOrEqual(2);
  });
});
