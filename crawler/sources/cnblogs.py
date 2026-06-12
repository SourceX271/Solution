import logging
from typing import List, Dict
from bs4 import BeautifulSoup
from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class CnblogsSource(BaseSource):
    name = "cnblogs"
    base_url = "https://www.cnblogs.com"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches featured articles from 博客园 pick page."""
        url = f"{self.base_url}/pick/"
        try:
            logger.info("Fetching Cnblogs: %s", url)
            resp = self._get(url)
        except Exception:
            logger.exception("Cnblogs request failed")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        for item in soup.select(".post_item, .post-item, article")[:limit * 2]:
            try:
                title_el = item.select_one("h2 a, h3 a, .title a, a.title")
                excerpt_el = item.select_one(
                    ".post_item_summary, .post-item-summary, .entry-summary, p"
                )

                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                href = title_el.get("href", "")
                content = excerpt_el.get_text(strip=True) if excerpt_el else title

                if not href.startswith("http"):
                    href = self.base_url.rstrip("/") + "/" + href.lstrip("/")

                results.append({
                    "title": title,
                    "content": content,
                    "source_url": href,
                    "tags": ["cnblogs", "技术"],
                    "category": "tech",
                    "author": "",
                })
                if len(results) >= limit:
                    break
            except Exception:
                continue

        logger.info("Cnblogs: got %d articles", len(results))
        self._delay()
        return results
