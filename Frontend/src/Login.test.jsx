import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login from './Login';
import { useAuth } from './auth/AuthContext';

const mockedNavigate = jest.fn();

jest.mock('./auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./router', () => ({
  useNavigate: () => mockedNavigate,
  useLocation: () => ({ state: null }),
}));

describe('Login', () => {
  let authValue;

  beforeEach(() => {
    jest.clearAllMocks();
    authValue = {
      isAuthenticated: false,
      login: jest.fn().mockResolvedValue({
        user: { id: '1', name: 'Demo User', email: 'demo@example.com', role: 'user' },
        token: 'token-123',
        isFallback: false,
      }),
      register: jest.fn(),
      setAuthError: jest.fn(),
    };
    useAuth.mockReturnValue(authValue);
  });

  test('submits login form and navigates to dashboard', async () => {
    render(<Login />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Sign in$/i })[1]);

    await waitFor(() =>
      expect(authValue.login).toHaveBeenCalledWith({
        name: '',
        email: 'demo@example.com',
        password: 'secret123',
      })
    );
    await waitFor(() =>
      expect(mockedNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    );
  });
});
