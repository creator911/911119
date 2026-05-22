const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const isMobilePreview = () => document.body.classList.contains("mobile-preview");

async function post(url, data) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "요청 실패");
  return json;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function messageHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function unreadLabel(count = 0) {
  const value = Number(count || 0);
  if (value <= 0) return "";
  return value > 99 ? "99+" : String(value);
}

function formatAdminPointDisplays() {
  $$('[data-admin-field="points"] span').forEach((span) => {
    const raw = span.textContent.replace(/,/g, "").trim();
    if (!raw || raw === "-") return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    span.textContent = Math.floor(value).toLocaleString();
  });
}

function setUnreadBadge(target, count = 0) {
  if (!target) return;
  const label = unreadLabel(count);
  target.textContent = label || "0";
  target.hidden = !label;
}

function showTopMessage(text, tone = "buy") {
  if (!text) return;
  let toast = $("#topMessage");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "topMessage";
    toast.className = "top-message";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.remove("is-sell", "is-buy");
  toast.classList.add(tone === "sell" ? "is-sell" : "is-buy");
  toast.classList.add("is-open");
  clearTimeout(showTopMessage.timer);
  showTopMessage.timer = setTimeout(() => toast.classList.remove("is-open"), 2600);
}

function showStoredTopMessage(raw) {
  try {
    const parsed = JSON.parse(raw);
    showTopMessage(parsed.text || parsed.message || "", parsed.tone);
  } catch {
    showTopMessage(raw);
  }
}

async function loadTopNotifications() {
  if (!document.body.dataset.user) return;
  const res = await fetch("/api/notifications");
  if (res.status === 401) {
    document.body.dataset.user = "";
    location.href = "/";
    return;
  }
  if (!res.ok) return;
  const { notifications = [] } = await res.json();
  notifications.forEach((item, index) => {
    setTimeout(() => showTopMessage(item.message, item.tone), index * 2900);
  });
}

const pendingTopMessage = sessionStorage.getItem("topMessage");
if (pendingTopMessage) {
  sessionStorage.removeItem("topMessage");
  requestAnimationFrame(() => showStoredTopMessage(pendingTopMessage));
}
loadTopNotifications().catch(() => {});
setInterval(() => loadTopNotifications().catch(() => {}), 3000);
formatAdminPointDisplays();

const focusChargeAccount = sessionStorage.getItem("focusChargeAccount");
if (focusChargeAccount) {
  sessionStorage.removeItem("focusChargeAccount");
  requestAnimationFrame(() => {
    $(".charge-account-check")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function initMobilePreviewGames() {
  const grid = $(".games-grid");
  if (!grid) return;
  if (grid.dataset.mobileGamesReady === "true") return;
  const cards = $$(".game-list-card", grid);
  if (!cards.length) return;
  grid.dataset.mobileGamesReady = "true";
  const countTarget = $("[data-mobile-game-count]");
  const filterInput = $("[data-mobile-game-filter]");
  const step = 48;
  let visibleLimit = step;
  let query = "";
  const more = document.createElement("button");
  more.type = "button";
  more.className = "mobile-games-more";
  grid.insertAdjacentElement("afterend", more);

  const update = () => {
    const matches = cards.filter((card) => !query || card.textContent.toLowerCase().includes(query));
    cards.forEach((card) => {
      const matched = matches.includes(card);
      const hiddenByLimit = matched && matches.indexOf(card) >= visibleLimit;
      card.hidden = !matched || hiddenByLimit;
    });
    const shown = Math.min(matches.length, visibleLimit);
    more.hidden = shown >= matches.length;
    more.textContent = `더보기 (${shown}/${matches.length})`;
    if (countTarget) {
      countTarget.textContent = query
        ? `${matches.length.toLocaleString()}개의 검색 결과`
        : `처음 ${shown.toLocaleString()}개만 보여줍니다. 검색하거나 더보기로 이어서 볼 수 있습니다.`;
    }
  };

  filterInput?.addEventListener("input", () => {
    query = filterInput.value.trim().toLowerCase();
    visibleLimit = step;
    update();
  });
  more.addEventListener("click", () => {
    visibleLimit += step;
    update();
  });
  update();
}

function initMobilePreviewCollisionGuards() {
  if (document.body.dataset.mobileCollisionReady === "true") return;
  document.body.dataset.mobileCollisionReady = "true";
  const widgets = $$("#chatWidget, #directChatWidget");
  const syncChatState = () => {
    document.body.classList.toggle("mobile-chat-open", widgets.some((item) => item.classList.contains("open")));
  };
  widgets.forEach((widget) => new MutationObserver(syncChatState).observe(widget, { attributes: true, attributeFilter: ["class"] }));
  syncChatState();

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!target.matches?.("input, textarea, select, [contenteditable='true']")) return;
    window.setTimeout(() => target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" }), 180);
  });
}

function initMobilePreviewSelects() {
  const select = $("select[name='phoneCarrier']");
  if (!select || select.dataset.mobileSelectReady === "true") return;
  select.dataset.mobileSelectReady = "true";
  const wrap = document.createElement("div");
  wrap.className = "mobile-select";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-select__button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const list = document.createElement("div");
  list.className = "mobile-select__list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  const syncButton = () => {
    button.textContent = select.options[select.selectedIndex]?.textContent || select.value || "";
  };
  [...select.options].forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mobile-select__option";
    item.textContent = option.textContent;
    item.dataset.value = option.value;
    item.setAttribute("role", "option");
    item.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncButton();
      list.hidden = true;
      wrap.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    });
    list.appendChild(item);
  });
  button.addEventListener("click", () => {
    const open = list.hidden;
    list.hidden = !open;
    wrap.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
  });
  select.addEventListener("change", syncButton);
  select.insertAdjacentElement("afterend", wrap);
  wrap.append(button, list);
  syncButton();
  document.addEventListener("click", (event) => {
    if (wrap.contains(event.target)) return;
    list.hidden = true;
    wrap.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  });
}

function initMobilePreviewUx() {
  if (!isMobilePreview()) return;
  initMobilePreviewGames();
  initMobilePreviewCollisionGuards();
  initMobilePreviewSelects();
}

initMobilePreviewUx();
window.addEventListener("itemzone:mobile-preview-change", initMobilePreviewUx);

document.addEventListener("mousedown", (event) => {
  if (event.target.closest(".trade-editor-toolbar button")) event.preventDefault();
});

const chatImageSources = new Map();

function openImagePreview(src, name = "") {
  let viewer = $("#chatImageViewer");
  if (!viewer) {
    viewer = document.createElement("div");
    viewer.id = "chatImageViewer";
    viewer.className = "chat-image-viewer";
    viewer.innerHTML = `<button type="button" aria-label="닫기">×</button><img alt="">`;
    document.body.appendChild(viewer);
    $("button", viewer).addEventListener("click", () => viewer.classList.remove("open"));
    viewer.addEventListener("click", (event) => {
      if (event.target === viewer) viewer.classList.remove("open");
    });
  }
  const img = $("img", viewer);
  img.src = src;
  img.alt = name;
  viewer.classList.add("open");
}

function openAdminIpModal(info = {}) {
  let modal = $("#adminIpModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "adminIpModal";
    modal.className = "admin-ip-modal-layer";
    document.body.appendChild(modal);
  }
  const lastIp = info.lastIp || "";
  const lastAt = info.lastIpAt ? new Date(info.lastIpAt).toLocaleString("ko-KR") : "-";
  const history = (info.ipHistory || []).map((item) => `<li><b>${escapeHtml(item.ip)}</b><span>${item.at ? new Date(item.at).toLocaleString("ko-KR") : "-"}</span></li>`).join("");
  modal.innerHTML = `<section class="admin-ip-modal" role="dialog" aria-modal="true" aria-labelledby="adminIpModalTitle">
    <h2 id="adminIpModalTitle">회원 IP 정보</h2>
    <dl>
      <div><dt>회원</dt><dd>${escapeHtml(info.nickname || "-")} (${escapeHtml(info.username || "-")})</dd></div>
      <div><dt>최근 IP</dt><dd>${lastIp ? escapeHtml(lastIp) : "기록된 IP가 없습니다."}</dd></div>
      <div><dt>최근 접속</dt><dd>${escapeHtml(lastAt)}</dd></div>
    </dl>
    <ul>${history || "<li>IP 기록이 없습니다.</li>"}</ul>
    <div>
      <button type="button" data-admin-user-ip-ban="${escapeAttr(info.id || "")}" ${lastIp ? "" : "disabled"}>IP벤</button>
      <button type="button" data-admin-ip-close>닫기</button>
    </div>
  </section>`;
  modal.hidden = false;
}

function closeAdminIpModal() {
  const modal = $("#adminIpModal");
  if (modal) modal.hidden = true;
}

function openMemberChat() {
  if (!chatWidget) return false;
  closeDirectChat();
  chatWidget.classList.add("open");
  chatOpen?.classList.add("is-open");
  chatOpen?.setAttribute("aria-expanded", "true");
  resetStaffScrollLock($("#memberChatLog"));
  loadMemberChat({ forceScroll: true });
  return true;
}

function closeMemberChat() {
  chatWidget?.classList.remove("open");
  chatOpen?.classList.remove("is-open");
  chatOpen?.setAttribute("aria-expanded", "false");
}

function toggleMemberChat() {
  if (chatWidget?.classList.contains("open")) {
    closeMemberChat();
  } else {
    openMemberChat();
  }
}

document.addEventListener("click", async (event) => {
  const adminRecentCheckAll = event.target.closest("[data-admin-recent-check-all]");
  if (adminRecentCheckAll) {
    $$("[data-admin-recent-trade]").forEach((checkbox) => {
      checkbox.checked = adminRecentCheckAll.checked;
    });
    return;
  }
  const adminRecentDelete = event.target.closest("[data-admin-recent-delete]");
  if (adminRecentDelete) {
    event.preventDefault();
    const trades = $$("[data-admin-recent-trade]:checked").map((checkbox) => checkbox.value);
    if (!trades.length) {
      alert("삭제할 글을 선택하세요.");
      return;
    }
    if (!confirm(`선택한 글 ${trades.length}개를 삭제할까요?`)) return;
    adminRecentDelete.disabled = true;
    try {
      await post("/api/admin/trades/delete", { trades });
      location.reload();
    } catch (error) {
      alert(error.message);
      adminRecentDelete.disabled = false;
    }
    return;
  }
  const tradeDelete = event.target.closest("[data-trade-delete]");
  if (tradeDelete) {
    event.preventDefault();
    if (!confirm("이 거래글을 삭제할까요?")) return;
    tradeDelete.disabled = true;
    try {
      const result = await post("/api/trade/delete", { id: tradeDelete.dataset.tradeId, type: tradeDelete.dataset.tradeDelete });
      sessionStorage.setItem("topMessage", JSON.stringify({ text: "거래글이 삭제되었습니다.", tone: tradeDelete.dataset.tradeDelete }));
      location.href = result.redirect || "/games";
    } catch (error) {
      alert(error.message);
      tradeDelete.disabled = false;
    }
    return;
  }
  const tradeComplete = event.target.closest("[data-trade-complete]");
  if (tradeComplete) {
    event.preventDefault();
    tradeComplete.disabled = true;
    try {
      await post("/api/trade/complete", { id: tradeComplete.dataset.tradeId, type: tradeComplete.dataset.tradeComplete });
      location.reload();
    } catch (error) {
      alert(error.message);
      tradeComplete.disabled = false;
    }
    return;
  }
  const tradeAction = event.target.closest("[data-trade-action]");
  if (tradeAction) {
    event.preventDefault();
    tradeAction.disabled = true;
    try {
      await post("/api/trade/action", { id: tradeAction.dataset.tradeId, type: tradeAction.dataset.tradeAction });
      location.reload();
    } catch (error) {
      alert(error.message);
      tradeAction.disabled = false;
    }
    return;
  }
  const directChatStart = event.target.closest("[data-direct-chat-start]");
  if (directChatStart) {
    event.preventDefault();
    directChatStart.disabled = true;
    try {
      const result = await post("/api/direct-chat/start", { type: directChatStart.dataset.directChatStart, id: directChatStart.dataset.tradeId });
      openDirectChat(result.room?.id);
    } catch (error) {
      alert(error.message);
    } finally {
      directChatStart.disabled = false;
    }
    return;
  }
  const chatImage = event.target.closest("[data-chat-image-id], [data-chat-image]");
  if (chatImage) {
    event.preventDefault();
    const savedImage = chatImageSources.get(chatImage.dataset.chatImageId);
    openImagePreview(savedImage?.src || chatImage.dataset.chatImage, savedImage?.name || chatImage.dataset.chatImageName || "");
    return;
  }
  const chatTrigger = event.target.closest("[data-open-chat]");
  if (chatTrigger) {
    event.preventDefault();
    if (!openMemberChat()) {
      location.href = document.body.dataset.user ? "/support" : "/login";
    }
    return;
  }
  const logout = event.target.closest('[data-action="logout"]');
  if (logout) {
    await post("/api/logout", {});
    location.href = "/";
  }
  const pointCancel = event.target.closest("[data-point-cancel]");
  if (pointCancel) {
    event.preventDefault();
    if (!confirm("진행중인 신청을 취소할까요?")) return;
    pointCancel.disabled = true;
    try {
      await post("/api/point-request/cancel", { id: pointCancel.dataset.pointCancel });
      location.reload();
    } catch (error) {
      alert(error.message);
      pointCancel.disabled = false;
    }
    return;
  }
  const pointBtn = event.target.closest("[data-point]");
  if (pointBtn) {
    if (pointBtn.dataset.decision === "rollback" && !confirm("완료 처리한 마일리지를 롤백할까요?")) return;
    if (pointBtn.dataset.decision === "deleted" && !confirm("이 충전/출금 신청을 삭제 처리할까요?")) return;
    await post("/api/admin/point", { id: pointBtn.dataset.point, decision: pointBtn.dataset.decision });
    location.reload();
    return;
  }
  const adminEdit = event.target.closest("[data-admin-edit]");
  if (adminEdit) {
    const field = adminEdit.closest("[data-admin-field]");
    if (!field) return;
    field.classList.add("editing");
    $$("input, select", field).forEach((input) => { input.hidden = false; });
    const grouped = $(".admin-account-inputs", field);
    if (grouped) grouped.hidden = false;
    $("span", field)?.setAttribute("hidden", "");
    adminEdit.hidden = true;
    return;
  }
  const adminSave = event.target.closest("[data-admin-user-save]");
  if (adminSave) {
    const row = adminSave.closest("[data-admin-user-row]");
    if (!row) return;
    const data = { id: adminSave.dataset.adminUserSave };
    $$("input, select", row).forEach((input) => { data[input.name] = input.value; });
    await post("/api/admin/user", data);
    location.reload();
    return;
  }
  const adminUserDelete = event.target.closest("[data-admin-user-delete]");
  if (adminUserDelete) {
    event.preventDefault();
    const nickname = adminUserDelete.dataset.adminUserNickname || "회원";
    if (!confirm(`${nickname} 님을 탈퇴시키겠습니까?\n해당 작업은 원복되지않습니다.`)) return;
    await post("/api/admin/user/delete", { id: adminUserDelete.dataset.adminUserDelete });
    location.reload();
    return;
  }
  const adminUserLogout = event.target.closest("[data-admin-user-logout]");
  if (adminUserLogout) {
    event.preventDefault();
    if (!confirm("해당 회원을 로그아웃시킬까요?")) return;
    await post("/api/admin/user/logout", { id: adminUserLogout.dataset.adminUserLogout });
    alert("해당 회원을 로그아웃 처리했습니다.");
    location.reload();
    return;
  }
  const adminUserIp = event.target.closest("[data-admin-user-ip]");
  if (adminUserIp) {
    event.preventDefault();
    const res = await fetch(`/api/admin/user-ip?id=${encodeURIComponent(adminUserIp.dataset.adminUserIp)}`);
    const json = await res.json();
    if (!res.ok) return alert(json.error || "IP 정보를 불러오지 못했습니다.");
    openAdminIpModal(json);
    return;
  }
  const adminUserIpBan = event.target.closest("[data-admin-user-ip-ban]");
  if (adminUserIpBan) {
    event.preventDefault();
    if (!confirm("이 회원의 최근 IP를 차단할까요?")) return;
    await post("/api/admin/user-ip/ban", { id: adminUserIpBan.dataset.adminUserIpBan });
    alert("IP벤 리스트에 추가되었습니다.");
    closeAdminIpModal();
    location.reload();
    return;
  }
  if (event.target.closest("[data-admin-ip-close]")) {
    closeAdminIpModal();
    return;
  }
  const ipBanDelete = event.target.closest("[data-ip-ban-delete]");
  if (ipBanDelete) {
    event.preventDefault();
    if (!confirm("이 IP 밴을 삭제할까요?")) return;
    await post("/api/admin/ip-ban/delete", { id: ipBanDelete.dataset.ipBanDelete });
    location.reload();
    return;
  }
  const adminPanelToggle = event.target.closest("[data-admin-panel-toggle]");
  if (adminPanelToggle) {
    const target = adminPanelToggle.dataset.adminPanelToggle;
    $$("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== target || !panel.hidden;
    });
    $$("[data-admin-panel-toggle]").forEach((button) => {
      button.classList.toggle("active", button === adminPanelToggle && !$(`[data-admin-panel="${target}"]`)?.hidden);
    });
    return;
  }
  const noticeApply = event.target.closest("[data-notice-apply]");
  if (noticeApply) {
    const form = noticeApply.closest(".admin-notice-form");
    const editor = $("[data-notice-editor]", form);
    if (editor) {
      const family = $("[data-notice-font]", form)?.value || "Malgun Gothic";
      const size = $("[data-notice-size]", form)?.value || "16";
      const weight = $("[data-notice-weight]", form)?.value || "400";
      document.execCommand("fontName", false, family);
      document.execCommand("fontSize", false, "4");
      const fontNodes = editor.querySelectorAll("font[size='4']");
      fontNodes.forEach((node) => {
        const span = document.createElement("span");
        span.style.fontFamily = family;
        span.style.fontSize = `${size}px`;
        span.style.fontWeight = weight;
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
      });
      editor.focus();
      syncNoticeEditor(form);
    }
  }
  const noticeImage = event.target.closest("[data-notice-image]");
  if (noticeImage) {
    const form = noticeImage.closest(".admin-notice-form");
    $("[data-notice-file]", form)?.click();
  }
  const noticeDateButton = event.target.closest("[data-notice-date-today], [data-notice-date-yesterday], [data-notice-date-now]");
  if (noticeDateButton) {
    const form = noticeDateButton.closest(".admin-notice-form");
    const date = new Date();
    if (noticeDateButton.matches("[data-notice-date-yesterday]")) date.setDate(date.getDate() - 1);
    setNoticeDate(form, date, noticeDateButton.matches("[data-notice-date-now]"));
    return;
  }
  const tradeCommand = event.target.closest("[data-trade-command]");
  if (tradeCommand) {
    const form = tradeCommand.closest(".trade-compose");
    const editor = $("[data-trade-editor]", form);
    if (editor) {
      document.execCommand(tradeCommand.dataset.tradeCommand, false, null);
      editor.focus();
      syncTradeEditor(form);
    }
  }
  const tradeApply = event.target.closest("[data-trade-apply]");
  if (tradeApply) {
    const form = tradeApply.closest(".trade-compose");
    const editor = $("[data-trade-editor]", form);
    if (editor) {
      const family = $("[data-trade-font]", form)?.value || "Malgun Gothic";
      const size = $("[data-trade-size]", form)?.value || "16";
      const weight = $("[data-trade-weight]", form)?.value || "400";
      document.execCommand("fontName", false, family);
      document.execCommand("fontSize", false, "4");
      editor.querySelectorAll("font[size='4']").forEach((node) => {
        const span = document.createElement("span");
        span.style.fontFamily = family;
        span.style.fontSize = `${size}px`;
        span.style.fontWeight = weight;
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
      });
      editor.focus();
      syncTradeEditor(form);
    }
  }
  const tradeImage = event.target.closest("[data-trade-image]");
  if (tradeImage) {
    const form = tradeImage.closest(".trade-compose");
    $("[data-trade-file]", form)?.click();
  }
  const noticeDelete = event.target.closest("[data-notice-delete]");
  if (noticeDelete) {
    event.preventDefault();
    if (!confirm("공지사항을 삭제할까요?")) return;
    await post("/api/admin/notice/delete", { id: noticeDelete.dataset.noticeDelete });
    location.href = "/notices";
  }
});

function syncNoticeEditor(form) {
  const editor = $("[data-notice-editor]", form);
  const input = form?.elements.body;
  if (!editor || !input) return;
  input.value = editor.innerHTML.trim();
}

function noticeDateParts(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function syncNoticeDate(form) {
  const input = form?.elements.createdAt;
  const dateInput = $("[data-notice-date-input]", form);
  const timeInput = $("[data-notice-time-input]", form);
  if (!input || !dateInput?.value) return;
  input.value = `${dateInput.value}T${timeInput?.value || "09:00"}`;
}

function setNoticeDate(form, date, withTime = false) {
  const parts = noticeDateParts(date);
  const dateInput = $("[data-notice-date-input]", form);
  const timeInput = $("[data-notice-time-input]", form);
  if (dateInput) dateInput.value = parts.date;
  if (withTime && timeInput) timeInput.value = parts.time;
  syncNoticeDate(form);
}

function syncTradeEditor(form) {
  const editor = $("[data-trade-editor]", form);
  if (!editor) return;
  if (form?.elements.description) form.elements.description.value = editor.innerHTML.trim();
  if (form?.elements.descriptionText) form.elements.descriptionText.value = editor.innerText.trim();
}

document.addEventListener("change", async (event) => {
  const noticeDateInput = event.target.closest("[data-notice-date-input], [data-notice-time-input]");
  if (noticeDateInput) {
    syncNoticeDate(noticeDateInput.closest(".admin-notice-form"));
    return;
  }
  const gameSelect = event.target.closest(".trade-compose select[name='gameSlug']");
  if (gameSelect) {
    const base = document.body.dataset.page === "trade" && location.pathname === "/buy" ? "/buy" : "/sell";
    location.href = `${base}?game=${encodeURIComponent(gameSelect.value)}`;
    return;
  }
  const statusSelect = event.target.closest("[data-trade-status]");
  if (!statusSelect) return;
  await post("/api/trade/status", { id: statusSelect.dataset.tradeStatus, type: statusSelect.dataset.tradeType, status: statusSelect.value });
  location.reload();
});

document.addEventListener("click", (event) => {
  const preset = event.target.closest("[data-price-preset]");
  if (!preset) return;
  const form = preset.closest("form");
  const input = form?.querySelector("input[name='price']");
  if (input) input.value = Number(input.value || 0) + Number(preset.dataset.pricePreset || 0);
});

function applyMarketPanelFilters(panel, next = {}) {
  if (!panel) return;
  const url = new URL(location.href);
  const from = "priceFrom" in next ? next.priceFrom : panel.querySelector("[data-market-price-from]")?.value;
  const to = "priceTo" in next ? next.priceTo : panel.querySelector("[data-market-price-to]")?.value;
  const keyword = "keyword" in next ? next.keyword : panel.querySelector("[data-market-keyword]")?.value;
  if (Number(from || 0) > 0) url.searchParams.set("priceFrom", String(Number(from || 0)));
  else url.searchParams.delete("priceFrom");
  if (Number(to || 0) > 0) url.searchParams.set("priceTo", String(Number(to || 0)));
  else url.searchParams.delete("priceTo");
  if (String(keyword || "").trim()) url.searchParams.set("q", String(keyword || "").trim());
  else url.searchParams.delete("q");
  url.searchParams.delete("page");
  location.href = url.toString();
}

document.addEventListener("click", (event) => {
  const priceButton = event.target.closest("[data-market-price-button]");
  if (priceButton) {
    applyMarketPanelFilters(priceButton.closest(".market-panel"), {
      priceFrom: priceButton.dataset.priceFrom || "0",
      priceTo: priceButton.dataset.priceTo || "0"
    });
    return;
  }
  const searchButton = event.target.closest("[data-market-search]");
  if (searchButton) {
    applyMarketPanelFilters(searchButton.closest(".market-panel"));
  }
});

document.addEventListener("keydown", (event) => {
  const keywordInput = event.target.closest("[data-market-keyword]");
  const priceInput = event.target.closest("[data-market-price-from], [data-market-price-to]");
  if ((keywordInput || priceInput) && event.key === "Enter") {
    event.preventDefault();
    applyMarketPanelFilters(event.target.closest(".market-panel"));
  }
});

const bannerTrack = $(".hero-banner-track");
const bannerSlides = bannerTrack ? $$(".hero-banner-image", bannerTrack) : [];
if (bannerTrack && bannerSlides.length > 1) {
  const slideCount = bannerSlides.length;
  const step = 100 / slideCount;
  let activeBanner = 0;
  setInterval(() => {
    activeBanner += 1;
    bannerTrack.style.transform = `translateX(-${activeBanner * step}%)`;
    if (activeBanner === slideCount - 1) {
      window.setTimeout(() => {
        bannerTrack.style.transition = "none";
        activeBanner = 0;
        bannerTrack.style.transform = "translateX(0)";
        bannerTrack.offsetHeight;
        bannerTrack.style.transition = "";
      }, 820);
    }
  }, 7000);
}

const featuredGameCards = $$(".hot-games .game-card");
if (featuredGameCards.length) {
  const activateGameCard = (card) => {
    featuredGameCards.forEach((item) => item.classList.toggle("active", item === card));
  };
  featuredGameCards.forEach((card) => {
    card.addEventListener("mouseenter", () => activateGameCard(card));
    card.addEventListener("focus", () => activateGameCard(card));
  });
}

const globalSearchForm = $(".search");
const globalSearchInput = $("#globalSearch");
const globalSuggest = $("#globalSuggest");
let globalSearchResults = [];
let globalSearchTimer = null;

function renderSearchSuggestions(games, title = "추천 검색어") {
  if (!globalSuggest) return;
  globalSearchResults = games || [];
  if (!globalSearchResults.length) {
    globalSuggest.innerHTML = `<b>${escapeHtml(title)}</b><p class="suggest-empty">검색 결과가 없습니다.</p>`;
    globalSuggest.classList.add("is-open");
    return;
  }
  globalSuggest.innerHTML = `<b>${escapeHtml(title)}</b><div class="suggest-list">${globalSearchResults.map((game) => `
    <a href="/games/${encodeURIComponent(game.slug)}" data-search-game="${escapeAttr(game.slug)}">
      <img src="${escapeAttr(game.imageUrl)}" alt="">
      <span>${escapeHtml(game.name)}</span>
    </a>
  `).join("")}</div>`;
  globalSuggest.classList.add("is-open");
}

async function loadSearchSuggestions(query = "") {
  if (!globalSuggest) return [];
  const res = await fetch(`/api/search-games?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  renderSearchSuggestions(data.games || [], query ? "검색 결과" : "추천 검색어");
  return data.games || [];
}

if (globalSearchForm && globalSearchInput && globalSuggest) {
  globalSearchInput.addEventListener("focus", () => {
    loadSearchSuggestions(globalSearchInput.value.trim()).catch(() => {});
  });
  globalSearchInput.addEventListener("input", () => {
    clearTimeout(globalSearchTimer);
    globalSearchTimer = setTimeout(() => loadSearchSuggestions(globalSearchInput.value.trim()).catch(() => {}), 120);
  });
  globalSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = globalSearchInput.value.trim();
    const results = query || !globalSearchResults.length ? await loadSearchSuggestions(query) : globalSearchResults;
    const first = results[0];
    if (first?.slug) location.href = `/games/${encodeURIComponent(first.slug)}`;
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search")) globalSuggest.classList.remove("is-open");
  });
}

const adminRecentSearchForm = $("[data-admin-recent-search]");
if (adminRecentSearchForm) {
  const adminRecentGameInput = $("[data-admin-recent-game-search]", adminRecentSearchForm);
  const adminRecentGameValue = $("[data-admin-recent-game-value]", adminRecentSearchForm);
  const adminRecentSuggest = $("[data-admin-recent-game-suggest]", adminRecentSearchForm);
  const adminRecentSizeInput = $("input[name='size']", adminRecentSearchForm);
  let adminRecentGameTimer = null;

  const adminRecentSearchUrl = (q = adminRecentGameInput?.value.trim() || "", game = adminRecentGameValue?.value || "") => {
    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("size", adminRecentSizeInput?.value || new URLSearchParams(location.search).get("size") || "10");
    if (q) query.set("q", q);
    if (game) query.set("game", game);
    return `/admin_read?${query.toString()}`;
  };

  const renderAdminRecentGameSuggestions = (games = [], title = "추천 검색어") => {
    if (!adminRecentSuggest) return;
    if (!games.length) {
      adminRecentSuggest.innerHTML = `<b>${escapeHtml(title)}</b><p class="suggest-empty">검색 결과가 없습니다.</p>`;
      adminRecentSuggest.classList.add("is-open");
      return;
    }
    adminRecentSuggest.innerHTML = `<b>${escapeHtml(title)}</b><div class="admin-recent-suggest-list">${games.map((game) => `
      <button type="button" data-admin-recent-game-select="${escapeAttr(game.slug)}" data-admin-recent-game-name="${escapeAttr(game.name)}">
        <img src="${escapeAttr(game.imageUrl)}" alt="">
        <span>${escapeHtml(game.name)}</span>
      </button>
    `).join("")}</div>`;
    adminRecentSuggest.classList.add("is-open");
  };

  const loadAdminRecentGameSuggestions = async (query = "") => {
    if (!adminRecentSuggest) return [];
    const res = await fetch(`/api/search-games?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const games = data.games || [];
    renderAdminRecentGameSuggestions(games, query ? "검색 결과" : "추천 검색어");
    return games;
  };

  adminRecentGameInput?.addEventListener("focus", () => {
    loadAdminRecentGameSuggestions(adminRecentGameInput.value.trim()).catch(() => {});
  });
  adminRecentGameInput?.addEventListener("input", () => {
    if (adminRecentGameValue) adminRecentGameValue.value = "";
    clearTimeout(adminRecentGameTimer);
    adminRecentGameTimer = setTimeout(() => {
      loadAdminRecentGameSuggestions(adminRecentGameInput.value.trim()).catch(() => {});
    }, 120);
  });
  adminRecentGameInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    location.href = adminRecentSearchUrl();
  });
  adminRecentSuggest?.addEventListener("click", (event) => {
    const gameButton = event.target.closest("[data-admin-recent-game-select]");
    if (!gameButton) return;
    const name = gameButton.dataset.adminRecentGameName || "";
    const slug = gameButton.dataset.adminRecentGameSelect || "";
    if (adminRecentGameInput) adminRecentGameInput.value = name;
    if (adminRecentGameValue) adminRecentGameValue.value = slug;
    location.href = adminRecentSearchUrl(name, slug);
  });
  adminRecentSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    location.href = adminRecentSearchUrl();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-admin-recent-search]")) adminRecentSuggest?.classList.remove("is-open");
  });
}

function renderTradeGameSuggestions(picker, games, title = "추천 검색어") {
  const panel = $("[data-trade-game-suggest]", picker);
  if (!panel) return;
  if (!games.length) {
    panel.innerHTML = `<b>${escapeHtml(title)}</b><p class="suggest-empty">검색 결과가 없습니다.</p>`;
    panel.classList.add("is-open");
    return;
  }
  panel.innerHTML = `<b>${escapeHtml(title)}</b><div class="trade-game-suggest-list">${games.map((game) => `
    <button type="button" data-trade-game-select="${escapeAttr(game.slug)}">
      <img src="${escapeAttr(game.imageUrl)}" alt="">
      <span>${escapeHtml(game.name)}</span>
    </button>
  `).join("")}</div>`;
  panel.classList.add("is-open");
}

async function loadTradeGameSuggestions(picker, query = "") {
  const res = await fetch(`/api/search-games?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const games = data.games || [];
  renderTradeGameSuggestions(picker, games, query ? "검색 결과" : "추천 검색어");
  return games;
}

$$("[data-trade-game-picker]").forEach((picker) => {
  const input = $("[data-trade-game-search]", picker);
  const button = $("[data-trade-game-search-button]", picker);
  let timer = null;
  input?.addEventListener("focus", () => {
    loadTradeGameSuggestions(picker, input.value.trim()).catch(() => {});
  });
  input?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => loadTradeGameSuggestions(picker, input.value.trim()).catch(() => {}), 120);
  });
  input?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const games = await loadTradeGameSuggestions(picker, input.value.trim()).catch(() => []);
    if (games[0]?.slug) {
        const base = picker.dataset.composeType === "admin" ? "/admin_write" : picker.dataset.composeType === "buy" ? "/buy" : "/sell";
        location.href = `${base}?game=${encodeURIComponent(games[0].slug)}`;
    }
  });
  button?.addEventListener("click", () => {
    loadTradeGameSuggestions(picker, input?.value.trim() || "").catch(() => {});
  });
});

document.addEventListener("click", (event) => {
  const gameButton = event.target.closest("[data-trade-game-select]");
  if (gameButton) {
    const picker = gameButton.closest("[data-trade-game-picker]");
    const base = picker?.dataset.composeType === "admin" ? "/admin_write" : picker?.dataset.composeType === "buy" ? "/buy" : "/sell";
    location.href = `${base}?game=${encodeURIComponent(gameButton.dataset.tradeGameSelect)}`;
    return;
  }
  if (!event.target.closest("[data-trade-game-picker]")) {
    $$("[data-trade-game-suggest]").forEach((panel) => panel.classList.remove("is-open"));
  }
});

const noticeForm = $(".admin-notice-form");
if (noticeForm) {
  const editor = $("[data-notice-editor]", noticeForm);
  editor?.addEventListener("input", () => syncNoticeEditor(noticeForm));
  editor?.addEventListener("focus", () => {
    if (editor.innerText.trim() === "내용을 입력하세요.") editor.innerHTML = "<p><br></p>";
  });
  $("[data-notice-file]", noticeForm)?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor?.focus();
      document.execCommand("insertHTML", false, `<p><img src="${reader.result}" alt=""></p><p><br></p>`);
      event.target.value = "";
      syncNoticeEditor(noticeForm);
    };
    reader.readAsDataURL(file);
  });
}

$$('form[data-form="sell"], form[data-form="buy"], form[data-form="admin-trade"]').forEach((form) => {
  const editor = $("[data-trade-editor]", form);
  editor?.addEventListener("input", () => syncTradeEditor(form));
  $("[data-trade-file]", form)?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor?.focus();
      document.execCommand("insertHTML", false, `<p><img src="${reader.result}" alt=""></p><p><br></p>`);
      event.target.value = "";
      syncTradeEditor(form);
    };
    reader.readAsDataURL(file);
  });
});

function formatWon(value) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function updateMileageForm(form) {
  if (!form?.classList.contains("mileage-form")) return;
  const input = form.elements.amount;
  const amount = Number(input?.value || 0);
  const balance = Number(form.dataset.balance || 0);
  const isCharge = form.dataset.form === "charge";
  const fee = 0;
  const total = isCharge ? amount + fee : Math.min(amount, balance);
  const amountTarget = $('[data-point-summary="amount"]', form);
  const feeTarget = $('[data-point-summary="fee"]', form);
  const totalTarget = $('[data-point-summary="total"]', form);
  if (amountTarget) amountTarget.textContent = formatWon(amount);
  if (feeTarget) feeTarget.textContent = formatWon(fee);
  if (totalTarget) totalTarget.textContent = formatWon(total);
}

$$(".mileage-form").forEach((form) => {
  updateMileageForm(form);
  form.elements.amount?.addEventListener("input", () => updateMileageForm(form));
});

document.addEventListener("input", (event) => {
  if (event.target?.name === "withdrawAccountNumber") {
    event.target.value = event.target.value.replace(/\D/g, "");
  }
});

let pendingWithdrawForm = null;
let pendingWithdrawAccount = null;
let pendingChargeForm = null;
const withdrawModalTemplate = $(".withdraw-confirm-card")?.innerHTML || "";
const chargeModalTemplate = $(".charge-confirm-card")?.innerHTML || "";

function closeChargeModal() {
  const modal = $("[data-charge-modal]");
  if (!modal) return;
  modal.hidden = true;
  pendingChargeForm = null;
}

function openChargeModal(form) {
  const modal = $("[data-charge-modal]");
  if (!modal) return false;
  const card = $(".charge-confirm-card", modal);
  if (card && chargeModalTemplate && !card.querySelector("[data-charge-confirm]")) card.innerHTML = chargeModalTemplate;
  pendingChargeForm = form;
  modal.hidden = false;
  modal.querySelector("[data-charge-confirm]")?.focus();
  return true;
}

function showChargeResult(result, amount) {
  const modal = $("[data-charge-modal]");
  const card = $(".charge-confirm-card", modal);
  if (!modal || !card) return;
  const account = result.account || {};
  card.innerHTML = `<div class="charge-result-check" aria-hidden="true">✓</div>
    <h2 class="charge-result-title">입금신청결과안내</h2>
    <p class="charge-result-sub">입금신청이 정상 처리되었습니다</p>
    <dl class="charge-result-list">
      <dt>입금은행</dt><dd>${escapeHtml(account.bank || "-")}</dd>
      <dt>계좌번호</dt><dd>${escapeHtml(account.number || "-")}</dd>
      <dt>이름</dt><dd>${escapeHtml(account.holder || "-")}</dd>
      <dt>금액</dt><dd class="amount">${formatWon(amount)}</dd>
      <dt>유효기간</dt><dd>${escapeHtml(result.deadline || "-")}</dd>
    </dl>
    <p class="charge-result-caution"><strong>주의!</strong> <b>카카오뱅크</b> · <b>카카오페이</b> · <b>토스뱅크</b>등의 간편결제 서비스에서는 가상계좌로의 <em>입금 확인이 되지 않습니다.</em></p>
    <button type="button" class="charge-result-ok" data-charge-result-ok>확인</button>`;
  modal.hidden = false;
  card.querySelector("[data-charge-result-ok]")?.focus();
}

async function submitChargeRequest() {
  const form = pendingChargeForm;
  if (!form) return;
  const data = formData(form);
  const result = await post("/api/point-request", { ...data, type: "charge" });
  form.reset();
  updateMileageForm(form);
  showChargeResult(result, data.amount);
}

function closeWithdrawModal() {
  const modal = $("[data-withdraw-modal]");
  if (!modal) return;
  modal.hidden = true;
  pendingWithdrawForm = null;
  pendingWithdrawAccount = null;
}

function resetWithdrawModal() {
  const card = $(".withdraw-confirm-card");
  if (card && withdrawModalTemplate && !card.querySelector("[name='withdrawAccountNumber']")) {
    card.innerHTML = withdrawModalTemplate;
  }
}

function openWithdrawModal(form) {
  const modal = $("[data-withdraw-modal]");
  if (!modal) return false;
  resetWithdrawModal();
  pendingWithdrawForm = form;
  pendingWithdrawAccount = null;
  const amount = Number(form.elements.amount?.value || 0);
  const amountTarget = $("[data-withdraw-confirm-amount]", modal);
  if (amountTarget) amountTarget.textContent = formatWon(amount);
  modal.hidden = false;
  modal.querySelector("select, input")?.focus();
  return true;
}

function reviewWithdrawRequest() {
  const modal = $("[data-withdraw-modal]");
  const form = pendingWithdrawForm;
  if (!modal || !form) return;
  const message = $(".form-message", form);
  const bank = modal.querySelector("[name='withdrawBank']")?.value.trim();
  const accountNumber = modal.querySelector("[name='withdrawAccountNumber']")?.value.replace(/\D/g, "").trim();
  const holder = modal.querySelector("[name='withdrawHolder']")?.value.trim();
  if (!bank || !accountNumber || !holder) {
    if (message) message.textContent = "은행, 계좌번호, 예금주명을 입력해주세요.";
    return;
  }
  pendingWithdrawAccount = { bank, accountNumber, holder };
  const card = $(".withdraw-confirm-card", modal);
  if (!card) return;
  card.innerHTML = `<h2>출금 정보 확인</h2>
    <p>입력하신 정보는 아래와 같습니다.</p>
    <div class="withdraw-review-box">
      <p><span>예금주</span><b>${escapeHtml(holder)}</b></p>
      <p><span>은행명</span><b>${escapeHtml(bank)}</b></p>
      <p><span>계좌번호</span><b>${escapeHtml(accountNumber)}</b></p>
    </div>
    <p class="withdraw-caution"><strong>주의!</strong> 예금주와 계좌번호가 불일치할 경우 출금이 정상적으로 진행되지 않을 수 있습니다.<span>다시 한번 확인 후 출금 진행해 주세요.</span></p>
    <div class="withdraw-confirm-actions">
      <button type="button" class="ghost" data-withdraw-cancel>신청 취소</button>
      <button type="button" data-withdraw-submit>확인</button>
    </div>`;
}

async function submitWithdrawRequest() {
  const form = pendingWithdrawForm;
  const account = pendingWithdrawAccount;
  if (!form || !account) return;
  const data = formData(form);
  const result = await post("/api/point-request", {
    ...data,
    type: "withdraw",
    withdrawBank: account.bank,
    withdrawAccountNumber: account.accountNumber,
    withdrawHolder: account.holder
  });
  closeWithdrawModal();
  form.reset();
  updateMileageForm(form);
  sessionStorage.setItem("topMessage", result.message || "출금 신청이 완료되었습니다.");
  location.href = "/withdraw";
}

document.addEventListener("click", (event) => {
  const amountPreset = event.target.closest("[data-point-amount]");
  if (!amountPreset) return;
  const form = amountPreset.closest(".mileage-form");
  const input = form?.elements.amount;
  if (!input) return;
  const current = Number(input.value || 0);
  const value = Number(amountPreset.dataset.pointAmount || 0);
  input.value = current + value;
  updateMileageForm(form);
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-charge-cancel]")) {
    closeChargeModal();
    return;
  }
  if (event.target.closest("[data-charge-confirm]")) {
    submitChargeRequest().catch((error) => {
      const message = pendingChargeForm ? $(".form-message", pendingChargeForm) : null;
      if (message) message.textContent = error.message;
      closeChargeModal();
    });
    return;
  }
  if (event.target.closest("[data-charge-result-ok]")) {
    sessionStorage.setItem("focusChargeAccount", "1");
    location.href = "/charge";
    return;
  }
  if (event.target.closest("[data-withdraw-cancel]")) {
    closeWithdrawModal();
    return;
  }
  if (event.target.closest("[data-withdraw-confirm]")) {
    try {
      reviewWithdrawRequest();
    } catch (error) {
      const message = pendingWithdrawForm ? $(".form-message", pendingWithdrawForm) : null;
      if (message) message.textContent = error.message;
    }
    return;
  }
  if (event.target.closest("[data-withdraw-submit]")) {
    submitWithdrawRequest().catch((error) => {
      const message = pendingWithdrawForm ? $(".form-message", pendingWithdrawForm) : null;
      if (message) message.textContent = error.message;
    });
    return;
  }
  const modal = event.target.closest("[data-withdraw-modal]");
  if (modal && event.target === modal) closeWithdrawModal();
  const chargeModal = event.target.closest("[data-charge-modal]");
  if (chargeModal && event.target === chargeModal) closeChargeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeWithdrawModal();
    closeChargeModal();
  }
});

const signupAvailability = new Map();
const passwordPattern = /^(?=.*[a-z])(?=.*\d).{8,}$/;

function setAvailability(form, field, state, text) {
  const target = $(`[data-availability="${field}"]`, form);
  if (!target) return;
  target.className = `availability-status ${state}`;
  target.textContent = text;
}

async function checkAvailability(form, field) {
  const input = form.elements[field];
  const value = input?.value.trim();
  if (!value) {
    signupAvailability.set(field, false);
    setAvailability(form, field, "", "입력 대기");
    return false;
  }
  setAvailability(form, field, "checking", "확인 중");
  const res = await fetch(`/api/check-availability?field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`);
  const data = await res.json();
  signupAvailability.set(field, Boolean(data.available));
  setAvailability(form, field, data.available ? "ok" : "bad", data.message || (data.available ? "사용 가능" : "이미 사용 중"));
  return Boolean(data.available);
}

function updateSignupPasswordState(form) {
  const guide = $("[data-password-match]", form);
  if (!guide) return true;
  const password = form.elements.password?.value || "";
  const passwordConfirm = form.elements.passwordConfirm?.value || "";
  if (!password && !passwordConfirm) {
    guide.className = "desc";
    guide.textContent = "패스워드를 한 번 더 입력해주세요.";
    return false;
  }
  if (!passwordPattern.test(password)) {
    guide.className = "desc bad";
    guide.textContent = "8자 이상, 영문 소문자와 숫자를 반드시 포함해주세요.";
    return false;
  }
  if (password !== passwordConfirm) {
    guide.className = "desc bad";
    guide.textContent = "패스워드 재확인이 일치하지 않습니다.";
    return false;
  }
  guide.className = "desc ok";
  guide.textContent = "패스워드가 일치합니다.";
  return true;
}

function signupPhoneValue(form) {
  return `${form.elements.phoneCarrier?.value || ""}|${form.elements.phonePrefix?.value || ""}${form.elements.phoneMid?.value || ""}${form.elements.phoneLast?.value || ""}`;
}

function signupPhoneReady(form) {
  return Boolean(form.elements.phoneMid?.value.length === 4 && form.elements.phoneLast?.value.length === 4);
}

function setSignupFraudChecked(form, checked = false) {
  form.dataset.fraudChecked = checked ? "true" : "false";
  form.dataset.fraudPhone = checked ? signupPhoneValue(form) : "";
  const registerButton = $("#register-btn", form);
  if (registerButton) registerButton.disabled = !checked;
  const state = $("[data-fraud-check-state]", form);
  if (state) {
    state.className = `desc ${checked ? "ok" : ""}`;
    state.textContent = checked ? "사기번호조회가 완료되었습니다." : "핸드폰번호 입력 후 사기번호조회를 진행해주세요.";
  }
}

function updateSignupFraudButton(form) {
  const button = $("[data-fraud-check]", form);
  if (!button) return;
  const currentPhone = signupPhoneValue(form);
  if (form.dataset.fraudChecked === "true" && form.dataset.fraudPhone !== currentPhone) setSignupFraudChecked(form, false);
  button.disabled = !signupPhoneReady(form);
}

function openFraudCheckModal(form) {
  const modal = $("[data-fraud-check-modal]");
  const button = $("[data-fraud-check]", form);
  if (!modal || !button) return;
  button.disabled = true;
  modal.hidden = false;
  modal.innerHTML = `<section class="fraud-check-card" role="dialog" aria-modal="true" aria-labelledby="fraudCheckTitle">
    <div class="fraud-check-spinner" aria-hidden="true"></div>
    <h2 id="fraudCheckTitle">핸드폰번호 조회 중</h2>
    <p>피해 신고 이력을 확인하고 있습니다.</p>
  </section>`;
  setTimeout(() => {
    modal.innerHTML = `<section class="fraud-check-card fraud-check-card--done" role="dialog" aria-modal="true" aria-labelledby="fraudCheckTitle">
      <div class="fraud-check-result-check" aria-hidden="true">✓</div>
      <h2 id="fraudCheckTitle">핸드폰번호 조회결과</h2>
      <p class="fraud-check-result-main">피해 신고 이력이 없습니다.</p>
      <p class="fraud-check-result-sub">회원가입이 가능합니다.</p>
      <button type="button" data-fraud-check-ok>확인</button>
    </section>`;
    modal.querySelector("[data-fraud-check-ok]")?.focus();
  }, 3800);
}

function tradeFraudModal() {
  let modal = $("[data-trade-fraud-modal]");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.className = "fraud-check-layer";
  modal.hidden = true;
  modal.dataset.tradeFraudModal = "";
  document.body.appendChild(modal);
  return modal;
}

function openTradeFraudModal() {
  const modal = tradeFraudModal();
  modal.hidden = false;
  modal.innerHTML = `<section class="fraud-check-card" role="dialog" aria-modal="true" aria-labelledby="tradeFraudCheckTitle">
    <div class="fraud-check-spinner" aria-hidden="true"></div>
    <h2 id="tradeFraudCheckTitle">거래 사기 실시간 조회 중</h2>
    <p>피해 신고 이력을 확인하고 있습니다.</p>
  </section>`;
  setTimeout(() => {
    if (modal.hidden) return;
    modal.innerHTML = `<section class="fraud-check-card fraud-check-card--done" role="dialog" aria-modal="true" aria-labelledby="tradeFraudCheckTitle">
      <div class="fraud-check-result-check" aria-hidden="true">✓</div>
      <h2 id="tradeFraudCheckTitle">거래 사기 실시간 조회</h2>
      <p class="fraud-check-result-main">피해 신고 이력이 없습니다.</p>
      <p class="fraud-check-result-sub">거래가 가능합니다.</p>
      <button type="button" data-trade-fraud-ok>확인</button>
    </section>`;
    modal.querySelector("[data-trade-fraud-ok]")?.focus();
  }, 3200);
}

const signupForm = $('form[data-form="signup"]');
if (signupForm) {
  $$("input[name='phoneMid'], input[name='phoneLast']", signupForm).forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 4);
      setSignupFraudChecked(signupForm, false);
      updateSignupFraudButton(signupForm);
      if (input.value.length === 4 && input.name === "phoneMid") signupForm.elements.phoneLast?.focus();
    });
  });
  signupForm.elements.phoneCarrier?.addEventListener("change", () => {
    setSignupFraudChecked(signupForm, false);
    updateSignupFraudButton(signupForm);
  });
  $("[data-fraud-check]", signupForm)?.addEventListener("click", () => {
    if (!signupPhoneReady(signupForm)) return;
    openFraudCheckModal(signupForm);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-fraud-check-ok]")) return;
    const modal = $("[data-fraud-check-modal]");
    if (modal) modal.hidden = true;
    setSignupFraudChecked(signupForm, true);
    updateSignupFraudButton(signupForm);
  });
  ["username", "nickname"].forEach((field) => {
    let timer = null;
    signupForm.elements[field]?.addEventListener("input", () => {
      signupAvailability.set(field, false);
      clearTimeout(timer);
      timer = setTimeout(() => checkAvailability(signupForm, field).catch(() => setAvailability(signupForm, field, "bad", "확인 실패")), 300);
    });
  });
  signupForm.elements.password?.addEventListener("input", () => updateSignupPasswordState(signupForm));
  signupForm.elements.passwordConfirm?.addEventListener("input", () => updateSignupPasswordState(signupForm));
  setSignupFraudChecked(signupForm, false);
  updateSignupFraudButton(signupForm);
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-trade-fraud-check]")) {
    openTradeFraudModal();
    return;
  }
  if (event.target.closest("[data-trade-fraud-ok]")) {
    const modal = $("[data-trade-fraud-modal]");
    if (modal) modal.hidden = true;
  }
});

$$("form[data-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $(".form-message", form);
    try {
      const type = form.dataset.form;
      if (type === "sell" || type === "buy" || type === "admin-trade") syncTradeEditor(form);
      const data = formData(form);
      if (type === "login") {
        await post("/api/login", data);
        location.href = "/";
      } else if (type === "signup") {
        if (form.dataset.fraudChecked !== "true" || form.dataset.fraudPhone !== signupPhoneValue(form)) {
          message.textContent = "사기번호조회를 먼저 완료해주세요.";
          return;
        }
        if (!updateSignupPasswordState(form)) {
          message.textContent = "패스워드를 확인해주세요.";
          return;
        }
        const usernameOk = await checkAvailability(form, "username");
        const nicknameOk = await checkAvailability(form, "nickname");
        if (!usernameOk || !nicknameOk) {
          message.textContent = "아이디와 닉네임 중복 여부를 확인해주세요.";
          return;
        }
        await post("/api/signup", data);
        location.href = "/";
      } else if (type === "sell" || type === "buy") {
        await post("/api/trade", { ...data, type });
        const doneMessage = type === "sell" ? "판매글이 등록되었습니다." : "구매글이 등록되었습니다.";
        sessionStorage.setItem("topMessage", JSON.stringify({ text: doneMessage, tone: type }));
        location.href = "/";
      } else if (type === "admin-trade") {
        data.description = form.elements.description?.value || "";
        data.descriptionText = form.elements.descriptionText?.value || "";
        await post("/api/admin/trade", data);
        message.textContent = "관리자 거래글이 등록되었습니다.";
        setTimeout(() => location.reload(), 450);
      } else if (type === "charge" || type === "withdraw") {
        if (type === "charge") {
          if (!form.reportValidity()) return;
          if (openChargeModal(form)) return;
        }
        if (type === "withdraw" && openWithdrawModal(form)) return;
        const result = await post("/api/point-request", { ...data, type });
        message.textContent = type === "charge" ? `신청완료: ${result.account.bank} ${result.account.number} (${result.account.holder})` : "출금 신청이 접수되었습니다.";
      } else if (type === "site") {
        await post("/api/admin/site", data);
        message.textContent = "저장되었습니다.";
      } else if (type === "ip-ban") {
        await post("/api/admin/ip-ban", data);
        message.textContent = "IP가 추가되었습니다.";
        setTimeout(() => location.reload(), 450);
      } else if (type === "notice" || type === "notice-edit") {
        syncNoticeEditor(form);
        syncNoticeDate(form);
        data.body = form.elements.body?.value || "";
        data.createdAt = form.elements.createdAt?.value || "";
        if (type === "notice-edit") {
          const result = await post("/api/admin/notice/update", data);
          message.textContent = "공지사항이 수정되었습니다.";
          setTimeout(() => { location.href = `/notices/${encodeURIComponent(result.id || data.id)}`; }, 450);
        } else {
          await post("/api/admin/notice", data);
          message.textContent = "공지사항이 추가되었습니다.";
          setTimeout(() => location.reload(), 450);
        }
      } else if (type === "staff") {
        await post("/api/admin/staff", data);
        location.reload();
      }
    } catch (error) {
      message.textContent = error.message;
    }
  });
});

const chatOpen = $("#chatOpen");
const chatWidget = $("#chatWidget");
const chatClose = $("#chatClose");
if (chatOpen && chatWidget) {
  const chatForm = $("#memberChatSend");
  const chatInput = chatForm?.message;
  const chatSendButton = $(".chat-send-button", chatForm);
  const chatSendImage = $(".chat-send-button img", chatForm);
  const chatFileInput = $("#chatFileInput");
  const chatAttachmentPreview = $("#chatAttachmentPreview");
  let selectedChatAttachment = null;
  const updateChatSendState = () => {
    const active = Boolean(chatInput?.value.trim() || selectedChatAttachment);
    chatSendButton?.classList.toggle("active", active);
    if (chatSendImage) chatSendImage.src = active ? "/assets/chat/send-active.png" : "/assets/chat/send-idle.png";
  };
  const clearChatAttachment = () => {
    selectedChatAttachment = null;
    if (chatFileInput) chatFileInput.value = "";
    if (chatAttachmentPreview) chatAttachmentPreview.innerHTML = "";
    updateChatSendState();
  };

  chatOpen.addEventListener("click", toggleMemberChat);
  chatClose?.addEventListener("click", closeMemberChat);
  $(".chat-back", chatWidget)?.addEventListener("click", closeMemberChat);
  $("#chatAttach")?.addEventListener("click", () => chatFileInput?.click());
  chatFileInput?.addEventListener("change", () => {
    const file = chatFileInput.files?.[0];
    if (!file) return clearChatAttachment();
    if (!file.type.startsWith("image/")) {
      alert("사진 파일만 첨부할 수 있습니다.");
      return clearChatAttachment();
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("사진은 3MB 이하만 첨부할 수 있습니다.");
      return clearChatAttachment();
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      selectedChatAttachment = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
      if (chatAttachmentPreview) {
        chatAttachmentPreview.innerHTML = `<img src="${escapeAttr(reader.result)}" alt=""><span>${escapeHtml(file.name)}</span><button type="button" aria-label="첨부 삭제">×</button>`;
        $("button", chatAttachmentPreview)?.addEventListener("click", clearChatAttachment);
      }
      updateChatSendState();
    });
    reader.readAsDataURL(file);
  });
  chatInput?.addEventListener("input", updateChatSendState);
  chatInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    chatForm?.requestSubmit();
  });
  chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = event.currentTarget.message;
    if (!input.value.trim() && !selectedChatAttachment) return;
    await post("/api/chat/member", { message: input.value, attachment: selectedChatAttachment });
    input.value = "";
    clearChatAttachment();
    updateChatSendState();
    resetStaffScrollLock($("#memberChatLog"));
    loadMemberChat({ forceScroll: true });
  });
  updateChatSendState();
  bindStaffScrollLock($("#memberChatLog"));
  loadMemberUnread();
  setInterval(() => chatWidget.classList.contains("open") && loadMemberChat(), 2500);
  setInterval(loadMemberUnread, 2500);
}

async function loadMemberChat(options = {}) {
  const log = $("#memberChatLog");
  if (!log) return;
  const scroll = staffScrollSnapshot(log);
  const res = await fetch("/api/chat/member");
  if (!res.ok) return;
  const { messages } = await res.json();
  log.innerHTML = messages.map((m) => {
    const side = m.senderType === "staff" ? "staff" : "member";
    const name = side === "staff" ? "상담사" : m.displayName;
    if (m.deletedByMember && side === "member") {
      return `<p class="member deleted"><span>삭제된 메세지입니다</span></p>`;
    }
    const text = m.message ? `<span>${messageHtml(m.message)}</span>` : "";
    if (m.attachment) chatImageSources.set(m.id, { src: m.attachment.dataUrl, name: m.attachment.name });
    const image = m.attachment ? `<button type="button" class="chat-image-link" data-chat-image-id="${escapeAttr(m.id)}"><img class="chat-image" src="${escapeAttr(m.attachment.dataUrl)}" alt="${escapeAttr(m.attachment.name)}"></button>` : "";
    const action = side === "member" ? `<button class="message-more" data-chat-menu="${escapeAttr(m.id)}" aria-label="메시지 액션">⋮</button><em class="message-actions" data-chat-actions="${escapeAttr(m.id)}"><button type="button" data-chat-delete="${escapeAttr(m.id)}">메시지 삭제</button></em>` : "";
    return `<p class="${side}" data-message-id="${escapeAttr(m.id)}"><b>${escapeHtml(name)}</b>${action}${text}${image}</p>`;
  }).join("");
  restoreStaffScroll(log, scroll, Boolean(options.forceScroll));
  setMemberUnread(0);
}

function setMemberUnread(count = 0) {
  const value = Number(count || 0);
  chatOpen?.classList.toggle("has-unread", value > 0);
  setUnreadBadge($("[data-support-unread-count]", chatOpen), value);
}

async function loadMemberUnread() {
  if (!chatOpen) return;
  const res = await fetch("/api/chat/member/unread");
  if (!res.ok) return;
  const data = await res.json();
  setMemberUnread(data.unread || 0);
}

document.addEventListener("click", async (event) => {
  const menuButton = event.target.closest("[data-chat-menu]");
  if (menuButton) {
    event.preventDefault();
    const id = menuButton.dataset.chatMenu;
    $$("[data-chat-actions]").forEach((item) => item.classList.toggle("open", item.dataset.chatActions === id && !item.classList.contains("open")));
    return;
  }
  const deleteButton = event.target.closest("[data-chat-delete]");
  if (deleteButton) {
    event.preventDefault();
    await post("/api/chat/member/delete", { id: deleteButton.dataset.chatDelete });
    loadMemberChat();
    return;
  }
  if (!event.target.closest(".message-actions")) {
    $$("[data-chat-actions]").forEach((item) => item.classList.remove("open"));
  }
});

const directChatOpen = $("#directChatOpen");
const directChatWidget = $("#directChatWidget");
const directChatClose = $("#directChatClose");
const directChatBack = $("#directChatBack");
const directChatRooms = $("#directChatRooms");
const directChatLog = $("#directChatLog");
const directChatSend = $("#directChatSend");
const directChatTitle = $("#directChatTitle");
const directChatFileInput = $("#directChatFileInput");
const directChatAttachmentPreview = $("#directChatAttachmentPreview");
let activeDirectRoom = null;
let selectedDirectAttachment = null;

function closeDirectChat() {
  directChatWidget?.classList.remove("open");
  directChatOpen?.classList.remove("is-open");
  directChatOpen?.setAttribute("aria-expanded", "false");
}

function directChatHeader(room = null) {
  if (!directChatTitle) return;
  if (!room) {
    directChatTitle.innerHTML = `<b>채팅</b>`;
    return;
  }
  const image = room.systemOnly ? (room.peerGradeAsset || "/assets/tiers/master.png") : room.peerGradeAsset || "";
  directChatTitle.innerHTML = `<span class="direct-chat-peer"><img src="${escapeAttr(image)}" alt=""><span><b>${escapeHtml(room.peerNickname || "회원")}</b><small>${escapeHtml(room.tradeTitle || "거래글")}</small></span></span>`;
}

function directChatEmpty(text) {
  return `<p class="direct-chat-empty">${escapeHtml(text)}</p>`;
}

function setDirectUnread(count = 0) {
  const value = Number(count || 0);
  directChatOpen?.classList.toggle("has-unread", value > 0);
  setUnreadBadge($("[data-direct-unread-count]", directChatOpen), value);
}

function showDirectRoomList() {
  activeDirectRoom = null;
  directChatWidget?.classList.add("is-list");
  directChatBack?.setAttribute("hidden", "");
  if (directChatRooms) directChatRooms.hidden = false;
  if (directChatLog) {
    directChatLog.hidden = true;
    directChatLog.innerHTML = "";
  }
  if (directChatSend) directChatSend.hidden = true;
  clearDirectAttachment();
  directChatHeader();
}

async function loadDirectRooms() {
  if (!directChatRooms) return;
  const res = await fetch("/api/direct-chat/rooms");
  if (!res.ok) return;
  const { rooms } = await res.json();
  setDirectUnread((rooms || []).reduce((sum, room) => sum + Number(room.unread || 0), 0));
  directChatRooms.innerHTML = rooms.map((room) => {
    const unread = Number(room.unread || 0);
    const systemUnread = room.systemOnly && unread > 0;
    return `<button type="button" class="direct-room-row ${activeDirectRoom === room.id ? "active" : ""} ${systemUnread ? "has-unread system-unread" : ""}" data-direct-room="${escapeAttr(room.id)}">
    <img src="${escapeAttr(room.systemOnly ? (room.peerGradeAsset || "/assets/tiers/master.png") : room.peerGradeAsset || "")}" alt="">
    <span>
      <b>${escapeHtml(room.peerNickname || "회원")}</b>
      <small>${escapeHtml(room.tradeTitle || "거래글")}</small>
      <em>${escapeHtml(room.lastMessage || "아직 대화가 없습니다.")}</em>
    </span>
    ${unread ? `<i>${unread}</i>` : ""}
  </button>`;
  }).join("") || directChatEmpty("현재 채팅이 없습니다.");
}

async function loadDirectMessages() {
  if (!activeDirectRoom || !directChatLog) return;
  const res = await fetch(`/api/direct-chat/${encodeURIComponent(activeDirectRoom)}`);
  if (!res.ok) return;
  const { room, messages } = await res.json();
  directChatHeader(room);
  directChatLog.innerHTML = messages.map((m) => {
    if (m.deleted) return `<p class="${m.side} deleted" data-message-id="${escapeAttr(m.id)}"><span>삭제된 메시지입니다.</span></p>`;
    if (m.attachment) chatImageSources.set(m.id, { src: m.attachment.dataUrl, name: m.attachment.name });
    const text = m.message ? `<span>${messageHtml(m.message)}</span>` : "";
    const image = m.attachment ? `<button type="button" class="chat-image-link" data-chat-image-id="${escapeAttr(m.id)}"><img class="chat-image" src="${escapeAttr(m.attachment.dataUrl)}" alt="${escapeAttr(m.attachment.name)}"></button>` : "";
    const action = m.side === "member" ? `<button class="message-more" data-direct-chat-menu="${escapeAttr(m.id)}" aria-label="메시지 옵션">⋯</button><em class="message-actions" data-direct-chat-actions="${escapeAttr(m.id)}"><button type="button" data-direct-chat-delete="${escapeAttr(m.id)}">메시지 삭제</button></em>` : "";
    const avatar = m.side === "staff" ? `<img class="direct-chat-grade-avatar" src="${escapeAttr(room.peerGradeAsset || "")}" alt="">` : "";
    return `<p class="${escapeAttr(m.side)}" data-message-id="${escapeAttr(m.id)}">${avatar}<b>${escapeHtml(m.displayName || "회원")}</b>${action}${text}${image}</p>`;
  }).join("") || directChatEmpty("아직 대화가 없습니다.");
  if (room.systemOnly) directChatLog.insertAdjacentHTML("beforeend", `<p class="direct-chat-empty direct-chat-readonly">${escapeHtml(room.readOnlyMessage || "답장이 불가한 채팅입니다.")}</p>`);
  directChatLog.scrollTop = directChatLog.scrollHeight;
  loadDirectRooms();
}

async function openDirectRoom(roomId) {
  if (!roomId) return;
  activeDirectRoom = roomId;
  directChatWidget?.classList.remove("is-list");
  directChatBack?.removeAttribute("hidden");
  if (directChatRooms) directChatRooms.hidden = true;
  if (directChatLog) directChatLog.hidden = false;
  await loadDirectMessages();
  if (directChatSend) directChatSend.hidden = $(".direct-chat-readonly", directChatLog) !== null;
}

async function openDirectChat(roomId = null) {
  if (!directChatWidget) return false;
  closeMemberChat();
  directChatWidget.classList.add("open");
  directChatOpen?.classList.add("is-open");
  directChatOpen?.setAttribute("aria-expanded", "true");
  if (roomId) {
    await openDirectRoom(roomId);
  } else {
    showDirectRoomList();
    await loadDirectRooms();
  }
  return true;
}

function toggleDirectChat() {
  if (directChatWidget?.classList.contains("open")) {
    closeDirectChat();
  } else {
    openDirectChat();
  }
}

function updateDirectSendState() {
  const input = directChatSend?.message;
  const active = Boolean(input?.value.trim() || selectedDirectAttachment);
  const sendButton = $(".chat-send-button", directChatSend);
  const sendImage = $(".chat-send-button img", directChatSend);
  sendButton?.classList.toggle("active", active);
  if (sendImage) sendImage.src = active ? "/assets/chat/send-active.png" : "/assets/chat/send-idle.png";
}

function clearDirectAttachment() {
  selectedDirectAttachment = null;
  if (directChatFileInput) directChatFileInput.value = "";
  if (directChatAttachmentPreview) directChatAttachmentPreview.innerHTML = "";
  updateDirectSendState();
}

if (directChatOpen && directChatWidget) {
  directChatOpen.addEventListener("click", toggleDirectChat);
  directChatClose?.addEventListener("click", closeDirectChat);
  directChatBack?.addEventListener("click", async () => {
    showDirectRoomList();
    await loadDirectRooms();
  });
  directChatRooms?.addEventListener("click", (event) => {
    const roomButton = event.target.closest("[data-direct-room]");
    if (roomButton) openDirectRoom(roomButton.dataset.directRoom);
  });
  $("#directChatAttach")?.addEventListener("click", () => directChatFileInput?.click());
  directChatFileInput?.addEventListener("change", () => {
    const file = directChatFileInput.files?.[0];
    if (!file) return clearDirectAttachment();
    if (!file.type.startsWith("image/")) {
      alert("사진 파일만 첨부할 수 있습니다.");
      return clearDirectAttachment();
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("사진은 3MB 이하만 첨부할 수 있습니다.");
      return clearDirectAttachment();
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      selectedDirectAttachment = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
      if (directChatAttachmentPreview) {
        directChatAttachmentPreview.innerHTML = `<img src="${escapeAttr(reader.result)}" alt=""><span>${escapeHtml(file.name)}</span><button type="button" aria-label="첨부 삭제">×</button>`;
        $("button", directChatAttachmentPreview)?.addEventListener("click", clearDirectAttachment);
      }
      updateDirectSendState();
    });
    reader.readAsDataURL(file);
  });
  directChatSend?.message?.addEventListener("input", updateDirectSendState);
  directChatSend?.message?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    directChatSend?.requestSubmit();
  });
  directChatSend?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeDirectRoom) return;
    const input = event.currentTarget.message;
    if (!input.value.trim() && !selectedDirectAttachment) return;
    await post(`/api/direct-chat/${encodeURIComponent(activeDirectRoom)}`, { message: input.value, attachment: selectedDirectAttachment });
    input.value = "";
    clearDirectAttachment();
    await loadDirectMessages();
  });
  updateDirectSendState();
  loadDirectRooms();
  setInterval(() => {
    if (directChatWidget.classList.contains("open") && activeDirectRoom) loadDirectMessages();
    else loadDirectRooms();
  }, 2500);
}

let activeRoom = null;
const STAFF_PREVIEW_ROOM = "__staff_preview__";
let staffRoomsCache = [];
let staffPreviewSender = "staff";
let staffCurrentMessages = [];
window.staffSelectedAttachmentForPreview = null;
window.staffMemberPreviewAttachment = null;

function staffRoomName(room) {
  return room?.memberName || room?.username || "회원";
}

function staffRoomRow(room) {
  const unread = Number(room.staffUnread || 0);
  const realName = room.realName || room.name || "-";
  const adminPrefix = room.adminManagedTrade ? `[관리자글] ${escapeHtml(room.tradeTitle || "")} · ` : "";
  const classes = [
    "room-row",
    activeRoom === room.id ? "active" : "",
    unread ? "has-unread" : "",
    room.adminManagedTrade ? "admin-trade-room" : "",
    room.isHighInternalGrade ? "high-grade-room" : ""
  ].filter(Boolean).join(" ");
  return `<button class="${classes}" data-room="${escapeAttr(room.id)}">
    <span class="room-row-head"><b>${escapeHtml(staffRoomName(room))}</b><i>${escapeHtml([room.displayGrade || "-", room.internalGrade || "-", realName].join(" · "))}</i></span>${unread ? `<em>${unread}</em>` : ""}<small>${adminPrefix}${escapeHtml(room.lastMessage || "첫 상담")}</small>
  </button>`;
}

function staffActionRow(room, pinned) {
  return `<div class="staff-action-row" data-action-room="${escapeAttr(room.id)}">
    <button type="button" data-staff-room-action="${pinned ? "unpin" : "pin"}">${pinned ? "해제" : "고정"}</button>
    <button type="button" data-staff-room-action="grade">차수</button>
    <button type="button" data-staff-room-action="leave">나가기</button>
  </div>`;
}

function staffRoomEntry(room, pinned) {
  return `<div class="staff-room-entry">${staffActionRow(room, pinned)}${staffRoomRow(room)}</div>`;
}

function renderPreviewRoom() {
  return `<button class="room-row preview-room ${activeRoom === STAFF_PREVIEW_ROOM ? "active" : ""}" data-room="${STAFF_PREVIEW_ROOM}">
    <span class="room-row-head"><b>채팅 확인하기</b><i>미리보기</i></span><small>상담사/회원 말풍선을 저장해 확인합니다.</small>
  </button>`;
}

function renderPreviewActionRow() {
  return `<div class="staff-action-row staff-action-row--preview" aria-hidden="true"></div>`;
}

function alignStaffActionRows(actions, rows) {
  if (!actions || !rows) return;
  const actionItems = Array.from(actions.querySelectorAll(".staff-action-row"));
  const roomItems = Array.from(rows.querySelectorAll(".room-row"));
  actionItems.forEach((item, index) => {
    const room = roomItems[index];
    item.style.height = room ? `${Math.max(64, room.getBoundingClientRect().height)}px` : "64px";
  });
}

function alignAllStaffActionRows() {
  alignStaffActionRows($("#staffPinnedActions"), $("#staffPinnedRooms"));
  alignStaffActionRows($("#staffNormalActions"), $("#staffRooms"));
}

function syncStaffRoomScroll(first, second) {
  if (!first || !second) return;
  let locked = false;
  const sync = (source, target) => {
    if (locked) return;
    locked = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => { locked = false; });
  };
  first.addEventListener("scroll", () => sync(first, second), { passive: true });
  second.addEventListener("scroll", () => sync(second, first), { passive: true });
}

function formatStaffChatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

function staffScrollSnapshot(log) {
  if (!log) return { stick: true, bottomOffset: 0 };
  const bottomOffset = Math.max(0, log.scrollHeight - log.scrollTop - log.clientHeight);
  const savedOffset = Number(log.dataset.bottomOffset || bottomOffset);
  const locked = log.dataset.preserveScroll === "1";
  return { stick: !locked && bottomOffset < 80, bottomOffset: locked ? savedOffset : bottomOffset, locked };
}

function restoreStaffScroll(log, snapshot, force = false) {
  if (!log) return;
  if ((force && !snapshot?.locked) || snapshot?.stick) {
    log.scrollTop = log.scrollHeight;
    updateStaffScrollLock(log);
    return;
  }
  log.scrollTop = Math.max(0, log.scrollHeight - log.clientHeight - Number(snapshot?.bottomOffset || 0));
  updateStaffScrollLock(log);
}

function updateStaffScrollLock(log) {
  if (!log) return;
  const bottomOffset = Math.max(0, log.scrollHeight - log.scrollTop - log.clientHeight);
  log.dataset.bottomOffset = String(bottomOffset);
  log.dataset.preserveScroll = bottomOffset > 80 ? "1" : "";
}

function resetStaffScrollLock(log) {
  if (!log) return;
  delete log.dataset.bottomOffset;
  delete log.dataset.preserveScroll;
}

function bindStaffScrollLock(log) {
  if (!log || log.dataset.scrollLockBound === "1") return;
  log.dataset.scrollLockBound = "1";
  log.addEventListener("scroll", () => updateStaffScrollLock(log), { passive: true });
}

function staffHasOpenEditor() {
  return Boolean($(".staff-inline-editor:not([hidden])"));
}

loadStaffRooms = async function loadStaffRoomsV2() {
  const normalList = $("#staffRooms");
  const pinnedList = $("#staffPinnedRooms");
  if (!normalList || !pinnedList) return;
  const res = await fetch("/api/chat/staff");
  if (!res.ok) return;
  const { rooms } = await res.json();
  staffRoomsCache = rooms;
  const pinnedRooms = rooms.filter((room) => room.pinned);
  const normalRooms = rooms.filter((room) => !room.pinned);
  $("#pinnedRoomCount").textContent = pinnedRooms.length;
  $("#roomCount").textContent = normalRooms.length;
  pinnedList.innerHTML = renderPreviewRoom() + pinnedRooms.map((room) => staffRoomEntry(room, true)).join("");
  normalList.innerHTML = normalRooms.map((room) => staffRoomEntry(room, false)).join("") || "<p class='empty'>상담방이 없습니다.</p>";
  if ($("#staffPinnedActions")) $("#staffPinnedActions").innerHTML = renderPreviewActionRow() + pinnedRooms.map((room) => staffActionRow(room, true)).join("");
  if ($("#staffNormalActions")) $("#staffNormalActions").innerHTML = normalRooms.map((room) => staffActionRow(room, false)).join("");
  requestAnimationFrame(alignAllStaffActionRows);
};

function staffMessageMarkup(m, preview = false) {
  const deleted = m.deletedByMember ? "<em class=\"deleted-note\">(삭제)</em>" : "";
  if (m.attachment) chatImageSources.set(m.id, { src: m.attachment.dataUrl, name: m.attachment.name });
  const image = m.attachment ? `<button type="button" class="chat-image-link" data-chat-image-id="${escapeAttr(m.id)}"><img class="chat-image" src="${escapeAttr(m.attachment.dataUrl)}" alt="${escapeAttr(m.attachment.name)}"></button>` : "";
  const read = m.senderType === "staff" && m.read ? "<small class=\"read-receipt\">읽음</small>" : "";
  const edited = m.editedAt ? "<small class=\"edited-note\">수정됨</small>" : "";
  const time = formatStaffChatTime(m.createdAt);
  const deleteAttr = preview ? `data-staff-preview-delete="${escapeAttr(m.id)}"` : `data-staff-message-delete="${escapeAttr(m.id)}"`;
  const editAttr = preview ? `data-staff-preview-edit="${escapeAttr(m.id)}"` : `data-staff-message-edit="${escapeAttr(m.id)}"`;
  return `<div class="staff-message ${escapeAttr(m.senderType)}" data-message-id="${escapeAttr(m.id)}"><div class="staff-inline-editor" hidden><textarea rows="2">${escapeHtml(m.message || "")}</textarea><div><button type="button" data-staff-edit-save="${escapeAttr(m.id)}">저장</button><button type="button" data-staff-edit-cancel>취소</button></div></div><b><em class="staff-message-name">${escapeHtml(m.displayName)}${m.internalStaffName ? ` (${escapeHtml(m.internalStaffName)})` : ""}</em>${time ? `<time>${escapeHtml(time)}</time>` : ""}</b><span>${messageHtml(m.message || "")}${deleted}</span>${image}<span class="staff-message-tools"><button type="button" ${editAttr}>수정</button><button type="button" ${deleteAttr}>삭제</button></span>${edited}${read}</div>`;
}

function staffMemberPreviewMarkup(m, draft = false) {
  const side = m.senderType === "staff" ? "staff" : "member";
  const name = side === "staff" ? "상담사" : (m.displayName || "회원");
  if (m.attachment) chatImageSources.set(m.id || "staff-draft-image", { src: m.attachment.dataUrl, name: m.attachment.name });
  const text = m.message ? `<span>${messageHtml(m.message)}</span>` : "";
  const image = m.attachment ? `<button type="button" class="chat-image-link" data-chat-image-id="${escapeAttr(m.id || "staff-draft-image")}"><img class="chat-image" src="${escapeAttr(m.attachment.dataUrl)}" alt="${escapeAttr(m.attachment.name)}"></button>` : "";
  return `<p class="${side}${draft ? " draft" : ""}"><b>${escapeHtml(name)}</b>${text}${image}</p>`;
}

function renderStaffMemberPreview(options = {}) {
  const log = $("#staffMemberPreviewLog");
  if (!log) return;
  const scroll = staffScrollSnapshot(log);
  const isPreviewRoom = activeRoom === STAFF_PREVIEW_ROOM;
  const messages = [{ id: "support-greeting", senderType: "staff", displayName: "상담사", message: "안녕하세요.\n아이템존 고객센터 입니다.", createdAt: "" }, ...staffCurrentMessages];
  const draftText = $("#staffSend textarea[name=\"message\"]")?.value || "";
  const draftSender = isPreviewRoom ? staffPreviewSender : "staff";
  const draft = draftText.trim() || window.staffSelectedAttachmentForPreview
    ? staffMemberPreviewMarkup({ id: "staff-draft", senderType: draftSender, displayName: draftSender === "staff" ? "상담사" : "회원", message: draftText, attachment: window.staffSelectedAttachmentForPreview }, true)
    : "";
  const memberDraftText = $("#staffMemberPreviewSend textarea[name=\"message\"]")?.value || "";
  const memberDraft = memberDraftText.trim() || window.staffMemberPreviewAttachment
    ? staffMemberPreviewMarkup({ id: "staff-member-draft", senderType: "member", displayName: "회원", message: memberDraftText, attachment: window.staffMemberPreviewAttachment }, true)
    : "";
  log.innerHTML = messages.map((m) => staffMemberPreviewMarkup(m)).join("") + draft + memberDraft;
  restoreStaffScroll(log, scroll, Boolean(options.forceScroll));
  const meta = $("#staffMemberPreviewMeta");
  if (meta) meta.textContent = activeRoom ? (isPreviewRoom ? "미리보기 방" : "회원에게 보이는 상담창") : "상담방을 선택하세요.";
}

loadStaffMessages = async function loadStaffMessagesV2(options = {}) {
  if (!activeRoom) return;
  const preview = activeRoom === STAFF_PREVIEW_ROOM;
  const res = await fetch(preview ? "/api/chat/staff-preview" : `/api/chat/staff/${encodeURIComponent(activeRoom)}`);
  if (!res.ok) return;
  const { messages } = await res.json();
  const log = $("#staffMessages");
  const scroll = staffScrollSnapshot(log);
  staffCurrentMessages = messages;
  $("#staffRoomMeta").textContent = preview ? "채팅 확인하기: 상담사/회원 말풍선을 미리 확인합니다." : "이 로그는 실제 상담 기록으로 저장됩니다.";
  $("#staffClearRoom")?.removeAttribute("disabled");
  $("#staffPreviewSpeaker")?.toggleAttribute("hidden", !preview);
  log.innerHTML = messages.map((m) => staffMessageMarkup(m, preview)).join("");
  restoreStaffScroll(log, scroll, Boolean(options.forceScroll));
  renderStaffMemberPreview({ forceScroll: Boolean(options.forceScroll) });
};

function autoGrowStaffInput() {
  const input = $("#staffSend textarea[name=\"message\"]");
  const previewInput = $("#staffMemberPreviewSend textarea[name=\"message\"]");
  [input, previewInput].filter(Boolean).forEach((item) => {
    item.style.height = "auto";
    const max = Number(item.dataset.maxAutoHeight || 190);
    item.style.height = `${Math.min(item.scrollHeight, max)}px`;
  });
}

if (document.body.dataset.page === "staff") {
  const staffForm = $("#staffSend");
  const staffInput = $("#staffSend textarea[name=\"message\"]");
  const staffPreviewForm = $("#staffMemberPreviewSend");
  const staffPreviewInput = $("#staffMemberPreviewSend textarea[name=\"message\"]");
  const staffFileInput = $("#staffChatFileInput");
  const staffPreviewFileInput = $("#staffMemberPreviewFileInput");
  const staffAttachmentPreview = $("#staffChatAttachmentPreview");
  const staffMemberPreviewAttachmentPreview = $("#staffMemberPreviewAttachmentPreview");
  let selectedStaffAttachment = null;
  let selectedMemberPreviewAttachment = null;
  const clearStaffAttachment = () => {
    selectedStaffAttachment = null;
    window.staffSelectedAttachmentForPreview = null;
    if (staffFileInput) staffFileInput.value = "";
    if (staffAttachmentPreview) staffAttachmentPreview.innerHTML = "";
    renderStaffMemberPreview();
  };
  const clearMemberPreviewAttachment = () => {
    selectedMemberPreviewAttachment = null;
    window.staffMemberPreviewAttachment = null;
    if (staffPreviewFileInput) staffPreviewFileInput.value = "";
    if (staffMemberPreviewAttachmentPreview) staffMemberPreviewAttachmentPreview.innerHTML = "";
    renderStaffMemberPreview();
  };
  const updateStaffDraft = () => {
    autoGrowStaffInput();
    const active = Boolean(staffPreviewInput?.value.trim() || selectedMemberPreviewAttachment);
    const sendButton = $("#staffMemberPreviewSend .chat-send-button");
    const sendImage = $("#staffMemberPreviewSend .chat-send-button img");
    sendButton?.classList.toggle("active", active);
    if (sendImage) sendImage.src = active ? "/assets/chat/send-active.png" : "/assets/chat/send-idle.png";
    renderStaffMemberPreview();
  };
  const openRoom = (roomId) => {
    activeRoom = roomId;
    resetStaffScrollLock($("#staffMessages"));
    resetStaffScrollLock($("#staffMemberPreviewLog"));
    loadStaffMessages({ forceScroll: true });
    loadStaffRooms();
  };
  document.addEventListener("click", async (event) => {
    const roomButton = event.target.closest("[data-room]");
    if (roomButton) {
      openRoom(roomButton.dataset.room);
      return;
    }
    const speakerButton = event.target.closest("[data-preview-speaker]");
    if (speakerButton) {
      staffPreviewSender = speakerButton.dataset.previewSpeaker === "member" ? "member" : "staff";
      $$("[data-preview-speaker]").forEach((button) => button.classList.toggle("active", button === speakerButton));
      renderStaffMemberPreview({ forceScroll: true });
      return;
    }
    const roomAction = event.target.closest("[data-staff-room-action]");
    if (roomAction) {
      const row = roomAction.closest("[data-action-room]");
      const roomId = row?.dataset.actionRoom;
      const room = staffRoomsCache.find((item) => item.id === roomId);
      if (!roomId || !room) return;
      const action = roomAction.dataset.staffRoomAction;
      if (action === "pin" || action === "unpin") {
        await post(`/api/chat/staff/${encodeURIComponent(roomId)}/pin`, { pinned: action === "pin" });
      } else if (action === "grade") {
        await post(`/api/chat/staff/${encodeURIComponent(roomId)}/internal-grade-cycle`, {});
      } else if (action === "leave") {
        if (!confirm(`${staffRoomName(room)} 채팅방을 정말 나가시겠습니까`)) return;
        await post(`/api/chat/staff/${encodeURIComponent(roomId)}/leave`, {});
        if (activeRoom === roomId) {
          activeRoom = null;
          $("#staffMessages").innerHTML = "";
          $("#staffRoomMeta").textContent = "상담방을 선택하세요.";
          $("#staffClearRoom")?.setAttribute("disabled", "");
          $("#staffPreviewSpeaker")?.setAttribute("hidden", "");
          staffCurrentMessages = [];
          renderStaffMemberPreview();
        }
      }
      await loadStaffRooms();
      if (activeRoom) await loadStaffMessages();
      return;
    }
    const editButton = event.target.closest("[data-staff-message-edit], [data-staff-preview-edit]");
    if (editButton && activeRoom) {
      $$(".staff-inline-editor").forEach((panel) => { panel.hidden = true; });
      const panel = editButton.closest("[data-message-id]")?.querySelector(".staff-inline-editor");
      if (panel) {
        panel.hidden = false;
        $("textarea", panel)?.focus();
      }
      return;
    }
    const saveEditButton = event.target.closest("[data-staff-edit-save]");
    if (saveEditButton && activeRoom) {
      const id = saveEditButton.dataset.staffEditSave;
      const panel = saveEditButton.closest(".staff-inline-editor");
      const next = $("textarea", panel)?.value || "";
      if (!next.trim()) return;
      if (activeRoom === STAFF_PREVIEW_ROOM) await post("/api/chat/staff-preview/edit-message", { id, message: next });
      else await post(`/api/chat/staff/${encodeURIComponent(activeRoom)}/edit-message`, { id, message: next });
      await loadStaffMessages();
      await loadStaffRooms();
      return;
    }
    const cancelEditButton = event.target.closest("[data-staff-edit-cancel]");
    if (cancelEditButton) {
      cancelEditButton.closest(".staff-inline-editor").hidden = true;
      return;
    }
    const deleteButton = event.target.closest("[data-staff-message-delete], [data-staff-preview-delete]");
    if (deleteButton && activeRoom) {
      event.preventDefault();
      const id = deleteButton.dataset.staffMessageDelete || deleteButton.dataset.staffPreviewDelete;
      if (activeRoom === STAFF_PREVIEW_ROOM) await post("/api/chat/staff-preview/delete-message", { id });
      else await post(`/api/chat/staff/${encodeURIComponent(activeRoom)}/delete-message`, { id });
      await loadStaffMessages();
      await loadStaffRooms();
      return;
    }
    const clearButton = event.target.closest("#staffClearRoom");
    if (clearButton && activeRoom) {
      event.preventDefault();
      if (!confirm("이 상담방의 채팅 내용을 비울까요?")) return;
      if (activeRoom === STAFF_PREVIEW_ROOM) await post("/api/chat/staff-preview/clear", {});
      else await post(`/api/chat/staff/${encodeURIComponent(activeRoom)}/clear`, {});
      resetStaffScrollLock($("#staffMessages"));
      resetStaffScrollLock($("#staffMemberPreviewLog"));
      await loadStaffMessages({ forceScroll: true });
      await loadStaffRooms();
    }
  });
  $("#staffChatAttach")?.addEventListener("click", () => staffFileInput?.click());
  $("#staffMemberPreviewAttach")?.addEventListener("click", () => staffPreviewFileInput?.click());
  staffFileInput?.addEventListener("change", () => {
    const file = staffFileInput.files?.[0];
    if (!file) return clearStaffAttachment();
    if (!file.type.startsWith("image/")) {
      alert("사진 파일만 첨부할 수 있습니다.");
      return clearStaffAttachment();
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("사진은 3MB 이하만 첨부할 수 있습니다.");
      return clearStaffAttachment();
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      selectedStaffAttachment = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
      window.staffSelectedAttachmentForPreview = selectedStaffAttachment;
      if (staffAttachmentPreview) {
        staffAttachmentPreview.innerHTML = `<img src="${escapeAttr(reader.result)}" alt=""><span>${escapeHtml(file.name)}</span><button type="button" aria-label="첨부 삭제">×</button>`;
        $("button", staffAttachmentPreview)?.addEventListener("click", clearStaffAttachment);
      }
      renderStaffMemberPreview();
    });
    reader.readAsDataURL(file);
  });
  staffPreviewFileInput?.addEventListener("change", () => {
    const file = staffPreviewFileInput.files?.[0];
    if (!file) return clearMemberPreviewAttachment();
    if (!file.type.startsWith("image/")) {
      alert("사진 파일만 첨부할 수 있습니다.");
      return clearMemberPreviewAttachment();
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("사진은 3MB 이하만 첨부할 수 있습니다.");
      return clearMemberPreviewAttachment();
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      selectedMemberPreviewAttachment = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
      window.staffMemberPreviewAttachment = selectedMemberPreviewAttachment;
      if (staffMemberPreviewAttachmentPreview) {
        staffMemberPreviewAttachmentPreview.innerHTML = `<img src="${escapeAttr(reader.result)}" alt=""><span>${escapeHtml(file.name)}</span><button type="button" aria-label="첨부 삭제">×</button>`;
        $("button", staffMemberPreviewAttachmentPreview)?.addEventListener("click", clearMemberPreviewAttachment);
      }
      updateStaffDraft();
    });
    reader.readAsDataURL(file);
  });
  staffInput?.addEventListener("input", updateStaffDraft);
  staffPreviewInput?.addEventListener("input", updateStaffDraft);
  syncStaffRoomScroll($("#staffPinnedActions"), $("#staffPinnedRooms"));
  syncStaffRoomScroll($("#staffNormalActions"), $("#staffRooms"));
  window.addEventListener("resize", alignAllStaffActionRows);
  staffInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    staffForm?.requestSubmit();
  });
  staffPreviewInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    staffPreviewForm?.requestSubmit();
  });
  staffPreviewForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeRoom || !staffPreviewInput) return;
    const text = staffPreviewInput.value;
    if (!text.trim() && !selectedMemberPreviewAttachment) return;
    const payload = { senderType: "member", message: text, attachment: selectedMemberPreviewAttachment };
    const request = activeRoom === STAFF_PREVIEW_ROOM
      ? post("/api/chat/staff-preview", payload)
      : post(`/api/chat/staff/${encodeURIComponent(activeRoom)}/member-message`, payload);
    request.then(async () => {
      staffPreviewInput.value = "";
      clearMemberPreviewAttachment();
      autoGrowStaffInput();
      const sendImage = $("#staffMemberPreviewSend .chat-send-button img");
      if (sendImage) sendImage.src = "/assets/chat/send-idle.png";
      $("#staffMemberPreviewSend .chat-send-button")?.classList.remove("active");
      resetStaffScrollLock($("#staffMessages"));
      resetStaffScrollLock($("#staffMemberPreviewLog"));
      await loadStaffMessages({ forceScroll: true });
      await loadStaffRooms();
    }).catch((error) => alert(error.message));
  });
  staffForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeRoom) return;
    const input = $("#staffSend textarea[name=\"message\"]");
    if (!input.value.trim() && !selectedStaffAttachment) return;
    if (activeRoom === STAFF_PREVIEW_ROOM) await post("/api/chat/staff-preview", { senderType: staffPreviewSender, message: input.value, attachment: selectedStaffAttachment });
    else await post(`/api/chat/staff/${encodeURIComponent(activeRoom)}`, { message: input.value, attachment: selectedStaffAttachment });
    input.value = "";
    if (staffPreviewInput) staffPreviewInput.value = "";
    autoGrowStaffInput();
    clearStaffAttachment();
    resetStaffScrollLock($("#staffMessages"));
    resetStaffScrollLock($("#staffMemberPreviewLog"));
    await loadStaffMessages({ forceScroll: true });
    await loadStaffRooms();
  });
  autoGrowStaffInput();
  bindStaffScrollLock($("#staffMessages"));
  bindStaffScrollLock($("#staffMemberPreviewLog"));
  loadStaffRooms();
  renderStaffMemberPreview();
  setInterval(() => {
    loadStaffRooms();
    if (activeRoom && !staffHasOpenEditor()) loadStaffMessages();
  }, 2500);
}

document.addEventListener("click", async (event) => {
  const menuButton = event.target.closest("[data-direct-chat-menu]");
  if (menuButton) {
    event.preventDefault();
    const id = menuButton.dataset.directChatMenu;
    $$("[data-direct-chat-actions]").forEach((item) => item.classList.toggle("open", item.dataset.directChatActions === id && !item.classList.contains("open")));
    return;
  }
  const deleteButton = event.target.closest("[data-direct-chat-delete]");
  if (deleteButton && activeDirectRoom) {
    event.preventDefault();
    await post(`/api/direct-chat/${encodeURIComponent(activeDirectRoom)}/delete-message`, { id: deleteButton.dataset.directChatDelete });
    await loadDirectMessages();
    return;
  }
  if (!event.target.closest(".message-actions")) {
    $$("[data-direct-chat-actions]").forEach((item) => item.classList.remove("open"));
  }
});

async function loadStaffRooms() {
  const list = $("#staffRooms");
  if (!list) return;
  const res = await fetch("/api/chat/staff");
  if (!res.ok) return;
  const { rooms } = await res.json();
  $("#roomCount").textContent = rooms.reduce((sum, room) => sum + (room.staffUnread || 0), 0);
  list.innerHTML = rooms.map((room) => {
    const unread = Number(room.staffUnread || 0);
    const realName = room.realName || room.name || "-";
    const adminPrefix = room.adminManagedTrade ? `[\uAD00\uB9AC\uC790\uAE00] ${escapeHtml(room.tradeTitle || "")} \u00B7 ` : "";
    return `<button class="room-row ${activeRoom === room.id ? "active" : ""} ${unread ? "has-unread" : ""} ${room.adminManagedTrade ? "admin-trade-room" : ""}" data-room="${room.id}">
    <span class="room-row-head"><b>${escapeHtml(room.memberName || room.username)}</b><i>${escapeHtml([room.displayGrade || "-", room.internalGrade || "-", realName].join(" \u00B7 "))}</i></span>${unread ? `<em>${unread}</em>` : ""}<small>${adminPrefix}${escapeHtml(room.lastMessage || "\uCCAB \uC0C1\uB2F4")}</small>
  </button>`;
  }).join("") || "<p class='empty'>\uC0C1\uB2F4\uBC29\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>";
}
async function loadStaffMessages() {
  if (!activeRoom) return;
  const res = await fetch(`/api/chat/staff/${activeRoom}`);
  if (!res.ok) return;
  const { messages } = await res.json();
  $("#staffRoomMeta").textContent = "내부 로그에는 실제 답변 운영진이 저장됩니다.";
  $("#staffClearRoom")?.removeAttribute("disabled");
  const log = $("#staffMessages");
  log.innerHTML = messages.map((m) => {
    const deleted = m.deletedByMember ? "<em class=\"deleted-note\">(삭제)</em>" : "";
    if (m.attachment) chatImageSources.set(m.id, { src: m.attachment.dataUrl, name: m.attachment.name });
    const image = m.attachment ? `<button type="button" class="chat-image-link" data-chat-image-id="${escapeAttr(m.id)}"><img class="chat-image" src="${escapeAttr(m.attachment.dataUrl)}" alt="${escapeAttr(m.attachment.name)}"></button>` : "";
    const read = m.senderType === "staff" && m.read ? "<small class=\"read-receipt\">읽음</small>" : "";
    return `<p class="${m.senderType}" data-message-id="${escapeAttr(m.id)}"><b>${escapeHtml(m.displayName)}${m.internalStaffName ? ` (${escapeHtml(m.internalStaffName)})` : ""}</b><button class="staff-message-delete" type="button" data-staff-message-delete="${escapeAttr(m.id)}" aria-label="메시지 삭제">삭제</button><span>${messageHtml(m.message || "")}${deleted}</span>${image}${read}</p>`;
  }).join("");
  log.scrollTop = log.scrollHeight;
}

if (document.body.dataset.page === "staff" && false) {
  const staffForm = $("#staffSend");
  const staffInput = staffForm?.message;
  const staffFileInput = $("#staffChatFileInput");
  const staffAttachmentPreview = $("#staffChatAttachmentPreview");
  let selectedStaffAttachment = null;
  const clearStaffAttachment = () => {
    selectedStaffAttachment = null;
    if (staffFileInput) staffFileInput.value = "";
    if (staffAttachmentPreview) staffAttachmentPreview.innerHTML = "";
  };
  $("#staffRooms")?.addEventListener("click", (event) => {
    const roomButton = event.target.closest("[data-room]");
    if (!roomButton) return;
    activeRoom = roomButton.dataset.room;
    loadStaffMessages();
    loadStaffRooms();
  });
  document.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-staff-message-delete]");
    if (deleteButton && activeRoom) {
      event.preventDefault();
      await post(`/api/chat/staff/${activeRoom}/delete-message`, { id: deleteButton.dataset.staffMessageDelete });
      loadStaffMessages();
      loadStaffRooms();
      return;
    }
    const clearButton = event.target.closest("#staffClearRoom");
    if (clearButton && activeRoom) {
      event.preventDefault();
      if (!confirm("이 상담방의 채팅 내용을 비울까요?")) return;
      await post(`/api/chat/staff/${activeRoom}/clear`, {});
      loadStaffMessages();
      loadStaffRooms();
    }
  });
  $("#staffChatAttach")?.addEventListener("click", () => staffFileInput?.click());
  staffFileInput?.addEventListener("change", () => {
    const file = staffFileInput.files?.[0];
    if (!file) return clearStaffAttachment();
    if (!file.type.startsWith("image/")) {
      alert("사진 파일만 첨부할 수 있습니다.");
      return clearStaffAttachment();
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("사진은 3MB 이하만 첨부할 수 있습니다.");
      return clearStaffAttachment();
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      selectedStaffAttachment = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
      if (staffAttachmentPreview) {
        staffAttachmentPreview.innerHTML = `<img src="${escapeAttr(reader.result)}" alt=""><span>${escapeHtml(file.name)}</span><button type="button" aria-label="첨부 삭제">×</button>`;
        $("button", staffAttachmentPreview)?.addEventListener("click", clearStaffAttachment);
      }
    });
    reader.readAsDataURL(file);
  });
  staffInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    staffForm?.requestSubmit();
  });
  staffForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeRoom) return;
    const input = event.currentTarget.message;
    if (!input.value.trim() && !selectedStaffAttachment) return;
    await post(`/api/chat/staff/${activeRoom}`, { message: input.value, attachment: selectedStaffAttachment });
    input.value = "";
    clearStaffAttachment();
    loadStaffMessages();
    loadStaffRooms();
  });
  loadStaffRooms();
  setInterval(() => {
    loadStaffRooms();
    if (activeRoom) loadStaffMessages();
  }, 2500);
}
