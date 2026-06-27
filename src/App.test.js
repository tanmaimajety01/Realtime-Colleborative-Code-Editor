import { render, screen } from '@testing-library/react';
import App from './App';

test('renders SyncCode app', () => {
  render(<App />);
  const headingElement = screen.getByText(/SyncCode/i);
  expect(headingElement).toBeInTheDocument();
});
