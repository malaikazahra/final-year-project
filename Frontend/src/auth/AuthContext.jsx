import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService, getStoredToken, getStoredUser } from '../services/appService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      if (!token) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, [token]);

  const login = async (payload) => {
    setAuthError('');
    const result = await authService.login(payload);
    setUser(result.user);
    setToken(result.token);
    return result;
  };

  const register = async (payload) => {
    setAuthError('');
    const result = await authService.register(payload);
    setUser(result.user);
    setToken(result.token);
    return result;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isAdmin: user?.role === 'admin',
      isLoading,
      authError,
      setAuthError,
      login,
      register,
      logout,
    }),
    [authError, isLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
