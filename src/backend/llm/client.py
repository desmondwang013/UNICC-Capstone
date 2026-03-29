"""
Model-agnostic LLM client.

Supports three modes:
  - Anthropic Claude   (provider="anthropic")
  - OpenAI / ChatGPT   (provider="openai")
  - Local SLM via Ollama or any OpenAI-compatible server (provider="local_slm")

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
        """
        Build a client from an LLMConfig object.
        Falls back to environment variables if config is None.
        """
        provider = (config.provider.value if config else None) or os.getenv("LLM_PROVIDER", "anthropic")
        model    = (config.model       if config else None) or os.getenv("LLM_MODEL", "claude-sonnet-4-6")
        api_key  = (config.api_key     if config else None)
        base_url = (config.base_url    if config else None)

        self.provider = provider
        self.model    = model

        if provider == "anthropic":
            import anthropic
            self._client = anthropic.Anthropic(
                api_key=api_key or os.getenv("ANTHROPIC_API_KEY")
            )

        elif provider in ("openai", "local_slm"):
            import openai
            self._client = openai.OpenAI(
                api_key=api_key or os.getenv("OPENAI_API_KEY") or "ollama",
                base_url=base_url or os.getenv("OPENAI_BASE_URL") or (
                    "http://localhost:11434/v1" if provider == "local_slm" else None
                ),
            )

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

    # ------------------------------------------------------------------
    # Core call
    # ------------------------------------------------------------------

    async def complete(
        self,
        system: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> str:
        if self.provider == "anthropic":
            response = self._client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system,
                messages=messages,
            )
            return response.content[0].text

        elif self.provider in ("openai", "local_slm"):
            msgs = [{"role": "system", "content": system}] + messages
            response = self._client.chat.completions.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=msgs,
            )
            return response.choices[0].message.content

        raise ValueError(f"Unsupported provider: {self.provider}")

    # ------------------------------------------------------------------
    # JSON helper
    # ------------------------------------------------------------------

    async def complete_json(
        self,
        system: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        system_with_json = (
            system
            + "\n\nIMPORTANT: Your entire response must be valid JSON only. "
            "Do not include markdown code fences, explanation, or any text "
            "outside the JSON object."
        )
        raw = await self.complete(system_with_json, messages, max_tokens, temperature)

        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        return json.loads(raw)


# ------------------------------------------------------------------
# Factory — builds the right client from an optional LLMConfig
# ------------------------------------------------------------------

def get_client(config: "Optional[LLMConfig]" = None) -> LLMClient:
    """
    Returns an LLMClient for the given config.
    If config is None, reads from environment variables.
    """
    return LLMClient(config)
