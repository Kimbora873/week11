// TaskFlow 대시보드 클라이언트 UI 스크립트

document.addEventListener("DOMContentLoaded", () => {
  const modalController = initDeleteModal();
  initSidebarDrawer();
  initQuickAddFocus();
  const calendarController = initCalendarAndViewSwitcher(modalController);
  initSearchFilter(calendarController);
});

function initSidebarDrawer() {
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const toggleBtn = document.getElementById("sidebarToggle");
  const closeBtn = document.getElementById("sidebarClose");

  if (!sidebar || !backdrop || !toggleBtn) return;

  const setOpen = (isOpen) => {
    sidebar.classList.toggle("is-open", isOpen);
    backdrop.classList.toggle("is-open", isOpen);
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  };

  toggleBtn.addEventListener("click", () => {
    setOpen(!sidebar.classList.contains("is-open"));
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => setOpen(false));
  }

  backdrop.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
      setOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 960 && sidebar.classList.contains("is-open")) {
      setOpen(false);
    }
  });

  return { close: () => setOpen(false) };
}

function initQuickAddFocus() {
  const focusBtn = document.getElementById("focusNewTodo");
  const titleInput = document.getElementById("todoTitleInput");
  const addCard = document.getElementById("add-task");

  if (!focusBtn || !titleInput) return;

  focusBtn.addEventListener("click", () => {
    if (addCard) {
      addCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => titleInput.focus(), 180);
  });
}

function initSearchFilter(calendarController) {
  const searchInput = document.getElementById("todoSearch");
  const groupsContainer = document.getElementById("dateGroups");
  const emptyState = document.getElementById("searchEmptyState");

  if (!searchInput) return;

  const groupCards = groupsContainer
    ? Array.from(groupsContainer.querySelectorAll(".date-group-card"))
    : [];

  searchInput.addEventListener("input", () => {
    const keyword = searchInput.value.trim().toLowerCase();
    let visibleGroups = 0;

    groupCards.forEach((card) => {
      const items = Array.from(card.querySelectorAll(".todo-item"));
      let visibleItems = 0;

      items.forEach((item) => {
        const title = item.dataset.title || "";
        const matched = keyword === "" || title.includes(keyword);
        item.hidden = !matched;
        if (matched) visibleItems += 1;
      });

      card.hidden = visibleItems === 0;
      if (visibleItems > 0) visibleGroups += 1;
    });

    if (emptyState) {
      emptyState.hidden = visibleGroups > 0;
    }

    if (calendarController) {
      calendarController.setKeyword(keyword);
    }
  });
}

function initDeleteModal() {
  const modal = document.getElementById("deleteModal");
  const desc = document.getElementById("deleteModalDesc");
  const cancelBtn = document.getElementById("cancelDeleteBtn");
  const confirmBtn = document.getElementById("confirmDeleteBtn");

  if (!modal || !cancelBtn || !confirmBtn) return null;

  let pendingForm = null;

  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    pendingForm = null;
  };

  const openForForm = (form) => {
    pendingForm = form;
    const todoTitle = form.dataset.todoTitle || "선택한 일정";
    if (desc) {
      desc.textContent = `"${todoTitle}" 일정을 삭제하면 복구할 수 없습니다.`;
    }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    confirmBtn.focus();
  };

  document.querySelectorAll(".js-delete-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      openForForm(form);
    });
  });

  cancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  confirmBtn.addEventListener("click", () => {
    if (pendingForm) {
      const formToSubmit = pendingForm;
      closeModal();
      formToSubmit.submit();
    }
  });

  return { bindForm: (form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      openForForm(form);
    });
  }};
}

function initCalendarAndViewSwitcher(modalController) {
  const dataEl = document.getElementById("todosDataJson");
  const todayEl = document.getElementById("todayKeyJson");
  const listPanel = document.getElementById("listViewPanel");
  const calPanel = document.getElementById("calendarViewPanel");
  const viewListBtn = document.getElementById("viewListBtn");
  const viewCalendarBtn = document.getElementById("viewCalendarBtn");
  const sidebarCalendarLink = document.getElementById("sidebarCalendarLink");
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");

  if (!dataEl || !listPanel || !calPanel || !viewListBtn || !viewCalendarBtn) {
    return null;
  }

  const allTodos = JSON.parse(dataEl.textContent || "[]");
  const todayKey = todayEl ? JSON.parse(todayEl.textContent || '""') : "";
  const [initYear, initMonth] = (todayKey || "2026-11-01").split("-").map(Number);

  let currentYear = initYear;
  let currentMonth = initMonth - 1; // 0-indexed
  let selectedDateKey = todayKey;
  let searchKeyword = "";

  const monthLabel = document.getElementById("calendarMonthLabel");
  const calendarGrid = document.getElementById("calendarGrid");
  const prevBtn = document.getElementById("calPrevBtn");
  const todayBtn = document.getElementById("calTodayBtn");
  const nextBtn = document.getElementById("calNextBtn");
  const dayTitleEl = document.getElementById("calendarDayTitle");
  const dayCountEl = document.getElementById("calendarDayCount");
  const dayBodyEl = document.getElementById("calendarDayBody");
  const noDateCard = document.getElementById("calendarNoDateCard");
  const noDateCount = document.getElementById("calendarNoDateCount");
  const noDateBody = document.getElementById("calendarNoDateBody");

  const priorityTextMap = { 1: "낮음", 2: "보통", 3: "높음" };
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  const pad2 = (n) => String(n).padStart(2, "0");
  const toKey = (y, m0, d) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

  const formatDateKorean = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return `${y}년 ${m}월 ${d}일 (${weekDays[dt.getDay()]})`;
  };

  const getFilteredTodos = () => {
    if (!searchKeyword) return allTodos;
    return allTodos.filter((t) => (t.title || "").toLowerCase().includes(searchKeyword));
  };

  const buildTodoRow = (todo) => {
    const li = document.createElement("li");
    li.className = `todo-item priority-${todo.priority} ${todo.done ? "is-done" : ""}`;

    const toggleForm = document.createElement("form");
    toggleForm.method = "POST";
    toggleForm.action = `/todos/${todo.id}/toggle`;
    toggleForm.className = "toggle-form";

    const checkBtn = document.createElement("button");
    checkBtn.type = "submit";
    checkBtn.className = `check-btn ${todo.done ? "checked" : ""}`;
    checkBtn.setAttribute("aria-label", `${todo.title} 완료 토글`);
    if (todo.done) {
      checkBtn.textContent = "✓";
    }
    toggleForm.appendChild(checkBtn);

    const body = document.createElement("div");
    body.className = "todo-body";

    const titleSpan = document.createElement("span");
    titleSpan.className = "todo-title";
    titleSpan.textContent = todo.title;

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    const pBadge = document.createElement("span");
    pBadge.className = `priority-badge priority-badge-${todo.priority}`;
    pBadge.textContent = `중요도 ${todo.priority} · ${priorityTextMap[todo.priority] || "보통"}`;

    const rangeChip = document.createElement("span");
    rangeChip.className = "meta-chip";
    if (todo.startDateKey && todo.dateKey && todo.startDateKey !== todo.dateKey) {
      rangeChip.textContent = `${todo.startDateKey} ~ ${todo.dateKey}`;
    } else if (todo.startDateKey && !todo.dateKey) {
      rangeChip.textContent = `${todo.startDateKey} ~`;
    } else if (todo.dateKey) {
      rangeChip.textContent = todo.dateKey;
    } else {
      rangeChip.textContent = "기한 없음";
    }

    const status = document.createElement("span");
    status.className = `meta-status ${todo.done ? "done" : "active"}`;
    status.textContent = todo.done ? "완료" : "미완료";

    meta.appendChild(pBadge);
    meta.appendChild(rangeChip);
    meta.appendChild(status);
    body.appendChild(titleSpan);
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editLink = document.createElement("a");
    editLink.className = "action-btn edit-link";
    editLink.href = `/todos/${todo.id}/edit`;
    editLink.textContent = "수정";

    const delForm = document.createElement("form");
    delForm.method = "POST";
    delForm.action = `/todos/${todo.id}/delete`;
    delForm.className = "js-delete-form";
    delForm.dataset.todoTitle = todo.title;

    const delBtn = document.createElement("button");
    delBtn.type = "submit";
    delBtn.className = "action-btn delete-btn";
    delBtn.textContent = "삭제";
    delForm.appendChild(delBtn);
    if (modalController) {
      modalController.bindForm(delForm);
    }

    actions.appendChild(editLink);
    actions.appendChild(delForm);

    li.appendChild(toggleForm);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  };

  const getTodoRange = (t) => {
    const start = t.startDateKey || t.dateKey || "";
    const end = t.dateKey || t.startDateKey || "";
    if (!start && !end) return null;
    return start <= end ? { start, end } : { start: end, end: start };
  };

  const getTodosForDateKey = (filtered, key) => {
    return filtered.filter((t) => {
      const r = getTodoRange(t);
      return r ? key >= r.start && key <= r.end : false;
    });
  };

  const renderDayDetail = (filtered) => {
    if (!dayTitleEl || !dayCountEl || !dayBodyEl) return;
    const list = getTodosForDateKey(filtered, selectedDateKey);
    dayTitleEl.textContent = formatDateKorean(selectedDateKey);
    dayCountEl.textContent = `${list.length}건`;
    dayBodyEl.replaceChildren();

    if (list.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-inline";
      const p = document.createElement("p");
      p.textContent = "선택한 날짜에 해당하는 일정이 없습니다.";
      emptyDiv.appendChild(p);
      dayBodyEl.appendChild(emptyDiv);
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "todo-list";
    list.forEach((t) => ul.appendChild(buildTodoRow(t)));
    dayBodyEl.appendChild(ul);
  };

  const renderCalendar = () => {
    if (!calendarGrid || !monthLabel) return;

    const filtered = getFilteredTodos();
    const undated = filtered.filter((t) => !getTodoRange(t));

    monthLabel.textContent = `${currentYear}년 ${currentMonth + 1}월`;
    calendarGrid.replaceChildren();

    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i += 1) {
      let cellYear = currentYear;
      let cellMonth = currentMonth;
      let cellDay;
      let isOtherMonth = false;

      if (i < firstDayOfWeek) {
        isOtherMonth = true;
        cellDay = prevMonthLastDay - firstDayOfWeek + i + 1;
        cellMonth = currentMonth - 1;
        if (cellMonth < 0) {
          cellMonth = 11;
          cellYear -= 1;
        }
      } else if (i >= firstDayOfWeek + daysInMonth) {
        isOtherMonth = true;
        cellDay = i - (firstDayOfWeek + daysInMonth) + 1;
        cellMonth = currentMonth + 1;
        if (cellMonth > 11) {
          cellMonth = 0;
          cellYear += 1;
        }
      } else {
        cellDay = i - firstDayOfWeek + 1;
      }

      const key = toKey(cellYear, cellMonth, cellDay);
      const dayOfWeek = i % 7;
      const cellTodos = getTodosForDateKey(filtered, key);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "calendar-cell";
      if (isOtherMonth) cell.classList.add("is-other-month");
      if (dayOfWeek === 0) cell.classList.add("is-sun");
      if (dayOfWeek === 6) cell.classList.add("is-sat");
      if (key === todayKey) cell.classList.add("is-today");
      if (key === selectedDateKey) cell.classList.add("is-selected");
      cell.setAttribute("aria-label", `${formatDateKorean(key)} (${cellTodos.length}건)`);

      const top = document.createElement("div");
      top.className = "cal-cell-top";

      const numSpan = document.createElement("span");
      numSpan.className = "cal-day-num";
      numSpan.textContent = String(cellDay);
      top.appendChild(numSpan);

      if (cellTodos.length > 0) {
        const countSpan = document.createElement("span");
        countSpan.className = "cal-count-dot";
        countSpan.textContent = `${cellTodos.length}`;
        top.appendChild(countSpan);
      }

      const eventsDiv = document.createElement("div");
      eventsDiv.className = "cal-events";

      cellTodos.slice(0, 3).forEach((t) => {
        const r = getTodoRange(t);
        const isMultiDay = r && r.start !== r.end;
        const pill = document.createElement("span");
        pill.className = `cal-event-pill priority-${t.priority} ${t.done ? "is-done" : ""}`;

        let displayTitle = t.title;
        if (isMultiDay) {
          if (key === r.start) {
            pill.classList.add("is-span-start");
            displayTitle = `▶ ${t.title}`;
          } else if (key === r.end) {
            pill.classList.add("is-span-end");
            displayTitle = `${t.title} ◀`;
          } else {
            pill.classList.add("is-span-mid");
            displayTitle = `↔ ${t.title}`;
          }
          pill.title = `${t.title} (${r.start} ~ ${r.end}, 중요도 ${t.priority})`;
        } else {
          pill.title = `${t.title} (중요도 ${t.priority})`;
        }

        pill.textContent = displayTitle;
        eventsDiv.appendChild(pill);
      });

      if (cellTodos.length > 3) {
        const more = document.createElement("span");
        more.className = "cal-more";
        more.textContent = `+${cellTodos.length - 3}건 더보기`;
        eventsDiv.appendChild(more);
      }

      cell.appendChild(top);
      cell.appendChild(eventsDiv);

      cell.addEventListener("click", () => {
        selectedDateKey = key;
        if (isOtherMonth) {
          currentYear = cellYear;
          currentMonth = cellMonth;
        }
        renderCalendar();
      });

      calendarGrid.appendChild(cell);
    }

    renderDayDetail(filtered);

    if (noDateCard && noDateCount && noDateBody) {
      if (undated.length === 0) {
        noDateCard.hidden = true;
      } else {
        noDateCard.hidden = false;
        noDateCount.textContent = `${undated.length}건`;
        noDateBody.replaceChildren();
        const ul = document.createElement("ul");
        ul.className = "todo-list";
        undated.forEach((t) => ul.appendChild(buildTodoRow(t)));
        noDateBody.appendChild(ul);
      }
    }
  };

  const switchView = (mode) => {
    const isCal = mode === "calendar";
    listPanel.hidden = isCal;
    calPanel.hidden = !isCal;
    viewListBtn.classList.toggle("active", !isCal);
    viewListBtn.setAttribute("aria-selected", String(!isCal));
    viewCalendarBtn.classList.toggle("active", isCal);
    viewCalendarBtn.setAttribute("aria-selected", String(isCal));

    if (sidebarCalendarLink) {
      sidebarCalendarLink.classList.toggle("active", isCal);
    }

    try {
      sessionStorage.setItem("taskflow_view_mode", mode);
    } catch (_) {}

    if (isCal) {
      renderCalendar();
    }
  };

  viewListBtn.addEventListener("click", () => switchView("list"));
  viewCalendarBtn.addEventListener("click", () => switchView("calendar"));

  if (sidebarCalendarLink) {
    sidebarCalendarLink.addEventListener("click", (event) => {
      event.preventDefault();
      switchView("calendar");
      if (sidebar && backdrop && sidebar.classList.contains("is-open")) {
        sidebar.classList.remove("is-open");
        backdrop.classList.remove("is-open");
        document.body.style.overflow = "";
      }
      const section = document.getElementById("scheduleSection");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentMonth -= 1;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear -= 1;
      }
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentMonth += 1;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear += 1;
      }
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      currentYear = initYear;
      currentMonth = initMonth - 1;
      selectedDateKey = todayKey;
      renderCalendar();
    });
  }

  // URL 해시(#calendar) 또는 이전 세션 뷰 상태 복원
  let initialMode = "list";
  if (window.location.hash === "#calendar") {
    initialMode = "calendar";
  } else {
    try {
      if (sessionStorage.getItem("taskflow_view_mode") === "calendar") {
        initialMode = "calendar";
      }
    } catch (_) {}
  }
  switchView(initialMode);

  return {
    setKeyword: (kw) => {
      searchKeyword = kw;
      if (!calPanel.hidden) {
        renderCalendar();
      }
    },
  };
}
