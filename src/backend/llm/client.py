"""
Model-agnostic async LLM client.

Supports three modes:
  - Anthropic Claude   (provider="anthropic")
  - OpenAI / ChatGPT   (provider="openai")
  - Local SLM via Ollama or any OpenAI-compatible server (provider="local_slm")

Uses async SDK clients so asyncio.gather() achieves true parallelism.
Config priority: per-request LLMConfig > .env variables
API keys are never stored — used for the request lifetime only.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from models import LLMConfig


class LLMClient:
    def __init__(self, config: "Optional[LLMConfig]" = None):
        provider = (config.provider.value if config else None) or os.getenv("LLM_PROVIDER", "anthropic")
        model    = (config.model       if config else None) or os.getenv("LLM_MODEL", "claude-sonnet-4-6")
        api_key  = (config.api_key     if config else None)
        base_url = (config.base_url    if config else None)

        self.provider = provider
        self.model    = model

        if provider == "anthropic":
            import anthropic
            self._client = anthropic.AsyncAnthropic(
                api_key=api_key or os.getenv("ANTHROPIC_API_KEY")
            )

        elif provider in ("openai", "local_slm"):
            import openai
            self._client = openai.AsyncOpenAI(
                api_key=api_key or os.getenv("OPENAI_API_KEY") or "ollama",
                base_url=base_url or os.getenv("OPENAI_BASE_URL") or (
                    "http://localhost:11434/v1" if provider == "local_slm" else None
                ),
            )

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

    async def complete(
        self,
        system: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> str:
        if self.provider == "anthropic":
            response = await self._client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system,
                messages=messages,
            )
            return response.content[0].text

        elif self.provider in ("openai", "local_slm"):
            msgs = [{"role": "system", "content": system}] + messages
            response = await self._client.chat.completions.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=msgs,
            )
            return response.choices[0].message.content

        raise ValueError(f"Unsupported provider: {self.provider}")

    async def complete_json(
        self,
        system: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        import logging as _logging
        import re as _re
        _log = _logging.getLogger("safety_lab")

        json_instruction = (
            "\n\nIMPORTANT: Your entire response must be valid JSON only. "
            "Do not include markdown code fences, explanation, or any text "
            "outside the JSON object."
        )
        system_with_json = system + json_instruction

        # For Qwen3 and other thinking-mode models, /no_think must go at the
        # start of the last user message (not in system prompt) to take effect
        patched_messages = list(messages)
        if self.provider == "local_slm" and patched_messages:
            last = patched_messages[-1]
            if last.get("role") == "user":
                patched_messages[-1] = {**last, "content": "/no_think\n\n" + last["content"]}

        raw = await self.complete(system_with_json, patched_messages, max_tokens, temperature)
        _log.info(f"  [RAW RESPONSE] first 300 chars: {repr(raw[:300])}")

        raw = raw.strip()

        # Strip Qwen3 / DeepSeek thinking blocks: <think>...</think>
        raw = _re.sub(r'<think>.*?</think>', '', raw, flags=_re.DOTALL).strip()

        # Strip markdown fences
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()

        # If still not starting with {, try to extract first {...} block
        if not raw.startswith("{"):
            m = _re.search(r'\{.*\}', raw, _re.DOTALL)
            if m:
                raw = m.group(0)

        if not raw:
            _log.error("  [RAW RESPONSE] was empty after stripping — full response logged above")
            raise ValueError("LLM returned an empty response — model may need more tokens or a simpler prompt.")

        return json.loads(raw)


def get_client(config: "Optional[LLMConfig]" = None) -> LLMClient:
    return LLMClient(config)
