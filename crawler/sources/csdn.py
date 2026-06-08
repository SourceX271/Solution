import logging
from typing import List, Dict

from bs4 import BeautifulSoup

from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class CsdnSource(BaseSource):
    name = "csdn"
    base_url = "https://blog.csdn.net"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches articles from the CSDN AI listing page."""
        url = f"{self.base_url}/nav/ai"
        try:
            logger.info("Fetching %s", url)
            resp = self.client.get(url)
            resp.raise_for_status()
        except Exception:
            logger.exception("CSDN request failed")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        for item in soup.select("a[href]")[:limit * 4]:
            try:
                href = item.get("href", "")
                title = item.get_text(strip=True)
                if not href or not title or len(title) < 4:
                    continue
                if "/article/" in href or "/p/" in href:
                    if not href.startswith("http"):
                        href = self.base_url.rstrip("/") + "/" + href.lstrip("/")
                    results.append({
                        "title": title,
                        "content": title,
                        "source_url": href,
                        "tags": ["csdn", "ai"],
                    })
                if len(results) >= limit:
                    break
            except Exception:
                continue

        self._delay()
        return results
