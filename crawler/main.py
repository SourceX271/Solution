#!/usr/bin/env python3
"""Tech community article crawler.

Fetches articles from multiple tech community sites and outputs
JSON suitable for ingestion by the Node.js / Prisma backend.
"""
import argparse
import json
import sys
import logging

from crawler.sources.devto import DevToSource
from crawler.sources.stackoverflow_blog import StackOverflowBlogSource
from crawler.sources.csdn import CsdnSource
from crawler.sources.zhihu import ZhihuSource
from crawler.sources.cnblogs import CnblogsSource

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("crawler")

SOURCES = {
    "devto": DevToSource,
    "stackoverflow_blog": StackOverflowBlogSource,
    "csdn": CsdnSource,
    "zhihu": ZhihuSource,
    "cnblogs": CnblogsSource,
}


def run_source(source_name, source_cls, limit):
    logger.info("Running source: %s (limit=%d)", source_name, limit)
    try:
        instance = source_cls()
        articles = instance.fetch(limit=limit)
        logger.info("Source %s returned %d articles", source_name, len(articles))
        return articles
    except Exception:
        logger.exception("Source %s failed with unhandled error", source_name)
        return []


def main():
    parser = argparse.ArgumentParser(description="Tech community article crawler")
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Run only a specific source (e.g. devto, csdn). Omit to run all.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Max articles per source (default: 5)",
    )
    args = parser.parse_args()

    if args.source:
        if args.source not in SOURCES:
            logger.error("Unknown source: %s. Available: %s", args.source, list(SOURCES.keys()))
            output = {"status": "error", "message": f"Unknown source: {args.source}"}
            json.dump(output, sys.stdout, ensure_ascii=False)
            sys.exit(1)
        sources_to_run = [(args.source, SOURCES[args.source])]
    else:
        sources_to_run = list(SOURCES.items())

    all_results = []
    for name, cls in sources_to_run:
        articles = run_source(name, cls, args.limit)
        all_results.extend(articles)

    output = {
        "status": "success",
        "results": all_results,
        "total": len(all_results),
    }
    json.dump(output, sys.stdout, ensure_ascii=False)
    logger.info("Crawl complete. Total articles: %d", len(all_results))


if __name__ == "__main__":
    main()
