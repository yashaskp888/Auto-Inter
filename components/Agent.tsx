"use client"
import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useState } from 'react'

enum CallStatus {
    INACTIVE='INACTIVE',
    CONNECTING='CONNECTING',
    ACTIVE='ACTIVE',
    FINISHED='FINISHED'
}

const Agent = ({userName}:AgentProps) => {
    const [callStatus, setCallStatus] = useState<CallStatus>(
  CallStatus.FINISHED
)

    const isSpeaking=true
    const messages=[ 
        "What's your name?",
        "My Name is Inter Ai,nice to meet you"]
    const lastMesage=messages[messages.length-1]    
  return (<>
    <div className="call-view px-7">
        <div className="card-interviewer">
            <div className="avatar">
                <Image src="/ai-avatar.png" alt="Vapi" width={64} height={54} className="object-cover"/>
                {isSpeaking && <span className="animate-speak"></span>}
            </div>
            <h3>AI Interviewer</h3>
        </div>
        <div className="card-border">
            <div className="card-content">
                <Image src="/user-avatar.png" alt="User" width={120} height={102} className="object-cover rounded-full size-{120px}"/>
                <h3>{userName}</h3>
            </div>
            
        </div>
      
    </div>
    {messages.length>0 &&(
        <div className="transcript-border">
            <div className="transcript">
                <p key={lastMesage} className={cn("transition-opacity duration-500 opacity-0","animate-fadeIn opacity-100")}>{lastMesage}</p>
            </div>
        </div>
    )}
    <div className="justify-center flex w-full">
        {callStatus !==CallStatus.ACTIVE?(
            <button className="relative btn-call">
                <span className={cn("absolute animate-ping opacity-75 rounded-full", callStatus!== CallStatus.CONNECTING?'hidden':'')}/>
                <span>    {callStatus === CallStatus.INACTIVE || callStatus ===CallStatus.FINISHED?"Call":"....."}
                </span>
            </button>):(<button className="btn-disconnect">End</button>)
        }
    </div>
    </>
  )
}

export default Agent
