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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
