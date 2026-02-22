import logging
from typing import Optional
from urllib.parse import quote
import aiohttp
import asyncio
import json
from datetime import datetime
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    ToolError,
    cli,
    function_tool,
    inference,
    room_io,
    utils,
)
from livekit.plugins import (
    noise_cancellation,
    silero,
)


logger = logging.getLogger("agent-Blake-1c1b")

load_dotenv(".env.local")


class DefaultAgent(Agent):
    def __init__(self, room: rtc.Room) -> None:
        super().__init__(
            instructions="""You are a professional AI interview assistant.

You must:

Collect the following information one by one:

Job role

Experience level

Interview type (technical, behavioral, mixed)

Tech stack

Number of questions

Ask only one question at a time.
Wait for the user's answer before asking the next.
After collecting all details, confirm them briefly.
If confirmed, say:
\"I am generating your interview now.\"
Then call the action generate_interview.

When all information is collected and confirmed, call the HTTP tool \"generate_interview\" using the collected variables.


Important:
Respond in plain natural speech suitable for voice.

No JSON. No markdown.

Save.""",
        )
        self.room = room

    async def send_transcription(self, role: str, text: str):
        """Send transcription to client via data channel"""
        if not text or not text.strip():
            return
        
        try:
            data = json.dumps({
                "type": "transcription",
                "role": role,
                "text": text,
                "timestamp": datetime.utcnow().isoformat(),
            })
            await self.room.local_participant.publish_data(
                data.encode("utf-8"),
                reliable=True,
            )
            logger.info(f"Sent transcription [{role}]: {text[:50]}...")
        except Exception as e:
            logger.warning(f"Failed to send transcription: {e}")

    async def on_enter(self):
        await self.session.generate_reply(
            instructions="""Greet the user and offer your assistance.""",
            allow_interruptions=True,
        )

    @function_tool(name="generate_interview")
    async def _http_tool_generate_interview(
        self, context: RunContext, role: str, type_: str, level: str, techstack: str, amount: str, userid: str
    ) -> str | None:
        """
        Generate interview questions based on user details

        Args:
            role: what role would you like to train for
            type: are you aiming for technical, mixed or behavioral interview?
            level: the job experience level
            techstack: the list of technologies to cover during the job interview
            amount: how many questions would you like me to prepare
            userid: tell me your userid
        """

        context.disallow_interruptions()

        url = "https://auto-inter.vercel.app/api/vapi/generate"
        headers = {
            "Content-Type": "application/json",
        }
        payload = {
            "role": role,
            "type": type_,
            "level": level,
            "techstack": techstack,
            "amount": amount,
            "userid": userid,
        }

        try:
            session = utils.http_context.http_session()
            timeout = aiohttp.ClientTimeout(total=10)
            async with session.post(url, timeout=timeout, headers=headers, json=payload) as resp:
                if resp.status >= 400:
                    raise ToolError(f"error: HTTP {resp.status}")
                text = await resp.text()
                # Send interview ID to client so it can link feedback/transcriptions
                try:
                    parsed = json.loads(text)
                    if parsed.get("success") and parsed.get("interviewId"):
                        msg = json.dumps({
                            "type": "interview_created",
                            "interviewId": parsed["interviewId"],
                            "timestamp": datetime.utcnow().isoformat(),
                        })
                        await self.room.local_participant.publish_data(msg.encode("utf-8"), reliable=True)
                        logger.info(f"Sent interview_created: {parsed['interviewId']}")
                except (json.JSONDecodeError, KeyError):
                    pass
                return text
        except ToolError:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            raise ToolError(f"error: {e!s}") from e


server = AgentServer()

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

server.setup_fnc = prewarm

@server.rtc_session(agent_name="Blake-1c1b")
async def entrypoint(ctx: JobContext):
    # Create agent instance with room reference
    agent = DefaultAgent(room=ctx.room)
    
    session = AgentSession(
        stt=inference.STT(model="assemblyai/universal-streaming", language="en"),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
            language="en"
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Hook into user speech to send transcriptions
    async def handle_user_speech(text: str):
        if text and text.strip():
            await agent.send_transcription("user", text)
            logger.info(f"User said: {text}")

    # Hook into agent responses to send transcriptions  
    async def handle_agent_speech(text: str):
        if text and text.strip():
            await agent.send_transcription("agent", text)
            logger.info(f"Agent said: {text}")

    # Override session callbacks to capture transcriptions
    original_user_speech = getattr(session, 'on_user_speech_committed', None)
    if original_user_speech:
        async def wrapped_user_speech(text: str):
            await handle_user_speech(text)
            if callable(original_user_speech):
                await original_user_speech(text)
        session.on_user_speech_committed = wrapped_user_speech
    
    # Also hook into agent's response generation
    # We'll send transcriptions when the agent generates replies
    original_generate_reply = session.generate_reply
    async def wrapped_generate_reply(*args, **kwargs):
        result = await original_generate_reply(*args, **kwargs)
        # The result contains the generated text
        if hasattr(result, 'text') and result.text:
            await handle_agent_speech(result.text)
        return result
    session.generate_reply = wrapped_generate_reply
    
    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )


if __name__ == "__main__":
    cli.run_app(server)
