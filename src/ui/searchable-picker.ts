// Reusable searchable + category-filterable single-select picker (R62.1). Used for the
// ailment picker and (M15) the treatment-plan picker. Inline (no nested sheet needed):
// a search box, optional category chips, and a scrollable list with the selection marked.

import { el } from "./dom.js";

export interface PickerItem {
  id: string;
  name: string;
  category?: string;
}

export interface SearchablePicker {
  el: HTMLElement;
  getValue(): string | undefined;
  setItems(items: PickerItem[], selectedId?: string): void;
}

export function searchablePicker(opts: {
  items: PickerItem[];
  selectedId?: string;
  placeholder?: string;
  noneLabel?: string;
  onChange?: (id: string | undefined) => void;
}): SearchablePicker {
  let items = opts.items;
  let selectedId = opts.selectedId;
  let query = "";
  let category = "all";

  const search = el("input", {
    type: "search",
    placeholder: opts.placeholder ?? "Search…",
    oninput: (e: Event) => { query = (e.target as HTMLInputElement).value; renderList(); },
  }) as HTMLInputElement;

  const chipRow = el("div", { class: "chips-scroll", style: "margin-top:8px" }, []);
  const list = el("div", { class: "picker-list" }, []);

  const categories = (): string[] => {
    const set = new Set<string>();
    for (const it of items) if (it.category) set.add(it.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  };

  const renderChips = () => {
    const cats = categories();
    if (!cats.length) { chipRow.replaceChildren(); return; }
    const chips = [{ key: "all", label: "All" }, ...cats.map((c) => ({ key: c, label: c }))];
    chipRow.replaceChildren(...chips.map((c) =>
      el("button", {
        type: "button",
        class: "chip" + (category === c.key ? " active" : ""),
        onclick: () => { category = c.key; renderChips(); renderList(); },
      }, [c.label])));
  };

  const rowEl = (id: string | undefined, label: string, selected: boolean): HTMLElement =>
    el("button", {
      type: "button",
      class: "picker-row" + (selected ? " sel" : ""),
      onclick: () => { selectedId = id; opts.onChange?.(id); renderList(); },
    }, [label]);

  const renderList = () => {
    const q = query.trim().toLowerCase();
    const filtered = items
      .filter((it) => (category === "all" || it.category === category) && (!q || it.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const rows: Node[] = [rowEl(undefined, opts.noneLabel ?? "None", selectedId === undefined)];
    for (const it of filtered) rows.push(rowEl(it.id, it.name, it.id === selectedId));
    if (!filtered.length && q) rows.push(el("div", { class: "picker-empty" }, ["No matches."]));
    list.replaceChildren(...rows);
  };

  renderChips();
  renderList();

  return {
    el: el("div", { class: "picker" }, [search, chipRow, list]),
    getValue: () => selectedId,
    setItems(newItems: PickerItem[], newSelected?: string) {
      items = newItems;
      if (newSelected !== undefined) selectedId = newSelected;
      renderChips();
      renderList();
    },
  };
}
