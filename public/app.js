const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

const focusChargeAccount = sessionStorage.getItem("focusChargeAccount");
if (focusChargeAccount) {
  sessionStorage.removeItem("focusChargeAccount");
  requestAnimationFrame(() => {
    $(".charge-account-check")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

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

function openMemberChat() {
  if (!chatWidget) return false;
  closeDirectChat();
  chatWidget.classList.add("open");
  chatOpen?.classList.add("is-open");
  chatOpen?.setAttribute("aria-expanded", "true");
  loadMemberChat();
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
  const noticeToggle = event.target.closest("[data-toggle-notice-form]");
  if (noticeToggle) {
    const form = $(".admin-notice-form");
    if (form) form.hidden = !form.hidden;
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

function syncTradeEditor(form) {
  const editor = $("[data-trade-editor]", form);
  if (!editor) return;
  if (form?.elements.description) form.elements.description.value = editor.innerHTML.trim();
  if (form?.elements.descriptionText) form.elements.descriptionText.value = editor.innerText.trim();
}

document.addEventListener("change", async (event) => {
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

const bannerDots = $$(".banner-dots i");
if (bannerDots.length) {
  let activeBannerDot = 0;
  setInterval(() => {
    bannerDots[activeBannerDot]?.classList.remove("active");
    activeBannerDot = (activeBannerDot + 1) % bannerDots.length;
    bannerDots[activeBannerDot]?.classList.add("active");
  }, 2800);
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
      const base = picker.dataset.composeType === "buy" ? "/buy" : "/sell";
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
    const base = picker?.dataset.composeType === "buy" ? "/buy" : "/sell";
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

$$('form[data-form="sell"], form[data-form="buy"]').forEach((form) => {
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
const passwordPattern = /^(?=.*[a-z])(?=.*\d)[a-z\d]{8,}$/;

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
    guide.textContent = "8자 이상, 영문 소문자와 숫자를 조합해주세요.";
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

const signupForm = $('form[data-form="signup"]');
if (signupForm) {
  $$("input[name='phoneMid'], input[name='phoneLast']", signupForm).forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 4);
      if (input.value.length === 4 && input.name === "phoneMid") signupForm.elements.phoneLast?.focus();
    });
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
}

$$("form[data-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $(".form-message", form);
    try {
      const type = form.dataset.form;
      if (type === "sell" || type === "buy") syncTradeEditor(form);
      const data = formData(form);
      if (type === "login") {
        await post("/api/login", data);
        location.href = "/";
      } else if (type === "signup") {
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
      } else if (type === "notice") {
        syncNoticeEditor(form);
        data.body = form.elements.body?.value || "";
        await post("/api/admin/notice", data);
        message.textContent = "공지사항이 추가되었습니다.";
        setTimeout(() => location.reload(), 450);
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
    loadMemberChat();
  });
  updateChatSendState();
  loadMemberUnread();
  setInterval(() => chatWidget.classList.contains("open") && loadMemberChat(), 2500);
  setInterval(loadMemberUnread, 2500);
}

async function loadMemberChat() {
  const log = $("#memberChatLog");
  if (!log) return;
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
  log.scrollTop = log.scrollHeight;
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
  directChatRooms.innerHTML = rooms.map((room) => `<button type="button" class="direct-room-row ${activeDirectRoom === room.id ? "active" : ""} ${Number(room.unread || 0) > 0 ? "has-unread" : ""} ${room.systemOnly && Number(room.unread || 0) > 0 ? "system-unread" : ""}" data-direct-room="${escapeAttr(room.id)}">
    <img src="${escapeAttr(room.systemOnly ? (room.peerGradeAsset || "/assets/tiers/master.png") : room.peerGradeAsset || "")}" alt="">
    <span>
      <b>${escapeHtml(room.peerNickname || "회원")}</b>
      <small>${escapeHtml(room.tradeTitle || "거래글")}</small>
      <em>${escapeHtml(room.lastMessage || "아직 대화가 없습니다.")}</em>
    </span>
    ${room.unread ? `<i>${Number(room.unread)}</i>` : ""}
  </button>`).join("") || directChatEmpty("현재 채팅이 없습니다.");
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

let activeRoom = null;
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
    return `<button class="room-row ${activeRoom === room.id ? "active" : ""} ${unread ? "has-unread" : ""}" data-room="${room.id}">
    <span class="room-row-head"><b>${escapeHtml(room.memberName || room.username)}</b><i>${escapeHtml([room.displayGrade || "-", room.internalGrade || "-", realName].join(" · "))}</i></span>${unread ? `<em>${unread}</em>` : ""}<small>${escapeHtml(room.lastMessage || "새 상담")}</small>
  </button>`;
  }).join("") || "<p class='empty'>상담방이 없습니다.</p>";
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

if (document.body.dataset.page === "staff") {
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
