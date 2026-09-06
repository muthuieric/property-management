// app/login/page.tsx
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  // NEXT.JS 16 FIX: We must await searchParams before using it
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto mt-20">
      <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-slate-800">
        <h1 className="text-2xl font-bold mb-6 text-center">System Login</h1>
        
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-3 bg-gray-50 border border-gray-200 mb-4 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          name="email"
          placeholder="coordinator@property.com"
          required
        />
        
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-3 bg-gray-50 border border-gray-200 mb-6 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        
        <button
          formAction={login}
          className="bg-blue-600 text-white font-medium rounded-md px-4 py-3 hover:bg-blue-700 transition shadow-sm mb-2"
        >
          Sign In
        </button>

        {/* Updated to use the resolved message variable */}
        {message && (
          <p className="mt-4 p-3 bg-red-50 text-red-700 text-sm text-center rounded-md border border-red-100">
            {message}
          </p>
        )}
      </form>
    </div>
  )
}