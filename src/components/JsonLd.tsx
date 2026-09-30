/**
 * Serialise structured data for a <script type="application/ld+json"> tag.
 *
 * JSON.stringify does not escape `<`, so a title/description containing
 * `</script><script>…</script>` would close the tag and inject markup
 * (stored XSS). Escape the HTML-sensitive characters to a JSON-escaped form,
 * which parsers decode back to the original text.
 */
function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function ArticleJsonLd({
  title,
  description,
  authorName,
  datePublished,
  dateModified,
  url,
}: {
  title: string;
  description?: string | null;
  authorName: string;
  datePublished: string;
  dateModified: string;
  url: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: description || title,
    author: {
      "@type": "Person",
      name: authorName,
    },
    datePublished,
    dateModified,
    url,
    publisher: {
      "@type": "Organization",
      name: "Solution",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
    />
  );
}

export function SoftwareJsonLd({
  name,
  description,
  rating,
  ratingCount,
  url,
}: {
  name: string;
  description: string;
  rating: number;
  ratingCount: number;
  url: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory: "DeveloperApplication",
    aggregateRating: ratingCount > 0 ? {
      "@type": "AggregateRating",
      ratingValue: rating.toFixed(1),
      ratingCount,
    } : undefined,
    url,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
    />
  );
}
