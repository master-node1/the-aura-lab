"""
AI Service — Redis consumer worker + optional HTTP health endpoint.
Subscribes to soulsync:ai:process, runs the agent pipeline,
publishes response to soulsync:ai:response.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI

from config import settings
from pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

AI_PROCESS_CHANNEL = "soulsync:ai:process"
AI_RESPONSE_CHANNEL = "soulsync:ai:response"


async def redis_worker():
    """Subscribe to AI_PROCESS and publish responses to AI_RESPONSE."""
    pub = aioredis.from_url(settings.redis_url, decode_responses=True)
    sub = aioredis.from_url(settings.redis_url, decode_responses=True)

    pubsub = sub.pubsub()
    await pubsub.subscribe(AI_PROCESS_CHANNEL)
    logger.info(f"AI service subscribed to {AI_PROCESS_CHANNEL}")

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        try:
            payload = json.loads(message["data"])
            logger.info(f"Processing message for user={payload.get('userId')}")

            result = await run_pipeline(payload)

            await pub.publish(AI_RESPONSE_CHANNEL, json.dumps(result))
            logger.info(f"Published response for user={payload.get('userId')}")
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(redis_worker())
    logger.info("AI service ready")
    yield
    task.cancel()


app = FastAPI(title="SoulSync AI Service", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}
