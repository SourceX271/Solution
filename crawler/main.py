#!/usr/bin/env python3
"""Tech community article crawler with retry, rate-limiting and parallel execution.

Fetches articles from multiple tech community sites and outputs
JSON suitable for ingestion by the Node.js / Prisma backend.
"""
import argparse
import json
import sys
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from crawler.sources.devto import DevToSource
from crawler.sources.stackoverflow_blog import StackOverflowBlogSource
from crawler.sources.csdn import CsdnSource
from crawler.sources.zhihu import ZhihuSource
from crawler.sources.cnblogs import CnblogsSource
from crawler.sources.hashnode import HashnodeSource
from crawler.sources.hackernews import HackerNewsSource

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("crawler")

SOURCES = {
    "devto": DevToSource,
    "stackoverflow_blog": StackOverflowBlogSource,
    "csdn": CsdnSource,
    "zhihu": ZhihuSource,
    "cnblogs": CnblogsSource,
    "hashnode": HashnodeSource,
    "hackernews": HackerNewsSource,
}


def run_source(source_name: str, source_cls, limit: int) -> dict:
    logger.info("Running source: %s (limit=%d)", source_name, limit)
    try:
        instance = source_cls()
        articles = instance.fetch(limit=limit)
        instance.close()
        logger.info("Source %s returned %d articles", source_name, len(articles))
        return {"source": source_name, "status": "ok", "articles": articles, "count": len(articles)}
    except Exception:
        logger.exception("Source %s failed", source_name)
        return {"source": source_name, "status": "error", "articles": [], "count": 0, "error": str(sys.exc_info()[1])}


def main():
    parser = argparse.ArgumentParser(
        description="Tech community article crawler - fetches articles from multiple tech sites"
    )
    parser.add_argument(
        "--source", type=str, default=None,
        help="Run only a specific source (e.g. devto, csdn). Omit to run all.",
    )
    parser.add_argument(
        "--limit", type=int, default=5,
        help="Max articles per source (default: 5, max: 50)",
    )
    parser.add_argument(
        "--parallel", action="store_true", default=True,
        help="Run sources in parallel (default: true)",
    )
    parser.add_argument(
        "--sequential", action="store_true",
        help="Run sources sequentially",
    )
    parser.add_argument(
        "--format", type=str, choices=["jsonl", "json"], default="json",
        help="Output format: json (array) or jsonl (one per line)",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List available sources",
    )
    args = parser.parse_args()

    if args.list:
        print("Available sources:", file=sys.stderr)
        for name, cls in SOURCES.items():
            print(f"  {name:25s} - {cls.base_url}", file=sys.stderr)
        return

    limit = min(max(1, args.limit), 50)

    if args.source:
        if args.source not in SOURCES:
            logger.error(
                "Unknown source: %s. Available: %s",
                args.source, list(SOURCES.keys()),
            )
            output = {"status": "error", "message": f"Unknown source: {args.source}"}
            json.dump(output, sys.stdout, ensure_ascii=False)
            sys.exit(1)
        sources_to_run = [(args.source, SOURCES[args.source])]
    else:
        sources_to_run = list(SOURCES.items())

    results = []
    use_parallel = args.parallel and not args.sequential and len(sources_to_run) > 1

    if use_parallel:
        logger.info("Running %d sources in parallel", len(sources_to_run))
        with ThreadPoolExecutor(max_workers=min(len(sources_to_run), 5)) as executor:
            futures = {
                executor.submit(run_source, name, cls, limit): name
                for name, cls in sources_to_run
            }
            for future in as_completed(futures):
                result = future.result()
                results.append(result)
                source = futures[future]
                total_found = sum(r["count"] for r in results)
                logger.info(
                    "[%d/%d] %s done, total articles so far: %d",
                    len(results), len(futures), source, total_found,
                )
    else:
        for name, cls in sources_to_run:
            result = run_source(name, cls, limit)
            results.append(result)

    all_articles = []
    for r in results:
        if r["status"] == "ok":
            all_articles.extend(r["articles"])

    output = {
        "status": "success",
        "sources_processed": len(results),
        "sources_succeeded": sum(1 for r in results if r["status"] == "ok"),
        "total": len(all_articles),
        "results": results if args.format == "json" else [],
        "articles": all_articles,
    }

    if args.format == "jsonl":
        for article in all_articles:
            json.dump(article, sys.stdout, ensure_ascii=False)
            sys.stdout.write("\n")
    else:
        json.dump(output, sys.stdout, ensure_ascii=False, indent=2)

    logger.info(
        "Crawl complete. %d sources, %d articles total.",
        output["sources_processed"], output["total"],
    )


if __name__ == "__main__":
    main()
