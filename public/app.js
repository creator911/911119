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

function openMemberChat() {
  if (!chatWidget) return false;
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
  const pointBtn = event.target.closest("[data-point]");
  if (pointBtn) {
    await post("/api/admin/point", { id: pointBtn.dataset.point, decision: pointBtn.dataset.decision });
    location.reload();
  }
  const userBtn = event.target.closest("[data-admin-user]");
  if (userBtn) {
    const displayGrade = prompt("표시등급 입력: 브론즈/실버/골드/플레티넘/다이아/마스터/챌린저");
    const internalGrade = prompt("내부등급 입력: 내부등급 1~5");
    const status = prompt("상태 입력: 정상/정지", "정상");
    await post("/api/admin/user", { id: userBtn.dataset.adminUser, displayGrade, internalGrade, status });
    location.reload();
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
});

function syncNoticeEditor(form) {
  const editor = $("[data-notice-editor]", form);
  const input = form?.elements.body;
  if (!editor || !input) return;
  input.value = editor.innerHTML.trim();
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
  if (input) input.value = preset.dataset.pricePreset;
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

function formatWon(value) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function updateMileageForm(form) {
  if (!form?.classList.contains("mileage-form")) return;
  const input = form.elements.amount;
  const amount = Number(input?.value || 0);
  const balance = Number(form.dataset.balance || 0);
  const isCharge = form.dataset.form === "charge";
  const fee = isCharge && amount > 0 && amount < 50000 ? 1000 : 0;
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

document.addEventListener("click", (event) => {
  const amountPreset = event.target.closest("[data-point-amount]");
  if (!amountPreset) return;
  const form = amountPreset.closest(".mileage-form");
  const input = form?.elements.amount;
  if (!input) return;
  const current = Number(input.value || 0);
  const value = Number(amountPreset.dataset.pointAmount || 0);
  input.value = form.dataset.form === "charge" ? current + value : value;
  updateMileageForm(form);
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
      const data = formData(form);
      const type = form.dataset.form;
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
        message.textContent = "등록되었습니다.";
        form.reset();
      } else if (type === "charge" || type === "withdraw") {
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
  setInterval(() => chatWidget.classList.contains("open") && loadMemberChat(), 2500);
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
    const text = m.message ? `<span>${escapeHtml(m.message)}</span>` : "";
    const image = m.attachment ? `<img class="chat-image" src="${escapeAttr(m.attachment.dataUrl)}" alt="${escapeAttr(m.attachment.name)}">` : "";
    const action = side === "member" ? `<button class="message-more" data-chat-menu="${escapeAttr(m.id)}" aria-label="메시지 액션">⋮</button><em class="message-actions" data-chat-actions="${escapeAttr(m.id)}"><button type="button" data-chat-delete="${escapeAttr(m.id)}">메시지 삭제</button></em>` : "";
    return `<p class="${side}" data-message-id="${escapeAttr(m.id)}"><b>${escapeHtml(name)}</b>${action}${text}${image}</p>`;
  }).join("");
  log.scrollTop = log.scrollHeight;
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

let activeRoom = null;
async function loadStaffRooms() {
  const list = $("#staffRooms");
  if (!list) return;
  const res = await fetch("/api/chat/staff");
  if (!res.ok) return;
  const { rooms } = await res.json();
  $("#roomCount").textContent = rooms.reduce((sum, room) => sum + (room.staffUnread || 0), 0);
  list.innerHTML = rooms.map((room) => `<button class="room-row ${activeRoom === room.id ? "active" : ""}" data-room="${room.id}">
    <b>${room.memberName || room.username}</b><span>${room.displayGrade} · ${room.internalGrade}</span><em>${room.staffUnread || 0}</em><small>${room.lastMessage || "새 상담"}</small>
  </button>`).join("") || "<p class='empty'>상담방이 없습니다.</p>";
  $$("[data-room]", list).forEach((btn) => btn.addEventListener("click", () => {
    activeRoom = btn.dataset.room;
    loadStaffMessages();
    loadStaffRooms();
  }));
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
    const image = m.attachment ? `<img class="chat-image" src="${escapeAttr(m.attachment.dataUrl)}" alt="${escapeAttr(m.attachment.name)}">` : "";
    const read = m.senderType === "staff" && m.read ? "<small class=\"read-receipt\">읽음</small>" : "";
    return `<p class="${m.senderType}" data-message-id="${escapeAttr(m.id)}"><b>${escapeHtml(m.displayName)}${m.internalStaffName ? ` (${escapeHtml(m.internalStaffName)})` : ""}</b><button class="staff-message-delete" type="button" data-staff-message-delete="${escapeAttr(m.id)}" aria-label="메시지 삭제">삭제</button><span>${escapeHtml(m.message || "")}${deleted}</span>${image}${read}</p>`;
  }).join("");
  log.scrollTop = log.scrollHeight;
}

if (document.body.dataset.page === "staff") {
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
  $("#staffSend")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeRoom) return;
    const input = event.currentTarget.message;
    await post(`/api/chat/staff/${activeRoom}`, { message: input.value });
    input.value = "";
    loadStaffMessages();
    loadStaffRooms();
  });
  loadStaffRooms();
  setInterval(() => {
    loadStaffRooms();
    if (activeRoom) loadStaffMessages();
  }, 2500);
}
