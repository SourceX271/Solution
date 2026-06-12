let hljsPromise: Promise<any> | null = null;

function getHljs(): Promise<any> {
  if (!hljsPromise) {
    hljsPromise = import("highlight.js").then(async (mod) => {
      const hljs = mod.default;
      // Import only the most common languages on-demand
      const languages: Record<string, () => Promise<any>> = {
        javascript: () => import("highlight.js/lib/languages/javascript"),
        typescript: () => import("highlight.js/lib/languages/typescript"),
        python: () => import("highlight.js/lib/languages/python"),
        css: () => import("highlight.js/lib/languages/css"),
        xml: () => import("highlight.js/lib/languages/xml"),
        bash: () => import("highlight.js/lib/languages/bash"),
        json: () => import("highlight.js/lib/languages/json"),
        sql: () => import("highlight.js/lib/languages/sql"),
        rust: () => import("highlight.js/lib/languages/rust"),
        go: () => import("highlight.js/lib/languages/go"),
        java: () => import("highlight.js/lib/languages/java"),
        c: () => import("highlight.js/lib/languages/c"),
        cpp: () => import("highlight.js/lib/languages/cpp"),
        csharp: () => import("highlight.js/lib/languages/csharp"),
        php: () => import("highlight.js/lib/languages/php"),
        ruby: () => import("highlight.js/lib/languages/ruby"),
        yaml: () => import("highlight.js/lib/languages/yaml"),
        markdown: () => import("highlight.js/lib/languages/markdown"),
        shell: () => import("highlight.js/lib/languages/shell"),
        dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
        nginx: () => import("highlight.js/lib/languages/nginx"),
        graphql: () => import("highlight.js/lib/languages/graphql"),
        kotlin: () => import("highlight.js/lib/languages/kotlin"),
        swift: () => import("highlight.js/lib/languages/swift"),
        scala: () => import("highlight.js/lib/languages/scala"),
      };

      for (const [lang, loader] of Object.entries(languages)) {
        try {
          const mod = await loader();
          hljs.registerLanguage(lang, (mod as any).default);
        } catch {
          // Language may fail to register in some environments
        }
      }

      return hljs;
    });
  }
  return hljsPromise;
}

/**
 * Highlight code on the server or client using highlight.js
 */
export async function highlightCode(code: string, language?: string): Promise<string> {
  const lang = language?.toLowerCase() || "";

  try {
    const hljs = await getHljs();
    if (lang && hljs.getLanguage(lang)) {
      const result = hljs.highlight(code.trim(), { language: lang });
      return result.value;
    }
    const result = hljs.highlightAuto(code.trim());
    return result.value;
  } catch {
    return code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

/**
 * Process HTML content to apply syntax highlighting to pre/code blocks.
 */
export async function highlightHtmlContent(html: string): Promise<string> {
  const hljs = await getHljs();

  return html.replace(
    /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match: string, lang: string | undefined, code: string) => {
      const decoded = code
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"');
      try {
        let highlighted: string;
        if (lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(decoded.trim(), { language: lang }).value;
        } else {
          highlighted = hljs.highlightAuto(decoded.trim()).value;
        }
        const langLabel = lang ? ' language-' + lang : '';
        return '<pre><code class="hljs' + langLabel + '">' + highlighted + '</code></pre>';
      } catch {
        return '<pre><code>' + decoded + '</code></pre>';
      }
    }
  );
}
