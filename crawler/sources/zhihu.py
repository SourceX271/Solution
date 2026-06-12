import logging
from typing import List, Dict
from bs4 import BeautifulSoup
from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class ZhihuSource(BaseSource):
    name = "zhihu"
    base_url = "https://www.zhihu.com"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches trending content from Zhihu hot list."""
        url = f"{self.base_url}/hot"
        try:
            logger.info("Fetching Zhihu: %s", url)
            resp = self._get(url)
        except Exception:
            logger.exception("Zhihu request failed")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        for card in soup.select("a[href]")[:limit * 4]:
            try:
                href = card.get("href", "")
                title_el = card.select_one("h2, h3, .HotItem-title, .RichContent-title")
                excerpt_el = card.select_one("p, .HotItem-excerpt, .RichContent-excerpt")

                title = title_el.get_text(strip=True) if title_el else card.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                source_url = href
                if source_url and not source_url.startswith("http"):
                    source_url = self.base_url.rstrip("/") + "/" + source_url.lstrip("/")
                content = excerpt_el.get_text(strip=True) if excerpt_el else title

                results.append({
                    "title": title,
                    "content": content,
                    "source_url": source_url,
                    "tags": ["zhihu", "hot"],
                    "category": "tech",
                    "author": "",
                })
                if len(results) >= limit:
                    break
            except Exception:
                continue

        logger.info("Zhihu: got %d items", len(results))
        self._delay()
        return results
