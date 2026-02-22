import React from 'react'
import Agent from '@/components/Agent'
import { getCurrentUser } from '@/lib/Actions/auth.actions'
import { redirect } from 'next/navigation'

const page = async () => {
  const user = await getCurrentUser()
  if (!user) redirect('/signin')

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-center">Interview Generation</h3>
      {user.sayableId && (
        <div className="bg-dark-300 border border-primary-500/30 rounded-lg p-4 max-w-lg mx-auto">
          <p className="text-sm text-light-200 text-center">
            <span className="font-medium">When the AI asks for your user ID, say these 4 digits:</span>
          </p>
          <p className="text-2xl font-mono font-bold text-primary-100 text-center mt-2 tracking-widest">
            {user.sayableId.split('').join(' ')}
          </p>
          <p className="text-xs text-light-400 text-center mt-2">
            Example: &quot;{user.sayableId[0]} {user.sayableId[1]} {user.sayableId[2]} {user.sayableId[3]}&quot; — say each digit clearly
          </p>
        </div>
      )}
      <Agent
        userName={user.name || user.email || 'You'}
        userId={user.id}
        type="generate"
      />
    </div>
  )
}

export default page
