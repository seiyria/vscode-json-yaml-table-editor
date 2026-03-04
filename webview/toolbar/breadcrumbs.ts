import type { DrilldownPath } from "../../shared/tableTypes";

export interface BreadcrumbCallbacks {
  onNavigate: (level: number) => void;
}

export function createBreadcrumbs(
  container: HTMLElement,
  callbacks: BreadcrumbCallbacks
) {
  const bar = document.createElement("div");
  bar.className = "breadcrumb-bar";
  bar.style.display = "none";
  container.appendChild(bar);

  function update(path: DrilldownPath) {
    if (path.length === 0) {
      bar.style.display = "none";
      return;
    }

    bar.style.display = "flex";
    bar.innerHTML = "";

    // Root link
    const rootLink = document.createElement("span");
    rootLink.className = "breadcrumb-link";
    rootLink.textContent = "Root";
    rootLink.addEventListener("click", () => callbacks.onNavigate(0));
    bar.appendChild(rootLink);

    // Intermediate segments
    for (let i = 0; i < path.length; i++) {
      const sep = document.createElement("span");
      sep.className = "breadcrumb-separator";
      sep.textContent = " > ";
      bar.appendChild(sep);

      if (i < path.length - 1) {
        // Clickable intermediate
        const link = document.createElement("span");
        link.className = "breadcrumb-link";
        link.textContent = path[i].label;
        const level = i + 1;
        link.addEventListener("click", () => callbacks.onNavigate(level));
        bar.appendChild(link);
      } else {
        // Current level (bold, non-clickable)
        const current = document.createElement("span");
        current.className = "breadcrumb-current";
        current.textContent = path[i].label;
        bar.appendChild(current);
      }
    }
  }

  return { update };
}
