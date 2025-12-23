import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      
      // 1. Define protected routes
      const isOnAdminPanel = nextUrl.pathname.startsWith('/admin');
      const isOnLoginPage = nextUrl.pathname.startsWith('/login');
      
      // 2. Protect Admin Routes: If trying to access /admin but NOT logged in -> Block them
      if (isOnAdminPanel) {
        if (isLoggedIn) return true;
        return false; // Redirects to /login
      }

      // 3. Convenience: If trying to access Login page but ALREADY logged in -> Go to Dashboard
      if (isOnLoginPage && isLoggedIn) {
         return Response.redirect(new URL('/admin/dashboard', nextUrl));
      }

      // 4. ✅ FIX: For all other pages (like Home '/'), allow access regardless of login status
      return true;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;