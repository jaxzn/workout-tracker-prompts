(function () {
  "use strict";

  var program = globalThis.WorkoutProgram;
  var STORAGE = program.STORAGE;
  var CUSTOM = "__custom__";

  var state = {
    draft: null,
    saved: [],
    persistOk: true,
  };

  var memoryStore = new Map();
  var flashToken = 0;
  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function storageGet(key) {
    if (!state.persistOk) return memoryStore.has(key) ? memoryStore.get(key) : null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      state.persistOk = false;
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
  }

  function storageSet(key, value) {
    memoryStore.set(key, value);
    if (!state.persistOk) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      state.persistOk = false;
    }
  }

  function parseJSON(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function flash(text) {
    var token = ++flashToken;
    els.status.textContent = text;
    window.setTimeout(function () {
      if (flashToken === token) els.status.textContent = "";
    }, 4200);
  }

  function showStorageNote() {
    els.storageNote.hidden = state.persistOk;
  }

  function persistDraft() {
    storageSet(STORAGE.draft, JSON.stringify(state.draft));
    showStorageNote();
  }

  function persistSaved() {
    storageSet(STORAGE.saved, JSON.stringify(state.saved));
    showStorageNote();
  }

  function updateSaveLabel() {
    els.save.textContent = state.draft.savedId ? "Update saved workout" : "Save workout";
  }

  function domMatchesState() {
    if (!els.exercises) return false;
    return els.exercises.querySelectorAll(".exercise").length === state.draft.exercises.length;
  }

  function syncFromDom() {
    if (!domMatchesState()) return;
    var cards = els.exercises.querySelectorAll(".exercise");
    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      var exercise = findExercise(card.dataset.id);
      if (!exercise) continue;
      var name = card.querySelector(".ex-name");
      if (name) exercise.name = name.value;
      var rows = card.querySelectorAll(".set-row");
      for (var r = 0; r < rows.length; r += 1) {
        var row = rows[r];
        var set = findSet(exercise, row.dataset.id);
        if (!set) continue;
        var weight = row.querySelector(".set-weight");
        var reps = row.querySelector(".set-reps");
        if (weight) set.weight = weight.value;
        if (reps) set.reps = reps.value;
      }
    }
  }

  function renderPreview() {
    syncFromDom();
    els.message.textContent = program.formatChat(state.draft);
    sizeDock();
  }

  function sizeDock() {
    if (!els.dock) return;
    var height = els.dock.offsetHeight;
    if (height) document.documentElement.style.setProperty("--dock-h", height + "px");
  }

  function pinDock() {
    if (!window.visualViewport || !els.dock) return;
    var vv = window.visualViewport;
    var overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    els.dock.style.bottom = overlap ? overlap + "px" : "0px";
  }

  function findExercise(id) {
    for (var i = 0; i < state.draft.exercises.length; i += 1) {
      if (state.draft.exercises[i].id === id) return state.draft.exercises[i];
    }
    return null;
  }

  function findSet(exercise, id) {
    for (var i = 0; i < exercise.sets.length; i += 1) {
      if (exercise.sets[i].id === id) return exercise.sets[i];
    }
    return null;
  }

  function findCard(id) {
    var cards = els.exercises.querySelectorAll(".exercise");
    for (var i = 0; i < cards.length; i += 1) {
      if (cards[i].dataset.id === id) return cards[i];
    }
    return null;
  }

  function isBodyweight(value) {
    return /^(bw|bodyweight|body\s+weight)$/i.test(String(value || "").trim());
  }

  function setHasData(set) {
    return String(set.weight || "").trim() !== "" || String(set.reps || "").trim() !== "";
  }

  function exerciseHasData(exercise) {
    if (String(exercise.name || "").trim()) return true;
    for (var i = 0; i < exercise.sets.length; i += 1) {
      if (setHasData(exercise.sets[i])) return true;
    }
    return false;
  }

  function fillExerciseSelect() {
    program.EXERCISES.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      els.pick.append(option);
    });
    var custom = document.createElement("option");
    custom.value = CUSTOM;
    custom.textContent = "Custom name";
    els.pick.append(custom);
  }

  function renderExercises() {
    els.exercises.replaceChildren();
    els.exerciseEmpty.hidden = state.draft.exercises.length > 0;
    state.draft.exercises.forEach(function (exercise) {
      els.exercises.append(renderExercise(exercise));
    });
  }

  function renderExercise(exercise) {
    var card = document.createElement("article");
    card.className = "card exercise";
    card.dataset.id = exercise.id;

    var head = document.createElement("div");
    head.className = "ex-head";
    var nameWrap = document.createElement("div");
    var nameId = "ex-" + exercise.id;
    var nameLabel = document.createElement("label");
    nameLabel.htmlFor = nameId;
    nameLabel.textContent = "Exercise";
    var nameInput = document.createElement("input");
    nameInput.id = nameId;
    nameInput.className = "ex-name";
    nameInput.type = "text";
    nameInput.maxLength = 80;
    nameInput.value = exercise.name;
    nameInput.autocomplete = "off";
    nameInput.spellcheck = false;
    nameWrap.append(nameLabel, nameInput);

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.dataset.action = "remove-exercise";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + (exercise.name || "exercise"));
    head.append(nameWrap, remove);

    var columns = document.createElement("div");
    columns.className = "set-columns";
    columns.setAttribute("aria-hidden", "true");
    ["", "Weight", "", "Reps", ""].forEach(function (text) {
      var span = document.createElement("span");
      span.textContent = text;
      columns.append(span);
    });

    var sets = document.createElement("div");
    sets.className = "sets";
    exercise.sets.forEach(function (set, index) {
      sets.append(renderSet(set, index));
    });

    var add = document.createElement("button");
    add.type = "button";
    add.className = "secondary add-set";
    add.dataset.action = "add-set";
    add.textContent = "+ Set";

    card.append(head, columns, sets, add);
    return card;
  }

  function renderSet(set, index) {
    var row = document.createElement("div");
    row.className = "set-row";
    row.dataset.id = set.id;

    var number = document.createElement("span");
    number.className = "set-index";
    number.textContent = String(index + 1);

    var weight = document.createElement("input");
    weight.className = "set-weight";
    weight.type = "text";
    weight.inputMode = "decimal";
    weight.maxLength = 16;
    weight.value = set.weight;
    weight.placeholder = "lb";
    weight.autocomplete = "off";
    weight.spellcheck = false;
    weight.setAttribute("aria-label", "Set " + (index + 1) + " weight");

    var bw = document.createElement("button");
    bw.type = "button";
    bw.className = "bw-btn";
    bw.dataset.action = "bw";
    bw.textContent = "BW";
    bw.setAttribute("aria-label", "Set " + (index + 1) + " bodyweight");
    bw.setAttribute("aria-pressed", isBodyweight(set.weight) ? "true" : "false");

    var reps = document.createElement("input");
    reps.className = "set-reps";
    reps.type = "text";
    reps.inputMode = "numeric";
    reps.maxLength = 8;
    reps.value = set.reps;
    reps.placeholder = "reps";
    reps.autocomplete = "off";
    reps.setAttribute("aria-label", "Set " + (index + 1) + " reps");

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.dataset.action = "remove-set";
    remove.textContent = "\u00d7";
    remove.setAttribute("aria-label", "Remove set " + (index + 1));

    row.append(number, weight, bw, reps, remove);
    return row;
  }

  function renderSaved() {
    els.savedList.replaceChildren();
    els.savedEmpty.hidden = state.saved.length > 0;
    state.saved.forEach(function (entry) {
      var item = document.createElement("li");
      item.className = "log-item";
      var summary = program.savedLabel(entry);
      var use = document.createElement("button");
      use.type = "button";
      use.className = "use-btn";
      use.dataset.action = "use-saved";
      use.dataset.id = entry.id;
      var title = document.createElement("span");
      title.className = "log-title";
      title.textContent = summary.title;
      var detail = document.createElement("span");
      detail.className = "log-detail";
      detail.textContent = summary.detail;
      use.append(title, detail);
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.dataset.action = "remove-saved";
      remove.dataset.id = entry.id;
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove saved workout " + summary.title);
      item.append(use, remove);
      els.savedList.append(item);
    });
  }

  function disarm(button, label) {
    window.setTimeout(function () {
      if (!button.isConnected) return;
      if (button.dataset.armed !== "true") return;
      button.dataset.armed = "false";
      button.textContent = label;
    }, 2800);
  }

  function addSelectedExercise() {
    var choice = els.pick.value;
    if (!choice) {
      flash("Choose an exercise.");
      els.pick.focus();
      return;
    }
    var name = choice;
    if (choice === CUSTOM) {
      name = els.custom.value.trim();
      if (!name) {
        flash("Name the exercise.");
        els.custom.focus();
        return;
      }
    }
    var exercise = program.createExercise(name);
    state.draft.exercises.push(exercise);
    els.pick.value = "";
    els.custom.value = "";
    els.customField.hidden = true;
    renderExercises();
    renderPreview();
    persistDraft();
    var card = findCard(exercise.id);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      var input = card.querySelector(".set-weight");
      if (input) input.focus();
    }
  }

  function addSet(exerciseId) {
    syncFromDom();
    var exercise = findExercise(exerciseId);
    if (!exercise) return;
    var set = program.newSet(exercise.sets);
    exercise.sets.push(set);
    renderExercises();
    renderPreview();
    persistDraft();
    var card = findCard(exerciseId);
    if (!card) return;
    var rows = card.querySelectorAll(".set-row");
    var last = rows[rows.length - 1];
    if (!last) return;
    var input = last.querySelector(".set-weight");
    if (input) input.focus();
  }

  function removeSet(exerciseId, setId, button) {
    syncFromDom();
    var exercise = findExercise(exerciseId);
    if (!exercise) return;
    var set = findSet(exercise, setId);
    if (!set) return;
    if (setHasData(set) && button && button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = "OK";
      disarm(button, "\u00d7");
      return;
    }
    exercise.sets = exercise.sets.filter(function (item) { return item.id !== setId; });
    renderExercises();
    renderPreview();
    persistDraft();
  }

  function removeExercise(exerciseId, button) {
    var exercise = findExercise(exerciseId);
    if (!exercise) return;
    if (exerciseHasData(exercise) && button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = "Confirm";
      disarm(button, "Remove");
      return;
    }
    state.draft.exercises = state.draft.exercises.filter(function (item) {
      return item.id !== exerciseId;
    });
    renderExercises();
    renderPreview();
    persistDraft();
    flash("Removed " + (exercise.name || "exercise") + ".");
  }

  function useSaved(id, button) {
    var entry = null;
    for (var i = 0; i < state.saved.length; i += 1) {
      if (state.saved[i].id === id) entry = state.saved[i];
    }
    if (!entry) return;
    if (state.draft.exercises.length && button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      var title = button.querySelector(".log-title");
      if (title) title.textContent = "Replace current exercises?";
      window.setTimeout(function () {
        if (!button.isConnected || button.dataset.armed !== "true") return;
        button.dataset.armed = "false";
        renderSaved();
      }, 2800);
      return;
    }
    state.draft.exercises = program.cloneExercises(entry.draft.exercises);
    state.draft.savedId = null;
    renderExercises();
    renderPreview();
    updateSaveLabel();
    persistDraft();
    var summary = program.savedLabel(entry);
    flash("Started from " + summary.title + ".");
    if (els.exercises.firstElementChild) {
      els.exercises.firstElementChild.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function removeSaved(id, button) {
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = "Confirm";
      disarm(button, "Remove");
      return;
    }
    state.saved = state.saved.filter(function (entry) { return entry.id !== id; });
    if (state.draft.savedId === id) {
      state.draft.savedId = null;
      persistDraft();
      updateSaveLabel();
    }
    persistSaved();
    renderSaved();
    flash("Removed the saved workout.");
  }

  function saveWorkout() {
    if (!state.draft.exercises.length) {
      flash("Add an exercise before saving.");
      return;
    }
    var snapshot = program.normalizeDraft(program.snapshotDraft(state.draft), new Date());
    snapshot.date = state.draft.date;
    var existing = null;
    if (state.draft.savedId) {
      for (var i = 0; i < state.saved.length; i += 1) {
        if (state.saved[i].id === state.draft.savedId) existing = state.saved[i];
      }
    }
    if (existing) {
      existing.draft = snapshot;
      existing.savedAt = new Date().toISOString();
      persistSaved();
      renderSaved();
      flash("Updated the saved workout.");
      return;
    }
    var id = program.uid();
    state.saved.unshift({
      id: id,
      savedAt: new Date().toISOString(),
      draft: snapshot,
    });
    state.saved = state.saved.slice(0, 40);
    state.draft.savedId = id;
    persistSaved();
    persistDraft();
    updateSaveLabel();
    renderSaved();
    flash("Saved on this phone.");
  }

  function clearWorkout() {
    if (state.draft.exercises.length && els.clear.dataset.armed !== "true") {
      els.clear.dataset.armed = "true";
      els.clear.textContent = "Confirm clear";
      disarm(els.clear, "Clear workout");
      return;
    }
    els.clear.dataset.armed = "false";
    els.clear.textContent = "Clear workout";
    var date = state.draft.date;
    state.draft = program.blankDraft(date);
    renderExercises();
    renderPreview();
    updateSaveLabel();
    persistDraft();
    flash("Cleared this workout.");
  }

  function onDate() {
    var parsed = program.parseISODate(els.date.value);
    if (Number.isNaN(parsed.getTime())) return;
    state.draft.date = els.date.value;
    renderPreview();
    persistDraft();
  }

  function onExerciseInput(event) {
    var target = event.target;
    var card = target.closest(".exercise");
    if (!card) return;
    var exercise = findExercise(card.dataset.id);
    if (!exercise) return;
    if (target.classList.contains("ex-name")) {
      exercise.name = target.value;
      var remove = card.querySelector("[data-action='remove-exercise']");
      if (remove) remove.setAttribute("aria-label", "Remove " + (target.value.trim() || "exercise"));
    } else {
      var row = target.closest(".set-row");
      if (!row) return;
      var set = findSet(exercise, row.dataset.id);
      if (!set) return;
      if (target.classList.contains("set-weight")) {
        set.weight = target.value;
        var bw = row.querySelector("[data-action='bw']");
        if (bw) bw.setAttribute("aria-pressed", isBodyweight(target.value) ? "true" : "false");
      }
      if (target.classList.contains("set-reps")) set.reps = target.value;
    }
    renderPreview();
    persistDraft();
  }

  function onExerciseClick(event) {
    var button = event.target.closest("[data-action]");
    if (!button || !els.exercises.contains(button)) return;
    var card = button.closest(".exercise");
    if (!card) return;
    var action = button.dataset.action;
    if (action === "add-set") {
      addSet(card.dataset.id);
      return;
    }
    if (action === "remove-exercise") {
      removeExercise(card.dataset.id, button);
      return;
    }
    var row = button.closest(".set-row");
    if (!row) return;
    if (action === "remove-set") {
      removeSet(card.dataset.id, row.dataset.id, button);
      return;
    }
    if (action === "bw") {
      var exercise = findExercise(card.dataset.id);
      var set = exercise && findSet(exercise, row.dataset.id);
      if (!set) return;
      set.weight = "BW";
      var input = row.querySelector(".set-weight");
      if (input) input.value = "BW";
      button.setAttribute("aria-pressed", "true");
      renderPreview();
      persistDraft();
    }
  }

  function onSavedClick(event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "use-saved") useSaved(button.dataset.id, button);
    if (button.dataset.action === "remove-saved") removeSaved(button.dataset.id, button);
  }

  function selectPreview() {
    var selection = window.getSelection();
    if (!selection) return;
    var range = document.createRange();
    range.selectNodeContents(els.message);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function copyWithSelection(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.setAttribute("aria-hidden", "true");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.width = "1px";
    area.style.height = "1px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  function copyText(text, button, successLabel, successFlash) {
    var original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    var finished = false;
    function succeed() {
      if (finished) return;
      finished = true;
      button.textContent = successLabel;
      flash(successFlash);
      window.setTimeout(function () {
        if (button.textContent === successLabel) button.textContent = original;
      }, 2200);
    }
    function fail() {
      if (finished) return;
      finished = true;
      selectPreview();
      button.textContent = original;
      flash("Couldn't use the clipboard. The preview is selected, so you can copy it by hand.");
    }
    var pending = null;
    if (window.isSecureContext && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      pending = navigator.clipboard.writeText(text);
    }
    var legacyOk = copyWithSelection(text);
    if (legacyOk) succeed();
    if (!pending) {
      if (!legacyOk) fail();
      return;
    }
    var timer = window.setTimeout(function () {
      if (!finished) fail();
    }, 1000);
    pending.then(function () {
      window.clearTimeout(timer);
      succeed();
    }).catch(function () {
      window.clearTimeout(timer);
      if (!finished) fail();
    });
  }

  function readSessionPending() {
    try {
      return parseJSON(sessionStorage.getItem(STORAGE.pending));
    } catch (error) {
      return null;
    }
  }

  function clearSessionPending() {
    try {
      sessionStorage.removeItem(STORAGE.pending);
    } catch (error) {
      /* ignore */
    }
  }

  function consumePending() {
    var hasAdd = new URLSearchParams(location.search).get("add") === "1" || location.hash === "#add";
    if (!hasAdd) return null;
    var fromQuery = program.pendingFromQuery(location.search);
    var fromSession = program.coercePending(readSessionPending());
    var pending = fromQuery || fromSession;
    clearSessionPending();
    try {
      history.replaceState(null, "", location.pathname);
    } catch (error) {
      /* file URLs can reject replaceState; the add still applies once */
    }
    if (!pending) return null;
    var exercise = program.applyPending(state.draft, pending);
    if (!exercise) return null;
    return { exercise: exercise, mode: pending.mode };
  }

  function highlightAdded(exercise, mode) {
    if (!exercise) return;
    var reps = exercise.sets[0] ? exercise.sets[0].reps : "";
    var weight = exercise.sets[0] ? exercise.sets[0].weight : "";
    var lead = mode === "replace" ? "Replaced this workout with " : "Added ";
    flash(lead + exercise.name + " (" + exercise.sets.length + "\u00d7" + reps + " @ " + weight + " lb).");
    var card = findCard(exercise.id);
    if (!card) return;
    card.classList.add("is-new");
    window.requestAnimationFrame(function () {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(function () {
      card.classList.remove("is-new");
    }, 4000);
  }

  function bind() {
    els.form.addEventListener("submit", function (event) { event.preventDefault(); });
    els.date.addEventListener("input", onDate);
    els.date.addEventListener("change", onDate);
    els.pick.addEventListener("change", function () {
      els.customField.hidden = els.pick.value !== CUSTOM;
      if (els.pick.value === CUSTOM) els.custom.focus();
    });
    els.add.addEventListener("click", addSelectedExercise);
    els.custom.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addSelectedExercise();
      }
    });
    els.exercises.addEventListener("input", onExerciseInput);
    els.exercises.addEventListener("click", onExerciseClick);
    els.savedList.addEventListener("click", onSavedClick);
    els.save.addEventListener("click", saveWorkout);
    els.clear.addEventListener("click", clearWorkout);
    els.copyChat.addEventListener("click", function () {
      copyText(program.formatChat(state.draft), els.copyChat, "Copied", "Copied for chat.");
    });
    els.copySheets.addEventListener("click", function () {
      copyText(program.formatSheets(state.draft), els.copySheets, "Copied", "Copied for Sheets.");
    });
    window.addEventListener("resize", function () {
      sizeDock();
      pinDock();
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", pinDock);
      window.visualViewport.addEventListener("scroll", pinDock);
    }
  }

  function cacheElements() {
    els.form = $("workout-form");
    els.date = $("date");
    els.pick = $("exercise-pick");
    els.custom = $("custom-name");
    els.customField = $("custom-field");
    els.add = $("add-exercise");
    els.exercises = $("exercises");
    els.exerciseEmpty = $("exercise-empty");
    els.savedList = $("saved-list");
    els.savedEmpty = $("saved-empty");
    els.save = $("save");
    els.clear = $("clear");
    els.message = $("message");
    els.copyChat = $("copy-chat");
    els.copySheets = $("copy-sheets");
    els.status = $("status");
    els.storageNote = $("storage-note");
    els.dock = document.querySelector(".dock");
  }

  function boot() {
    cacheElements();
    fillExerciseSelect();
    state.saved = program.normalizeSaved(parseJSON(storageGet(STORAGE.saved)));
    state.draft = program.normalizeDraft(parseJSON(storageGet(STORAGE.draft)), new Date());
    if (state.draft.savedId && !state.saved.some(function (entry) { return entry.id === state.draft.savedId; })) {
      state.draft.savedId = null;
    }
    var added = consumePending();
    bind();
    els.date.value = state.draft.date;
    renderSaved();
    renderExercises();
    renderPreview();
    updateSaveLabel();
    persistDraft();
    sizeDock();
    pinDock();
    if (added) highlightAdded(added.exercise, added.mode);
  }

  boot();
})();
