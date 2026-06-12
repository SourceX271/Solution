from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import httpx
import random
import time
import logging

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
]

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}

MAX_RETRIES = 3
RETRY_BACKOFF = 2.0
RETRY_STATUSES = {429, 500, 502, 503, 504}


class BaseSource(ABC):
    name: str = ""
    base_url: str = ""

    def __init__(self):
        self.client = httpx.Client(
            headers={
                "User-Agent": random.choice(USER_AGENTS),
                **DEFAULT_HEADERS,
            },
            timeout=30,
            follow_redirects=True,
            http2=True,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )

    def _delay(self, min_s: float = 1.0, max_s: float = 3.0):
        delay = random.uniform(min_s, max_s)
        logger.debug("Sleeping %.1fs", delay)
        time.sleep(delay)

    def _request_with_retry(self, url: str, method: str = "GET", **kwargs) -> httpx.Response:
        last_exception: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = self.client.request(method, url, **kwargs)
                if resp.status_code in RETRY_STATUSES:
                    raise httpx.HTTPStatusError(
                        f"{resp.status_code} {resp.reason_phrase}",
                        request=resp.request,
                        response=resp,
                    )
                resp.raise_for_status()
                return resp
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                last_exception = exc
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF ** (attempt - 1)
                    logger.warning(
                        "Request to %s failed (attempt %d/%d): %s. Retrying in %.1fs...",
                        url, attempt, MAX_RETRIES, exc, wait,
                    )
                    time.sleep(wait)
                    self.client.headers["User-Agent"] = random.choice(USER_AGENTS)
                else:
                    logger.error(
                        "All %d retries exhausted for %s: %s",
                        MAX_RETRIES, url, exc,
                    )

        raise last_exception or RuntimeError(f"Failed to fetch {url}")

    def _get(self, url: str, **kwargs) -> httpx.Response:
        return self._request_with_retry(url, method="GET", **kwargs)

    def _post(self, url: str, **kwargs) -> httpx.Response:
        return self._request_with_retry(url, method="POST", **kwargs)

    def close(self):
        self.client.close()

    @abstractmethod
    def fetch(self, limit: int = 5) -> List[Dict]:
        """Returns list of {title, content, source_url, tags, category, author}"""
        pass
