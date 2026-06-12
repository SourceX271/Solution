import logging
from typing import List, Dict
from bs4 import BeautifulSoup
from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class HashnodeSource(BaseSource):
    name = "hashnode"
    base_url = "https://hashnode.com"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches recent articles from Hashnode community feed."""
        url = f"{self.base_url}/community"
        try:
            logger.info("Fetching Hashnode: %s", url)
            resp = self._get(url)
        except Exception:
            logger.exception("Hashnode request failed")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        for card in soup.select("article, .post-card, [data-testid='post-card']")[:limit * 2]:
            try:
                title_el = card.select_one("h2, h3, a[href]")
                link_el = card.select_one("a[href]")
                desc_el = card.select_one("p, .description")
                author_el = card.select_one(".author, [data-testid='author-name']")

                title = title_el.get_text(strip=True) if title_el else ""
                href = link_el.get("href", "") if link_el else ""
                desc = desc_el.get_text(strip=True) if desc_el else ""
                author = author_el.get_text(strip=True) if author_el else ""

                if not title or len(title) < 5:
                    continue

                source_url = href
                if source_url and not source_url.startswith("http"):
                    source_url = self.base_url + source_url

                results.append({
                    "title": title,
                    "content": desc or title,
                    "source_url": source_url,
                    "tags": ["hashnode", "community"],
                    "category": "tech",
                    "author": author,
                })

                if len(results) >= limit:
                    break
            except Exception:
                continue

        self._delay()
        return results
