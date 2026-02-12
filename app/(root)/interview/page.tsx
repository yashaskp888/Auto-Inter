import React from 'react'
import Agent from '@/components/Agent'

const page = () => {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-center">Interview Generation</h3>
      <Agent userName="You" userId="user1" type="generate" />
    </div>
  )
}

export default page
