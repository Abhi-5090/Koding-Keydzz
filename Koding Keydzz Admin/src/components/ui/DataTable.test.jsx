import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import DataTable from './DataTable';

const data = [
  { id: '1', name: 'Charlie', xp: 300 },
  { id: '2', name: 'Alice', xp: 900 },
  { id: '3', name: 'Bob', xp: 100 },
];

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'xp', header: 'XP' },
];

function rowNames() {
  const rows = screen.getAllByRole('row').slice(1); // drop header
  return rows.map((r) => within(r).getAllByRole('cell')[0].textContent);
}

describe('DataTable', () => {
  it('renders all rows by default', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(rowNames()).toEqual(['Charlie', 'Alice', 'Bob']);
    expect(screen.getByText(/of/)).toBeInTheDocument();
  });

  it('filters rows by search query', () => {
    render(<DataTable columns={columns} data={data} searchKeys={['name']} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'ali' },
    });
    expect(rowNames()).toEqual(['Alice']);
  });

  it('sorts ascending then descending when a header is clicked', () => {
    render(<DataTable columns={columns} data={data} />);
    const xpHeader = screen.getByText('XP');

    fireEvent.click(xpHeader); // ascending by xp
    expect(rowNames()).toEqual(['Bob', 'Charlie', 'Alice']);

    fireEvent.click(xpHeader); // descending by xp
    expect(rowNames()).toEqual(['Alice', 'Charlie', 'Bob']);
  });

  it('shows the empty message when no rows match', () => {
    render(
      <DataTable columns={columns} data={data} searchKeys={['name']} emptyMessage="Nothing here" />
    );
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
