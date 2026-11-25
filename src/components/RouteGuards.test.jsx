import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdminRoute, ProtectedRoute } from './RouteGuards';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../router', () => ({
  Navigate: ({ to }) => <div>navigate:{to}</div>,
  Outlet: () => <div>protected content</div>,
  useLocation: () => ({ pathname: '/dashboard' }),
}));

describe('Route guards', () => {
  test('ProtectedRoute redirects unauthenticated users', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(<ProtectedRoute />);

    expect(screen.getByText('navigate:/login')).toBeInTheDocument();
  });

  test('ProtectedRoute renders content for authenticated users', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(<ProtectedRoute />);

    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  test('AdminRoute redirects non-admin users to dashboard', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      isLoading: false,
    });

    render(<AdminRoute />);

    expect(screen.getByText('navigate:/dashboard')).toBeInTheDocument();
  });
});
