export function createSearchBar(
  container: HTMLElement,
  onFilter: (text: string) => void
) {
  container.innerHTML = "";
  container.className = "search-bar";
  container.style.display = "none";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search rows...";
  input.className = "search-input";

  const closeBtn = document.createElement("button");
  closeBtn.className = "toolbar-btn search-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.title = "Close search";

  input.addEventListener("input", () => {
    onFilter(input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hide();
    }
  });

  closeBtn.addEventListener("click", hide);

  container.appendChild(input);
  container.appendChild(closeBtn);

  let visible = false;

  function show() {
    container.style.display = "flex";
    visible = true;
    input.focus();
    input.select();
  }

  function hide() {
    container.style.display = "none";
    visible = false;
    input.value = "";
    onFilter("");
  }

  function toggle() {
    if (visible) {
      hide();
    } else {
      show();
    }
  }

  return { show, hide, toggle };
}
