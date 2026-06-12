import logging
from typing import List, Dict
from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class DevToSource(BaseSource):
    name = "devto"
    base_url = "https://dev.to"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches top articles from the Dev.to API."""
        try:
            url = f"https://dev.to/api/articles?tag=computerscience&per_page={limit}"
            logger.info("Fetching Dev.to: %s", url)
            resp = self._get(url)
            data = resp.json()
        except Exception:
            logger.exception("Dev.to API request failed")
            return []

        results = []
        for item in data[:limit]:
            try:
                tag_list = item.get("tag_list", [])
                results.append({
                    "title": item.get("title", ""),
                    "content": item.get("description", "") or item.get("title", ""),
                    "source_url": item.get("url", ""),
                    "tags": tag_list if tag_list else ["devto", "programming"],
                    "category": "tech",
                    "author": item.get("user", {}).get("name", ""),
                })
            except Exception:
                logger.exception("Failed to parse Dev.to article")
                continue

        logger.info("Dev.to: got %d articles", len(results))
        self._delay()
        return results
