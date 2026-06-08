import logging
from typing import List, Dict

from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class DevToSource(BaseSource):
    name = "devto"
    base_url = "https://dev.to"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches articles from the Dev.to API."""
        try:
            url = f"https://dev.to/api/articles?tag=computerscience&per_page={limit}"
            logger.info("Fetching %s", url)
            resp = self.client.get(url)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            logger.exception("Dev.to API request failed")
            return []

        results = []
        for item in data[:limit]:
            try:
                results.append({
                    "title": item.get("title", ""),
                    "content": item.get("description", ""),
                    "source_url": item.get("url", ""),
                    "tags": item.get("tag_list", []),
                })
            except Exception:
                logger.exception("Failed to parse Dev.to article")
                continue

        self._delay()
        return results
