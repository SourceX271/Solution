import logging
from typing import List, Dict

from bs4 import BeautifulSoup

from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class StackOverflowBlogSource(BaseSource):
    name = "stackoverflow_blog"
    base_url = "https://stackoverflow.blog"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches recent articles from the Stack Overflow blog."""
        try:
            logger.info("Fetching %s", self.base_url)
            resp = self.client.get(self.base_url)
            resp.raise_for_status()
        except Exception:
            logger.exception("Stack Overflow blog request failed")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []
        for article in soup.select("article")[:limit]:
            try:
                title_el = article.select_one("h2, h3, .title, a[href]")
                link_el = article.select_one("a[href]")
                excerpt_el = article.select_one("p, .excerpt, .description")

                title = title_el.get_text(strip=True) if title_el else ""
                source_url = link_el.get("href") if link_el else ""
                if source_url and not source_url.startswith("http"):
                    source_url = self.base_url.rstrip("/") + "/" + source_url.lstrip("/")
                content = excerpt_el.get_text(strip=True) if excerpt_el else ""

                if title:
                    results.append({
                        "title": title,
                        "content": content,
                        "source_url": source_url,
                        "tags": ["stackoverflow", "blog"],
                    })
            except Exception:
                logger.exception("Failed to parse Stack Overflow blog article")
                continue

        self._delay()
        return results
