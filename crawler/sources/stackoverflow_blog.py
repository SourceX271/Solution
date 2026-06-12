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
            logger.info("Fetching Stack Overflow blog: %s", self.base_url)
            resp = self._get(self.base_url)
        except Exception:
            logger.exception("Stack Overflow blog request failed")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        for article in soup.select("article, .post, .blog-post")[:limit * 2]:
            try:
                title_el = article.select_one("h2, h3, .title, a[href]")
                link_el = article.select_one("a[href]")
                excerpt_el = article.select_one("p, .excerpt, .description, .summary")
                author_el = article.select_one(".author, .byline")

                title = title_el.get_text(strip=True) if title_el else ""
                source_url = link_el.get("href") if link_el else ""
                content = excerpt_el.get_text(strip=True) if excerpt_el else title
                author = author_el.get_text(strip=True) if author_el else ""

                if source_url and not source_url.startswith("http"):
                    source_url = self.base_url.rstrip("/") + "/" + source_url.lstrip("/")

                if title and len(title) > 5:
                    results.append({
                        "title": title,
                        "content": content,
                        "source_url": source_url,
                        "tags": ["stackoverflow", "blog", "engineering"],
                        "category": "tech",
                        "author": author,
                    })
                if len(results) >= limit:
                    break
            except Exception:
                logger.exception("Failed to parse Stack Overflow blog article")
                continue

        logger.info("Stack Overflow: got %d articles", len(results))
        self._delay()
        return results
