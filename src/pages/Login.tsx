import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Building2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email && password) {
      login(email)
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[400px] bg-card rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-border/80 p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary text-primary-foreground font-bold shadow-sm mb-4">
            P
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Sign in to your PromoCraft account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@promocraft.co"
              className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-[14px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-[14px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors"
            />
          </div>
          <div className="pt-2">
            <Button type="submit" className="w-full h-10 text-[14px] rounded-[12px]">
              Sign in
            </Button>
          </div>
        </form>
        
        <div className="mt-8 text-center">
           <p className="text-[12px] text-muted-foreground">
             Use <span className="font-medium text-foreground">admin@</span>, <span className="font-medium text-foreground">manager@</span>, or <span className="font-medium text-foreground">employee@</span> to test roles.
           </p>
        </div>
      </div>
    </div>
  )
}
