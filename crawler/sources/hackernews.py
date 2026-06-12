import logging
from typing import List, Dict
from bs4 import BeautifulSoup
from crawler.sources.base import BaseSource

logger = logging.getLogger(__name__)


class HackerNewsSource(BaseSource):
    name = "hackernews"
    base_url = "https://news.ycombinator.com"

    def fetch(self, limit: int = 5) -> List[Dict]:
        """Fetches top stories from Hacker News front page."""
        try:
            logger.info("Fetching HackerNews: %s", self.base_url)
            resp = self._get(self.base_url)
        except Exception:
            logger.exception("HackerNews request failed")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        rows = soup.select("tr.athing")
        for row in rows[:limit * 2]:
            try:
                title_el = row.select_one("td.title .titleline > a")
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                source_url = title_el.get("href", "")

                # Get next row for metadata (points, comments)
                next_row = row.find_next_sibling("tr")
                score_el = next_row.select_one(".score") if next_row else None
                score = score_el.get_text(strip=True) if score_el else ""

                if not title or len(title) < 3:
                    continue

                # Filter for tech-related content
                results.append({
                    "title": title,
                    "content": f"{title} (Hacker News - {score})",
                    "source_url": source_url if source_url.startswith("http") else f"{self.base_url}/{source_url}",
                    "tags": ["hackernews", "tech", "news"],
                    "category": "tech",
                    "author": "",
                })

                if len(results) >= limit:
                    break
            except Exception:
                continue

        logger.info("HackerNews: got %d stories", len(results))
        self._delay()
        return results
