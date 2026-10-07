import { InputRule, Node, mergeAttributes, nodePasteRule } from "@tiptap/core";
import { renderLatex } from "@/lib/math";

/**
 * Tiptap nodes for LaTeX formulas.
 *
 * The LaTeX source is stored in a `data-latex` attribute, so it survives
 * save → load → edit: the reader expands it with KaTeX (`lib/math.ts`) and the
 * editor can reopen the same formula in its dialog. `$…$` / `$$…$$` typed by
 * hand are converted on the fly by input rules, and pasted formulas by paste
 * rules.
 */

export interface MathNodeOptions {
  /** Invoked on double-click (or Enter) so the host can open its edit dialog. */
  onEdit?: (latex: string, pos: number, displayMode: boolean) => void;
  HTMLAttributes: Record<string, unknown>;
}

interface MathNodeConfig {
  name: string;
  dataMath: "inline" | "block";
  tag: "span" | "div";
  displayMode: boolean;
}

function createMathNode(config: MathNodeConfig) {
  return Node.create<MathNodeOptions>({
    name: config.name,
    group: config.displayMode ? "block" : "inline",
    inline: !config.displayMode,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
      return { onEdit: undefined, HTMLAttributes: {} };
    },

    addAttributes() {
      return {
        latex: {
          default: "",
          parseHTML: (element) => element.getAttribute("data-latex") ?? "",
          renderHTML: (attributes) => ({ "data-latex": attributes.latex as string }),
        },
      };
    },

    parseHTML() {
      return [{ tag: `${config.tag}[data-math="${config.dataMath}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        config.tag,
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-math": config.dataMath,
          class: config.displayMode ? "math-block" : "math-inline",
        }),
      ];
    },

    addNodeView() {
      const { onEdit } = this.options;
      return ({ node, getPos, editor }) => {
        const dom = document.createElement(config.tag);
        dom.className = `math-node ${config.displayMode ? "math-block" : "math-inline"}`;
        dom.setAttribute("data-math", config.dataMath);
        dom.setAttribute("role", "button");
        dom.setAttribute("tabindex", "0");
        dom.contentEditable = "false";
        dom.title = node.attrs.latex;

        const paint = (latex: string) => {
          dom.setAttribute("data-latex", latex || "");
          dom.innerHTML = renderLatex(latex || "", config.displayMode);
        };
        paint(node.attrs.latex);

        const openEditor = () => {
          const pos = typeof getPos === "function" ? getPos() : undefined;
          if (typeof pos === "number") onEdit?.(node.attrs.latex, pos, config.displayMode);
        };
        // Typed as `Event` because the union element type ("span" | "div") makes
        // TypeScript fall back to the generic EventListener overload.
        const onDoubleClick = (event: Event) => {
          event.preventDefault();
          openEditor();
        };
        const onKeyDown = (event: Event) => {
          const key = (event as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            event.preventDefault();
            openEditor();
          }
        };

        dom.addEventListener("dblclick", onDoubleClick);
        dom.addEventListener("keydown", onKeyDown);

        return {
          dom,
          update: (updated) => {
            if (updated.type.name !== config.name) return false;
            node = updated;
            dom.title = updated.attrs.latex;
            paint(updated.attrs.latex);
            return true;
          },          // The KaTeX markup is ours, not the document's: never let ProseMirror
          // read a mutation back into the content.
          ignoreMutation: () => true,
          destroy: () => {
            dom.removeEventListener("dblclick", onDoubleClick);
            dom.removeEventListener("keydown", onKeyDown);
            void editor;
          },
        };
      };
    },

    addInputRules() {
      // A hand-written InputRule instead of `nodeInputRule`: the helper treats a
      // capture group specially (it re-inserts the last character of the match
      // as text), which left the leading `$` behind and added a trailing one.
      // Replacing the full match range keeps only the rendered node.
      //
      // The inline rule also refuses a `$` that follows another `$`: while
      // typing `$$x$$` the intermediate `$$x$` would otherwise match the inline
      // pattern and swallow the block formula before it is finished.
      const type = this.type;
      return [
        new InputRule({
          // No `^` anchor: `$$…$$` may be typed after a label on the same line.
          find: config.displayMode
            ? /(?<!\\)\$\$([^$]+)\$\$$/
            : /(?<!\$)(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s)\$$/,
          handler: ({ state, range, match }) => {
            const latex = (match[1] ?? "").trim();
            if (!latex) return;
            state.tr.replaceWith(range.from, range.to, type.create({ latex }));
          },
        }),
      ];
    },

    addPasteRules() {
      return [
        nodePasteRule({
          find: config.displayMode
            ? /(?<!\\)\$\$([^$]+?)\$\$/g
            : /(?<!\$)(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g,
          type: this.type,
          getAttributes: (match) => ({ latex: (match[1] ?? "").trim() }),
        }),
      ];
    },
  });
}

export const MathInline = createMathNode({
  name: "mathInline",
  dataMath: "inline",
  tag: "span",
  displayMode: false,
});

export const MathBlock = createMathNode({
  name: "mathBlock",
  dataMath: "block",
  tag: "div",
  displayMode: true,
});
