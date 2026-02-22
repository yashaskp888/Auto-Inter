import React from 'react'
import Agent from '@/components/Agent'
import { getCurrentUser } from '@/lib/Actions/auth.actions'
import { redirect } from 'next/navigation'
import { db } from '@/firebase/admin'

interface PageProps {
  params: Promise<{ interviewId: string }>;
}

export default async function InterviewTakePage({ params }: PageProps) {
  const { interviewId } = await params
  const user = await getCurrentUser()

  if (!user) redirect('/signin')

  const doc = await db.collection('interviews').doc(interviewId).get()
  if (!doc.exists) {
    redirect('/')
  }

  const data = doc.data()!
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    redirect('/interview')
  }

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-center">
        {data.role} Interview – {data.questions.length} questions
      </h3>
      <Agent
        userName={user.name || user.email || 'You'}
        userId={user.id}
        interviewId={interviewId}
        type="interview"
      />
    </div>
  )
}
