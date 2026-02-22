"use client"

import React, { useRef, useState, useEffect } from "react"
import Image from "next/image"
import { Room, RoomEvent, Track, DataPacket_Kind } from "livekit-client"
import { cn } from "@/lib/utils"

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface TranscriptionMessage {
  role: "agent" | "user"
  text: string
  timestamp: Date
}

const Agent = ({ userName, userId, interviewId: generatedInterviewId }: AgentProps) => {
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE)
  const [room, setRoom] = useState<Room | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const agentAudioRef = useRef<HTMLDivElement>(null)
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([])
  const interviewIdRef = useRef<string | null>(null)
  const roomNameRef = useRef<string | null>(null)
  const generatedInterviewIdRef = useRef<string | null>(generatedInterviewId || null)
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef<boolean>(false)

  const messages = [
    "What's your name?",
    "My name is Inter AI, nice to meet you",
  ]
  const lastMessage = messages[messages.length - 1]

  // Save transcriptions to Firebase (uses generatedInterviewIdRef when set by agent)
  const saveTranscriptions = async (messages: TranscriptionMessage[]) => {
    if (!interviewIdRef.current || !roomNameRef.current || messages.length === 0) {
      console.log("Skipping save - missing data:", {
        interviewId: interviewIdRef.current,
        roomName: roomNameRef.current,
        messageCount: messages.length
      })
      return
    }

    // Filter out empty messages
    const validMessages = messages.filter(msg => msg.text && msg.text.trim().length > 0)
    
    if (validMessages.length === 0) {
      console.log("No valid messages to save")
      return
    }

    console.log(`Saving ${validMessages.length} transcriptions to Firebase`)

    try {
      const response = await fetch("/api/save-transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: interviewIdRef.current,
          roomName: roomNameRef.current,
          userId: userId || null,
          userName: userName || "Anonymous",
          messages: validMessages.map(msg => ({
            role: msg.role,
            text: msg.text.trim(),
            timestamp: msg.timestamp.toISOString(),
          })),
          generatedInterviewId: generatedInterviewIdRef.current || generatedInterviewId || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("Failed to save transcriptions:", errorData)
      } else {
        const result = await response.json()
        console.log(`Successfully saved ${result.messageCount || validMessages.length} messages`)
      }
    } catch (error) {
      console.error("Failed to save transcriptions:", error)
    }
  }

  // Auto-save transcriptions every 10 seconds
  useEffect(() => {
    if (callStatus === CallStatus.ACTIVE && transcriptions.length > 0) {
      saveIntervalRef.current = setInterval(() => {
        saveTranscriptions(transcriptions)
      }, 10000) // Save every 10 seconds
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current)
      }
    }
  }, [callStatus, transcriptions])

  // 🔥 START CALL
  async function startCall() {
    try {
      setCallStatus(CallStatus.CONNECTING)


      // Ask for mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true })

      // Get token from backend
      const res = await fetch("/api/livekit-token")
      if (!res.ok) {
        throw new Error(`Failed to get token: ${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      
      if (!data.token || !data.url || !data.room) {
        throw new Error("Invalid response from token endpoint")
      }
     
      // Initialize interview tracking
      interviewIdRef.current = `interview-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      roomNameRef.current = data.room
      setTranscriptions([]) // Reset transcriptions for new call

      const newRoom = new Room()

      // Clear any previous call's audio elements
      if (agentAudioRef.current) agentAudioRef.current.innerHTML = ""

      // Play remote audio (e.g. agent) so you can hear it
      newRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio && agentAudioRef.current) {
          const el = track.attach()
          agentAudioRef.current.appendChild(el)
        }
      })

      // Capture transcriptions from LiveKit data channel (sent by Python agent)
      newRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        try {
          const decoder = new TextDecoder()
          const text = decoder.decode(payload)
          const data = JSON.parse(text)

          // Handle interview_created - agent sends this after generating questions
          if (data.type === "interview_created" && data.interviewId) {
            generatedInterviewIdRef.current = data.interviewId
            console.log("[client] Received interview_created:", data.interviewId)
          }

          // Handle transcription data from agent
          if (data.type === "transcription" && data.text && data.role) {
            const message: TranscriptionMessage = {
              role: data.role as "agent" | "user",
              text: data.text.trim(),
              timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
            }

            // Only add if text is not empty
            if (message.text.length > 0) {
              console.log(`[${data.role}] ${data.text.substring(0, 100)}`)
              setTranscriptions((prev) => {
                // Avoid duplicates - check if same text and role exists within last 5 seconds
                const recentTime = new Date(Date.now() - 5000)
                const exists = prev.some(
                  (msg) => 
                    msg.text.trim().toLowerCase() === message.text.trim().toLowerCase() && 
                    msg.role === message.role &&
                    msg.timestamp > recentTime
                )
                if (!exists) {
                  console.log(`Added transcription: [${message.role}] "${message.text.substring(0, 50)}..."`)
                  return [...prev, message]
                }
                return prev
              })
            }
          } else if (data.text && !data.type) {
            // Fallback: if data has text but no type, assume it's a transcription
            const role = participant?.identity?.includes("agent") || participant?.isAgent 
              ? "agent" 
              : "user"
            
            const message: TranscriptionMessage = {
              role,
              text: (data.text || text).trim(),
              timestamp: new Date(),
            }

            if (message.text.length > 0) {
              setTranscriptions((prev) => [...prev, message])
            }
          }
        } catch (error) {
          // If not JSON, log for debugging
          const decoder = new TextDecoder()
          const text = decoder.decode(payload)
          console.log("Received non-JSON data:", text.substring(0, 100))
        }
      })

      // Capture transcriptions from track publications (if LiveKit transcription is enabled)
      // Note: This requires LiveKit transcription service to be enabled
      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (publication && publication.kind === Track.Kind.Audio) {
          // Check if publication has transcriptionReceived event
          if (typeof publication.on === "function") {
            try {
              publication.on("transcriptionReceived", (segments: any[]) => {
                // segments is an array of TranscriptionSegment
                if (Array.isArray(segments)) {
                  for (const segment of segments) {
                    if (segment?.final && segment?.text) {
                      const role = participant?.identity?.includes("agent") || participant?.isAgent
                        ? "agent"
                        : "user"

                      const message: TranscriptionMessage = {
                        role,
                        text: segment.text,
                        timestamp: new Date(),
                      }

                      setTranscriptions((prev) => [...prev, message])
                    }
                  }
                }
              })
            } catch (e) {
              // Transcription not available, that's okay
              console.log("Transcription events not available")
            }
          }
        }
      })

      newRoom.on(RoomEvent.Connected, () => {
        console.log("Room connected successfully")
      })

      newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log("Connection state:", state)
      })

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("Participant joined:", participant.identity)
        
        // Listen to participant's track subscriptions for transcription
        participant.on(RoomEvent.TrackSubscribed, (track, publication) => {
          // Track subscribed - transcription might come via data channel
        })
      })

      // Connect to LiveKit
      // Ensure URL is WebSocket format (wss://)
      let wsUrl = data.url
      if (wsUrl.startsWith("https://")) {
        wsUrl = wsUrl.replace("https://", "wss://")
      } else if (wsUrl.startsWith("http://")) {
        wsUrl = wsUrl.replace("http://", "ws://")
      } else if (!wsUrl.startsWith("wss://") && !wsUrl.startsWith("ws://")) {
        // If no protocol, assume wss://
        wsUrl = `wss://${wsUrl}`
      }

      console.log("Connecting to LiveKit:", wsUrl)
      await newRoom.connect(wsUrl, data.token)

      // Enable microphone
      await newRoom.localParticipant.setMicrophoneEnabled(true)

      // Start client-side speech recognition to capture user answers
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results as any[])
            .map((result: any) => result[0].transcript)
            .join(' ')
            .trim()

          if (transcript.length > 0) {
            console.log(`[user] ${transcript}`)
            const message: TranscriptionMessage = {
              role: "user",
              text: transcript,
              timestamp: new Date(),
            }

            setTranscriptions((prev) => {
              // Avoid duplicates
              const recentTime = new Date(Date.now() - 3000)
              const exists = prev.some(
                (msg) => 
                  msg.text.trim().toLowerCase() === message.text.trim().toLowerCase() && 
                  msg.role === "user" &&
                  msg.timestamp > recentTime
              )
              if (!exists) {
                console.log(`Added user transcription: "${transcript.substring(0, 50)}..."`)
                return [...prev, message]
              }
              return prev
            })
          }
        }

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error)
        }

        recognition.onend = () => {
          // Restart recognition if still listening (use ref to avoid stale closure)
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognition.start()
            } catch (e) {
              // Already started or not available
            }
          }
        }

        recognition.start()
        recognitionRef.current = recognition
        isListeningRef.current = true
        console.log("Started client-side speech recognition")
      } else {
        console.warn("Speech recognition not supported in this browser")
      }

      // Optional speaking indicator
      newRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setIsSpeaking(speakers.length > 0)
      })

      // Handle disconnect - save final transcriptions and generate feedback
      newRoom.on(RoomEvent.Disconnected, async () => {
        // Stop speech recognition
        if (recognitionRef.current) {
          isListeningRef.current = false
          try {
            recognitionRef.current.stop()
          } catch (e) {
            // Already stopped
          }
          recognitionRef.current = null
        }

        // Save any remaining transcriptions
        if (transcriptions.length > 0) {
          await saveTranscriptions(transcriptions)
        }
        
        // Mark interview as finished and generate feedback
        if (interviewIdRef.current && userId) {
          try {
            // Mark interview as finished
            await fetch("/api/save-transcription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                interviewId: interviewIdRef.current,
                roomName: roomNameRef.current,
                userId: userId || null,
                userName: userName || "Anonymous",
                messages: [],
                status: "finished",
                generatedInterviewId: generatedInterviewIdRef.current || generatedInterviewId || null,
              }),
            })

            // Generate feedback
            const feedbackRes = await fetch("/api/generate-feedback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                interviewId: interviewIdRef.current,
                userId: userId,
                generatedInterviewId: generatedInterviewIdRef.current || generatedInterviewId || null,
              }),
            })

            if (feedbackRes.ok) {
              const feedbackData = await feedbackRes.json()
              // Redirect to feedback page
              window.location.href = `/feedback/${feedbackData.feedbackId}`
            } else {
              const errorData = await feedbackRes.json().catch(() => ({ error: "Unknown error" }))
              console.error("Failed to generate feedback:", errorData)
              // Still show feedback page or show error message
              alert(`Feedback generation failed: ${errorData.error || "Please try again later"}`)
              setCallStatus(CallStatus.FINISHED)
            }
          } catch (error) {
            console.error("Failed to process interview completion:", error)
            setCallStatus(CallStatus.FINISHED)
          }
        } else {
          setCallStatus(CallStatus.FINISHED)
        }
      })

      setRoom(newRoom)
      setCallStatus(CallStatus.ACTIVE)
    } catch (error) {
      console.error("Failed to start call:", error)
      // Show user-friendly error message
      alert(`Failed to connect: ${error instanceof Error ? error.message : "Unknown error"}`)
      setCallStatus(CallStatus.FINISHED)
    }
  }

  // 🔥 END CALL
  async function endCall() {
    // Stop speech recognition
    if (recognitionRef.current) {
      isListeningRef.current = false
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Already stopped
      }
      recognitionRef.current = null
    }

    // Save final transcriptions before disconnecting
    if (transcriptions.length > 0) {
      await saveTranscriptions(transcriptions)
    }

    if (room) {
      await room.disconnect()
      setRoom(null)
    }

    // Clear interval
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current)
      saveIntervalRef.current = null
    }

    // Generate feedback and redirect
    if (interviewIdRef.current && userId) {
      try {
        // Mark interview as finished
        await fetch("/api/save-transcription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interviewId: interviewIdRef.current,
            roomName: roomNameRef.current,
            userId: userId,
            userName: userName || "Anonymous",
            messages: [],
            status: "finished",
            generatedInterviewId: generatedInterviewIdRef.current || generatedInterviewId || null,
          }),
        })

        // Generate feedback
        const feedbackRes = await fetch("/api/generate-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interviewId: interviewIdRef.current,
            userId: userId,
            generatedInterviewId: generatedInterviewIdRef.current || generatedInterviewId || null,
          }),
        })

        if (feedbackRes.ok) {
          const feedbackData = await feedbackRes.json()
          // Redirect to feedback page
          window.location.href = `/feedback/${feedbackData.feedbackId}`
        } else {
          const errorData = await feedbackRes.json().catch(() => ({ error: "Unknown error" }))
          console.error("Failed to generate feedback:", errorData)
          // Still show feedback page or show error message
          alert(`Feedback generation failed: ${errorData.error || "Please try again later"}`)
          setCallStatus(CallStatus.FINISHED)
        }
      } catch (error) {
        console.error("Failed to process interview completion:", error)
        setCallStatus(CallStatus.FINISHED)
      }
    } else {
      setCallStatus(CallStatus.FINISHED)
    }
  }

  return (
    <>
      {/* Hidden container for agent audio so it plays */}
      <div ref={agentAudioRef} className="sr-only" aria-hidden />
      <div className="call-view px-7">
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="AI"
              width={64}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak"></span>}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/eps.jpg"
              alt="User"
              width={120}
              height={102}
              className="object-cover rounded-full"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="justify-center flex w-full">
        {callStatus !== CallStatus.ACTIVE ? (
          <button
            onClick={startCall}
            className="relative btn-call"
          >
            <span
              className={cn(
                "absolute animate-ping opacity-75 rounded-full",
                callStatus !== CallStatus.CONNECTING ? "hidden" : ""
              )}
            />
            <span>
              {callStatus === CallStatus.INACTIVE ||
              callStatus === CallStatus.FINISHED
                ? "Call"
                : "Connecting..."}
            </span>
          </button>
        ) : (
          <button
            onClick={endCall}
            className="btn-disconnect"
          >
            End
          </button>
        )}
      </div>
    </>
  )
}

export default Agent
