import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      
      // 1. UPDATE: Check for '/admin' instead of '/dashboard'
      const isOnAdminPanel = nextUrl.pathname.startsWith('/admin');
      
      if (isOnAdminPanel) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // 2. UPDATE: Redirect logged-in users to '/admin/dashboard' instead of '/'
        return Response.redirect(new URL('/admin/dashboard', nextUrl));
      }
      return true;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;