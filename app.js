import { engine } from "./engine.js";
import { resolveInput, formatForDisplay } from "./url.js";
import * as settings from "./settings.js";
import { TabManager } from "./tabs.js";
import * as visitLog from "./history.js";
import * as bookmarks from "./bookmarks.js";
import * as internal from "./internal.js";
import { registerInternalPages } from "./internal-pages.js";
import { applyCloak } from "./cloak.js";
const $ = (selector) => document.querySelector(selector);
const addressBar = $("#address");
const frames = $("#frames");
const status = $("#status");
let addressBarFocused = false;
addressBar.addEventListener("focus", () => (addressBarFocused = true));
addressBar.addEventListener("blur", () => (addressBarFocused = false));
registerInternalPages();
const tabs = new TabManager(frames);
const tabStrip = $("#tabs");
tabs.onChange(() => render());
const currentSession = () => tabs.active?.session ?? null;
const currentUrl = () => tabs.active?.url ?? "";
const currentTitle = () => tabs.active?.title ?? "";
const isLoading = () => tabs.active?.loading ?? false;
const canGoBack = () => tabs.active?.canGoBack ?? false;
const canGoForward = () => tabs.active?.canGoForward ?? false;
const goBack = () => tabs.active?.back() ?? null;
const goForward = () => tabs.active?.forward() ?? null;
const renderTabs = () => {
    const nodes = tabs.tabs.map(tab => {
        const el = document.createElement("div");
        el.className = tab.id === tabs.activeId ? "tab tab--active" : "tab";
        el.setAttribute("role", "tab");
        el.setAttribute("aria-selected", String(tab.id === tabs.activeId));
        el.tabIndex = 0;
        const label = document.createElement("span");
        label.className = "tab__label";
        label.textContent = tab.loading ? "loading" : tab.title;
        label.title = tab.url || tab.title;
        const close = document.createElement("button");
        close.className = "tab__close";
        close.type = "button";
        close.setAttribute("aria-label", `Close ${tab.title}`);
        close.textContent = "x";
        close.addEventListener("click", event => {
            event.stopPropagation();
            tabs.close(tab.id);
        });
        el.append(label, close);
        el.addEventListener("click", () => tabs.select(tab.id));
        el.addEventListener("keydown", event => {
            switch (event.key) {
                case "Enter":
                case " ":
                    event.preventDefault();
                    tabs.select(tab.id);
                    break;
            }
        });
        el.addEventListener("auxclick", event => {
            if (event.button === 1) {
                event.preventDefault();
                tabs.close(tab.id);
            }
        });
        return el;
    });
    const add = document.createElement("button");
    add.type = "button";
    add.setAttribute("aria-label", "New tab");
    add.title = "New tab";
    add.textContent = "+";
    add.addEventListener("click", () => {
        tabs.open();
        void navigate(startUrl());
        addressBar.focus();
    });
    tabStrip.replaceChildren(...nodes, add);
};
const startUrl = () => {
    const configured = settings.get("homeUrl");
    if (configured)
        return configured;
    return "";
};
const searchTemplate = () => {
    return settings.get("searchEngine");
};
const navigate = async (input, options = {}) => {
    const { url, kind } = resolveInput(input, searchTemplate());
    switch (kind) {
        case "empty":
            return;
        case "blocked":
            setStatus("That address cannot be opened through the proxy.");
            return;
        case "external":
            location.assign(url);
            return;
        default: {
            setStatus("");
            const tab = tabs.active ?? tabs.open();
            if (options.record === false) {
                tab.url = url;
                tab.element.removeAttribute("srcdoc");
                await tab.ensureSession();
                tab.session.go(url);
                tabs.emit();
            }
            else {
                await tab.go(url);
            }
        }
    }
};
const popup = $("#popup");
const popupFrame = $("#popup-frame");
const popupTitle = $("#popup-title");
const popupClose = $("#popup-close");
const popupBackground = [...popup.parentElement.children].filter((element) => element instanceof HTMLElement && element !== popup);
let popupPage = "";
const popupFocusables = () => [
    ...popupFrame.contentDocument.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')
].filter(element => !element.hidden);
let popupTrigger = null;
const closePopup = () => {
    popup.hidden = true;
    for (const element of popupBackground)
        element.inert = false;
    popupTrigger?.focus();
};
const openPopup = (name, trigger = null) => {
    popupTrigger = trigger;
    const html = internal.render(`${internal.scheme}://${name}`);
    if (html === null)
        return;
    popupPage = name;
    popupTitle.textContent = name;
    popupFrame.title = name;
    const doc = popupFrame.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    doc.addEventListener("keydown", event => {
        if (event.key === "Escape")
            closePopup();
        if (event.key !== "Tab")
            return;
        const focusable = popupFocusables();
        const edge = event.shiftKey ? focusable[0] : focusable.at(-1);
        if (!edge || doc.activeElement === edge) {
            event.preventDefault();
            popupClose.focus();
        }
    });
    for (const element of popupBackground)
        element.inert = true;
    popup.hidden = false;
    popupClose.focus();
};
popupClose.addEventListener("click", closePopup);
popupClose.addEventListener("keydown", event => {
    if (event.key !== "Tab")
        return;
    const focusable = popupFocusables();
    const target = event.shiftKey ? focusable.at(-1) : focusable[0];
    if (!target)
        return;
    event.preventDefault();
    target.focus();
});
popup.addEventListener("click", event => {
    if (event.target === popup)
        closePopup();
});
addEventListener("keydown", event => {
    if (event.key === "Escape" && !popup.hidden)
        closePopup();
});
const refreshPopup = () => openPopup(popupPage);
addEventListener("message", event => {
    if (event.origin !== location.origin)
        return;
    const fromPopup = event.source === popupFrame.contentWindow;
    if (!fromPopup)
        return;
    const data = event.data;
    if (!data || typeof data !== "object")
        return;
    switch (data.type) {
        case "internal:open":
            if (typeof data.url === "string") {
                closePopup();
                void navigate(data.url);
            }
            break;
        case "internal:settings": {
            if (!data.patch || typeof data.patch !== "object")
                break;
            const { rejected, persisted } = settings.set(data.patch);
            const saved = persisted
                ? "Saved."
                : "Applied for this session, but browser storage is unavailable.";
            setStatus(rejected.length
                ? `${saved} Invalid values reset: ${rejected.join(", ")}.`
                : saved);
            applyCloak();
            refreshPopup();
            break;
        }
        case "internal:action":
            switch (data.action) {
                case "clear-history":
                    setStatus(visitLog.clear()
                        ? "History cleared."
                        : "History cleared for this session, but browser storage is unavailable.");
                    refreshPopup();
                    break;
                case "reset-settings":
                    const { persisted } = settings.reset();
                    applyCloak();
                    setStatus(persisted
                        ? "Settings reset."
                        : "Reset for this session, but browser storage is unavailable.");
                    refreshPopup();
                    break;
            }
            break;
        case "internal:popup-blocked":
            setStatus("The browser blocked the popup.");
            break;
    }
});
const render = () => {
    renderTabs();
    const url = currentUrl();
    if (!addressBarFocused)
        addressBar.value = url ? formatForDisplay(url) : "";
    $("#back").disabled = !canGoBack();
    $("#forward").disabled = !canGoForward();
    $("#reload").disabled = !currentSession();
    const star = $("#bookmark");
    const bookmarkable = /^https?:/i.test(url);
    star.disabled = !bookmarkable;
    star.setAttribute("aria-pressed", String(bookmarkable ? bookmarks.has(url) : false));
    if (isLoading())
        setStatus("Loading");
    else if (status.textContent === "Loading")
        setStatus("");
};
const setStatus = (message) => {
    status.textContent = message ?? "";
    status.hidden = !message;
};
$("#omnibox").addEventListener("submit", event => {
    event.preventDefault();
    addressBar.blur();
    void navigate(addressBar.value);
});
$("#back").addEventListener("click", () => {
    const url = goBack();
    if (url)
        void navigate(url, { record: false });
});
$("#forward").addEventListener("click", () => {
    const url = goForward();
    if (url)
        void navigate(url, { record: false });
});
$("#reload").addEventListener("click", () => currentSession()?.reload());
const menu = $("#menu");
const menuToggle = $("#menu-toggle");
const menuRoot = menu;
const closeMenu = () => {
    menu.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
};
menuToggle.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    menuToggle.setAttribute("aria-expanded", String(!menu.hidden));
});
for (const button of menuRoot.querySelectorAll("[data-open]")) {
    button.addEventListener("click", () => {
        closeMenu();
        void navigate(button.dataset.open);
    });
}
for (const button of menuRoot.querySelectorAll("[data-popup]")) {
    button.addEventListener("click", () => {
        closeMenu();
        openPopup(button.dataset.popup, button);
    });
}
$("#bookmark").addEventListener("click", () => {
    const url = currentUrl();
    if (!/^https?:/i.test(url))
        return;
    bookmarks.toggle(url, currentTitle());
    render();
});
bookmarks.onChange(() => render());
applyCloak();
addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey))
        return;
    switch (event.key) {
        case "l":
            event.preventDefault();
            addressBar.focus();
            addressBar.select();
            break;
        case "t":
            event.preventDefault();
            tabs.open();
            void navigate(startUrl());
            addressBar.focus();
            break;
    }
});
tabs.open();
void navigate(startUrl());
