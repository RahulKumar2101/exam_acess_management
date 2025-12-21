'use client'

import { useActionState } from 'react' 
import { authenticate } from '../lib/actions'

export default function LoginPage() {
  const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined)

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      {/* Card Container */}
      <div className="w-full max-w-[400px] p-8 space-y-8 bg-white border border-gray-100 rounded-2xl shadow-xl">
        
        <h2 className="text-3xl font-semibold text-center text-gray-900">
          Admin Login
        </h2>
        
        <form action={dispatch} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              Email / Username
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 text-gray-900 placeholder-gray-500 bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
              placeholder="Enter your email or username"
            />
          </div>
          
          {/* Password Field */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              className="w-full px-4 py-3 text-gray-900 placeholder-gray-500 bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
              placeholder="Enter your password"
            />
          </div>

          {/* Login Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className={`w-full py-3.5 px-4 text-white font-semibold bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all ${
                isPending ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isPending ? 'Logging in...' : 'Login'}
            </button>
          </div>
          
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 text-sm text-center text-red-600 bg-red-50 rounded-lg">
              {errorMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}