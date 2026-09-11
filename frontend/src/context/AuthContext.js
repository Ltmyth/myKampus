'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check auth on load
    const storedUser = localStorage.getItem('ciu_user');
    const storedTokens = localStorage.getItem('ciu_tokens');
    
    if (storedUser && storedTokens) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('ciu_user');
        localStorage.removeItem('ciu_tokens');
      }
    }
    setLoading(false);
  }, []);

  // Protect pages
  useEffect(() => {
    if (loading) return;

    const isPublicPage = pathname.startsWith('/login') || pathname.startsWith('/register');

    if (!user && !isPublicPage) {
      router.push('/login');
    } else if (user && isPublicPage) {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  const login = async (username, password, portalType = null) => {
    try {
      setLoading(true);
      const data = await api.post('/auth/login/', { username, password });
      
      const { access, refresh, user: userProfile } = data;

      // Strict role isolation between Student and Staff portals
      if (portalType === 'student' && userProfile.role !== 'student') {
        return { 
          success: false, 
          error: 'Access Denied: Staff accounts cannot sign in through the Student Portal. Please use the Staff & Executive Portal.' 
        };
      }
      if (portalType === 'staff' && userProfile.role === 'student') {
        return { 
          success: false, 
          error: 'Access Denied: Student accounts cannot sign in through the Staff Portal. Please use the Student Portal.' 
        };
      }

      localStorage.setItem('ciu_tokens', JSON.stringify({ access, refresh }));
      localStorage.setItem('ciu_user', JSON.stringify(userProfile));
      
      setUser(userProfile);
      router.push('/dashboard');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      await api.post('/auth/register/', userData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    const isStudent = user?.role === 'student';
    localStorage.removeItem('ciu_tokens');
    localStorage.removeItem('ciu_user');
    setUser(null);
    if (isStudent) {
      router.push('/login/student');
    } else {
      router.push('/login/staff');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
