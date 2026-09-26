(() => {
  "use strict";

  const STORAGE_KEY = "kodformula_session_ui_v6";
  let CONTENT = { courses: [], steps: [] };

  const statusMeta = {
    done: ["Зачтено", "done", "✓"],
    review: ["На проверке", "review", "◷"],
    returned: ["Возвращено", "returned", "!"],
    failed: ["Не прошло", "failed", "×"],
    progressing: ["В процессе", "progressing", "•"],
    idle: ["Не начато", "idle", "○"]
  };

  const typeMeta = {
    theory: ["Т", "Теория"],
    question: ["?", "Контрольный вопрос"],
    scratch: ["S", "Scratch"],
    minecraft: ["M", "Minecraft"],
    tests: ["⌘", "Задача с тестами"],
    project: ["P", "Проект"]
  };

  const defaults = { user: null, progress: {}, feedback: {}, submissions: {} };
  let state = loadState();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return stored ? { ...clone(defaults), ...stored } : clone(defaults);
    } catch {
      return clone(defaults);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function currentUser() {
    return state.user;
  }

  function isRole(role) {
    return currentUser()?.role === role;
  }

  function requireRole(role) {
    if (!currentUser()) {
      window.location.href = "../../login.html";
      return false;
    }

    if (role && !isRole(role)) {
      redirectByRole();
      return false;
    }

    return true;
  }

  function redirectByRole() {
    const role = currentUser()?.role;
    if (role === "student") {
      window.location.href = "../student/dashboard.html";
    } else if (role === "curator") {
      window.location.href = "../curator/dashboard.html";
    } else if (role === "admin") {
      window.location.href = "../admin/dashboard.html";
    } else {
      window.location.href = "../../login.html";
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(`../../api/${path}`, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "API_ERROR");
    return data;
  }

  async function hydrateFromServer() {
    try {
      const me = await api("auth.php?action=me");
      if (!me.authenticated) { state.user = null; saveState(); return false; }
      state.user = me.user;
      const remote = await api("state.php");
      state.progress = remote.progress || {};
      state.feedback = remote.feedback || {};
      await loadContentFromDatabase();
      saveState();
      return true;
    } catch (error) {
      console.warn("Server sync failed", error);
      return false;
    }
  }

  async function logout() {
    try { await api("auth.php?action=logout", { method: "POST", body: "{}" }); } catch (_) {}
    state.user = null;
    saveState();
    window.location.href = "../../index.html";
  }

  async function loadContentFromDatabase() {
    const data = await api("courses.php?full=1");
    const courses = data.courses || [];
    const steps = [];
    for (const course of courses) {
      course.modules = (course.modules || []).map((module) => {
        module.steps = (module.steps || []).map((step) => {
          const content = step.content || {};
          const validation = step.validation || {};
          const normalized = {
            id: step.code,
            dbId: Number(step.id),
            position: Number(step.position) || 1,
            title: step.title,
            type: step.type,
            typeTitle: step.type_title,
            grading: step.grading,
            content: content.content || "",
            preview: content.preview || content.content || "",
            options: Array.isArray(content.options) ? content.options : [],
            multiple: content.multiple === true,
            statement: content.statement || content.content || "",
            input: content.input || "",
            output: content.output || "",
            examples: Array.isArray(content.examples) ? content.examples : [],
            limits: content.limits || "",
            answer: validation.answer ?? null
          };
          steps.push(normalized);
          return normalized.id;
        });
        return module;
      });
    }
    CONTENT = { courses, steps };
    return CONTENT;
  }

  function getCourse(id) {
    return CONTENT.courses.find((course) => Number(course.id) === Number(id));
  }

  function getStep(id) {
    return CONTENT.steps.find((step) => step.id === id);
  }

  function getCourseSteps(course) {
    return course.modules.flatMap((module) => module.steps.map(getStep)).filter(Boolean);
  }

  function progressFor(course) {
    const steps = getCourseSteps(course);
    const done = steps.filter((step) => state.progress[step.id] === "done").length;
    return {
      done,
      total: steps.length,
      percent: steps.length ? Math.round((done / steps.length) * 100) : 0
    };
  }

  function overallProgress(courses) {
    const progress = courses.map(progressFor);
    const total = progress.reduce((sum, item) => sum + item.total, 0);
    const done = progress.reduce((sum, item) => sum + item.done, 0);
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function badge(status = "idle") {
    const [label, css, icon] = statusMeta[status] || statusMeta.idle;
    return `<span class="badge ${css}"><i>${icon}</i>${label}</span>`;
  }

  function typeBadge(type) {
    const [icon, label] = typeMeta[type] || ["•", type];
    return `<span class="type-badge"><b>${icon}</b>${label}</span>`;
  }

  function studentHeader(active = "dashboard") {
    const user = currentUser();
    return `
      <header class="app-header">
        <div class="app-header-inner">
          <a class="logo logo-dark" href="../student/dashboard.html">Код<b>Формула</b></a>
          <nav class="app-nav">
            <a class="${active === "dashboard" ? "active" : ""}" href="../student/dashboard.html">Главная</a>
            <a class="${active === "courses" ? "active" : ""}" href="../student/courses.html">Курсы</a>
            <a class="${active === "results" ? "active" : ""}" href="../student/results.html">Результаты</a>
            <a class="${active === "history" ? "active" : ""}" href="../student/history.html">История</a>
          </nav>
          <div class="app-user">
            <div class="avatar">${escapeHtml((user?.name || "М").slice(0, 1))}</div>
            <div><b>${escapeHtml(user?.name || "Ученик")}</b><small>Ученик</small></div>
            <button class="icon-button" type="button" onclick="window.KF.logout()" title="Выйти">↪</button>
          </div>
        </div>
      </header>`;
  }

  function staffHeader(role, active) {
    const user = currentUser();
    const prefix = role === "curator" ? "curator" : "admin";
    const links = role === "curator"
      ? [
          ["dashboard", "Обзор", "../curator/dashboard.html"],
          ["submissions", "Проверка работ", "../curator/submissions.html"],
          ["students", "Ученики", "../curator/students.html"],
          ["analytics", "Аналитика", "../curator/analytics.html"]
        ]
      : [
          ["dashboard", "Обзор", "../admin/dashboard.html"],
          ["courses", "Курсы", "../admin/courses.html"],
          ["builder", "Конструктор", "../admin/builder.html"],
          ["users", "Пользователи", "../admin/users.html"],
          ["analytics", "Аналитика", "../admin/analytics.html"]
        ];

    return `
      <header class="staff-header">
        <div class="staff-header-inner">
          <a class="logo" href="${role === "curator" ? "../curator/dashboard.html" : "../admin/dashboard.html"}">Код<b>Формула</b></a>
          <span class="staff-role">${role === "curator" ? "Контур куратора" : "Контур администратора"}</span>
          <nav class="staff-nav">
            ${links.map(([key, label, href]) => `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
          </nav>
          <div class="app-user staff-user">
            <div class="avatar">${escapeHtml((user?.name || "А").slice(0, 1))}</div>
            <div><b>${escapeHtml(user?.name || "Пользователь")}</b><small>${role === "curator" ? "Куратор" : "Администратор"}</small></div>
            <button class="icon-button" type="button" onclick="window.KF.logout()" title="Выйти">↪</button>
          </div>
        </div>
      </header>`;
  }

  function page(title, body, header = "") {
    document.title = `${title} — КодФормула`;
    document.body.innerHTML = `${header}<main class="page-main">${body}</main>`;
  }

  async function renderStudentDashboard() {
    if (!requireRole("student")) return;
    const courses = CONTENT.courses;
    const current = courses[0];
    const progress = progressFor(current);
    const totalProgress = overallProgress(courses);
    const nextStep = getStep("1.2.3");
    let recentHistory;
    try {
      const data = await api("history.php");
      recentHistory = (data.history || []).slice(0, 3).map(historyEventMarkup).join("") || `<div class="history-empty">История пока пуста.</div>`;
    } catch (error) {
      console.warn("Recent history loading failed", error);
      recentHistory = `<div class="history-empty">Не удалось загрузить историю.</div>`;
    }

    page(
      "Главная",
      `
        <div class="container">
          <section class="welcome-block">
            <div><div class="eyebrow">Личный кабинет</div><h1>Привет, ${escapeHtml(currentUser().name.split(" ")[0])} 👋</h1><p>Продолжим с того места, где остановились.</p></div>
            <a class="btn" href="../student/course.html?id=1">Продолжить обучение →</a>
          </section>

          <section class="dashboard-grid">
            <article class="panel current-course-panel">
              <div class="panel-head"><div><span class="eyebrow">Продолжить</span><h2>${escapeHtml(current.title)}</h2></div>${badge(state.progress[nextStep.id] || "idle")}</div>
              <p class="muted">Следующий шаг: <b>${escapeHtml(nextStep.title)}</b></p>
              <div class="progress-row"><span>${progress.done} из ${progress.total} шагов</span><strong>${progress.percent}%</strong></div>
              <div class="progress"><span style="width:${progress.percent}%"></span></div>
              <div class="panel-actions"><a class="btn" href="../student/step.html?id=${encodeURIComponent(nextStep.id)}">Открыть шаг</a><a class="btn secondary" href="../student/courses.html">Все курсы</a></div>
            </article>

            <article class="panel compact-stat"><span class="eyebrow">Всего прогресса</span><strong>${totalProgress.percent}%</strong><p>${totalProgress.done} из ${totalProgress.total} шагов по курсам</p><a href="../student/results.html">Посмотреть результаты →</a></article>
          </section>

          <section class="section-block"><div class="section-title"><div><span class="eyebrow">Мои курсы</span><h2>Учебный маршрут</h2></div><a href="../student/courses.html">Открыть каталог →</a></div>
            <div class="course-list">${courses.map((course) => renderStudentCourseCard(course)).join("")}</div>
          </section>

          <section class="section-block"><div class="section-title"><div><span class="eyebrow">Последнее</span><h2>История действий</h2></div><a href="../student/history.html">Вся история →</a></div>
            <div class="activity-list">
              ${recentHistory}
            </div>
          </section>
        </div>`,
      studentHeader("dashboard")
    );
  }

  function renderStudentCourseCard(course) {
    const p = progressFor(course);
    return `<article class="course-card"><div class="course-card-top"><span class="course-mark">${course.id === 1 ? "S" : course.id === 2 ? "M" : "Py"}</span>${badge(p.done ? (p.done === p.total ? "done" : "progressing") : "idle")}</div><span class="eyebrow">${escapeHtml(course.classes)} · ${escapeHtml(course.tool)}</span><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.goal)}</p><div class="progress-row"><span>${p.done} из ${p.total} шагов</span><strong>${p.percent}%</strong></div><div class="progress"><span style="width:${p.percent}%"></span></div><a class="btn secondary full" href="../student/course.html?id=${course.id}">Открыть курс</a></article>`;
  }

  function renderStudentCourses() {
    if (!requireRole("student")) return;
    page("Курсы", `<div class="container"><section class="page-intro"><span class="eyebrow">Каталог</span><h1>Мои курсы</h1><p>Курсы назначаются администратором. Каждый маршрут состоит из модулей и шагов.</p></section><div class="course-grid-large">${CONTENT.courses.map(renderStudentCourseCard).join("")}</div></div>`, studentHeader("courses"));
  }

  function renderCourse(courseId) {
    if (!requireRole("student")) return;
    const course = getCourse(courseId);
    if (!course) {
      window.location.href = "../student/courses.html";
      return;
    }
    const p = progressFor(course);
    const body = `
      <div class="container">
        <div class="breadcrumbs"><a href="../student/courses.html">Курсы</a><span>/</span><span>${escapeHtml(course.title)}</span></div>
        <section class="course-hero panel"><div class="course-mark big">${course.id === 1 ? "S" : course.id === 2 ? "M" : "Py"}</div><div class="course-hero-copy"><span class="eyebrow">${escapeHtml(course.classes)} · ${escapeHtml(course.tool)}</span><h1>${escapeHtml(course.title)}</h1><p>${escapeHtml(course.goal)}</p><div class="meta-row"><span>${escapeHtml(course.duration)}</span><span>${p.total} шагов</span><span>${p.percent}% пройдено</span></div></div><a class="btn" href="../student/step.html?id=${encodeURIComponent(course.modules[0].steps[0])}">Начать / продолжить →</a></section>
        <section class="module-stack">${course.modules.map((module, index) => `<article class="module-card"><div class="module-head"><div><span class="module-index">0${index + 1}</span><h2>${escapeHtml(module.title)}</h2></div><span>${module.steps.length} шагов</span></div><div class="step-list">${module.steps.map((id) => { const step = getStep(id); return `<a class="step-row" href="../student/step.html?id=${encodeURIComponent(id)}"><span class="step-number">${escapeHtml(id)}</span><div class="step-info"><b>${escapeHtml(step.title)}</b>${typeBadge(step.type)}</div>${badge(state.progress[id] || "idle")}<span class="arrow">→</span></a>`; }).join("")}</div></article>`).join("")}</section>
      </div>`;
    page(course.title, body, studentHeader("courses"));
  }

  function renderLearningText(text) {
    const lines=String(text||'').replace(/\r/g,'').split('\n');
    const headingSet=new Set(['Из чего состоит окно Scratch','Координаты','Как запустить программу','События','Условие','Пример','Как открыть редактор кода','Где искать блоки','Первая программа','Цикл внутри цикла','Как подготовить мир','Требования к мосту','Что сдать','Задание','Подсказки','Входные данные','Выходные данные','Ограничения','Дополнительный вопрос для сильных']);
    let html='', inList=false, inCode=false;
    const closeList=()=>{if(inList){html+='</ul>';inList=false;}};
    const closeCode=()=>{if(inCode){html+='</pre>';inCode=false;}};
    for(const raw of lines){ const line=raw.trimEnd(); const t=line.trim();
      if(!t){closeList();closeCode();continue;}
      const isCode=/^(когда |повторить |повторять |идти |ждать |повернуть |стереть |опустить |перейти |print\(|if |elif |else:|for |while |[A-Za-z_][A-Za-z0-9_]*\s*=|\[|agent |[a-z_]+\s*=)/.test(t) || /конец$/.test(t);
      if(headingSet.has(t) || /^(Мир|Какие блоки понадобятся|Из чего состоит|Ввод и вывод в Python|Сравнения|Логические операции|Остаток от деления)$/.test(t)){closeList();closeCode();html+=`<h3>${escapeHtml(t)}</h3>`;continue;}
      if(/^\d+\.\s/.test(t) || /^[-•]\s/.test(t)){closeCode();if(!inList){html+='<ul>';inList=true;}html+=`<li>${escapeHtml(t.replace(/^\d+\.\s|^[-•]\s/,'')).replace(/\n/g,' ')}</li>`;continue;}
      if(isCode){closeList();if(!inCode){html+='<pre class="learning-code">';inCode=true;}html+=escapeHtml(line)+'\n';continue;}
      closeList();closeCode();html+=`<p>${escapeHtml(t)}</p>`;
    }
    closeList();closeCode();return html;
  }

  function renderStep(stepId) {
    if (!requireRole("student")) return;
    const step = getStep(stepId);
    if (!step) {
      window.location.href = "../student/courses.html";
      return;
    }
    const course = CONTENT.courses.find((item) => getCourseSteps(item).some((s) => s.id === step.id));
    const status = state.progress[step.id] || "idle";
    const stepIndex = course ? getCourseSteps(course).findIndex((s) => s.id === step.id) : 0;
    const next = course ? getCourseSteps(course)[stepIndex + 1] : null;
    const previous = course ? getCourseSteps(course)[stepIndex - 1] : null;
    const answer = Array.isArray(step.answer) ? step.answer.join(", ") : step.answer;

    let taskHtml = `<div class="theory-content">${renderLearningText(step.content)}</div><div class="panel-actions"><button class="btn" type="button" onclick="window.KF.markStepDone('${step.id}')">Отметить как пройденный</button></div>`;
    if (step.type === "question") {
      const inputType = step.multiple ? 'checkbox' : 'radio';
      const options=(step.options||[]).map((opt)=>`<label class="answer-option"><input type="${inputType}" name="step-choice" value="${escapeHtml(String(opt))}" aria-label="${escapeHtml(String(opt))}"><span>${escapeHtml(String(opt))}</span></label>`).join('');
      const answerHint = step.multiple ? 'Выберите все подходящие варианты.' : 'Выберите один вариант.';
      taskHtml=`<div class="task-content"><div class="question-text">${renderLearningText(step.preview||step.content)}</div>${options?`<fieldset class="answer-options" aria-label="Варианты ответа"><legend class="sr-only">${answerHint}</legend>${options}</fieldset>`:'<input id="step-answer" class="field" placeholder="Введите ответ">'}<button class="btn" type="button" onclick="window.KF.checkAnswer('${step.id}')">Проверить</button><div id="step-result" class="result-box" hidden></div></div>`;
    } else if (step.type === "tests") {
      taskHtml=`<div class="task-content"><div class="problem-statement">${renderLearningText(step.statement||step.content)}</div>${step.input?`<section class="content-section"><h3>Входные данные</h3><p>${escapeHtml(step.input)}</p></section>`:''}${step.output?`<section class="content-section"><h3>Выходные данные</h3><p>${escapeHtml(step.output)}</p></section>`:''}${(step.examples||[]).length?`<section class="content-section"><h3>Примеры</h3>${step.examples.map((ex,i)=>`<div class="example-box"><b>Пример ${i+1}</b><pre>${escapeHtml(ex.input)}\n→ ${escapeHtml(ex.output)}</pre></div>`).join('')}</section>`:''}${step.limits?`<div class="limits-box"><b>Ограничения:</b> ${escapeHtml(step.limits)}</div>`:''}<label class="field-label" for="code-answer">Решение на Python 3</label><textarea id="code-answer" class="code-editor" spellcheck="false"># Напишите решение здесь\n</textarea><button class="btn" type="button" onclick="window.KF.submitCode('${step.id}')">Отправить на проверку</button><div id="step-result" class="result-box" hidden></div></div>`;
    } else if (["scratch", "minecraft", "project"].includes(step.type)) {
      taskHtml=`<div class="task-content">${renderLearningText(step.content)}<label class="field-label">Что сдаёт ученик</label><textarea id="work-answer" class="field textarea" placeholder="Вставьте ссылку на проект или добавьте требуемое описание"></textarea><button class="btn" type="button" onclick="window.KF.submitWork('${step.id}')">Отправить куратору</button><div id="step-result" class="result-box" hidden></div></div>`;
    }
    const feedback = state.feedback[step.id];
    const body = `
      <div class="container narrow">
        <div class="breadcrumbs"><a href="course.html?id=${course?.id || 1}">${escapeHtml(course?.title || "Курс")}</a><span>/</span><span>${escapeHtml(step.id)}</span></div>
        <section class="step-layout">
          <article class="panel step-main"><div class="step-top"><div>${typeBadge(step.type)}${badge(status)}</div><span>Шаг ${escapeHtml(step.id)}</span></div><h1>${escapeHtml(step.title)}</h1><div class="step-body">${taskHtml}</div>${feedback ? `<div class="feedback-box"><b>Комментарий куратора</b><p>${escapeHtml(feedback)}</p></div>` : ""}<div class="step-navigation">${previous ? `<a class="btn secondary" href="../student/step.html?id=${encodeURIComponent(previous.id)}">← Предыдущий</a>` : `<a class="btn secondary" href="../student/course.html?id=${course.id}">← К курсу</a>`}${next ? `<a class="btn" href="../student/step.html?id=${encodeURIComponent(next.id)}">Следующий →</a>` : `<a class="btn" href="../student/course.html?id=${course.id}">Завершить курс</a>`}</div></article>
          <aside class="panel step-sidebar"><span class="eyebrow">Прогресс курса</span><h3>${escapeHtml(course?.title || "")}</h3><div class="progress"><span style="width:${course ? progressFor(course).percent : 0}%"></span></div><small>${course ? progressFor(course).done : 0} из ${course ? progressFor(course).total : 0} шагов</small><div class="mini-step-list">${course ? getCourseSteps(course).map((item) => `<a class="${item.id === step.id ? "current" : ""}" href="../student/step.html?id=${encodeURIComponent(item.id)}"><span>${item.id}</span>${escapeHtml(item.title)}<i>${statusMeta[state.progress[item.id] || "idle"][2]}</i></a>`).join("") : ""}</div></aside>
        </section>
      </div>`;
    page(step.title, body, studentHeader("courses"));
  }

  function renderStudentResults() {
    if (!requireRole("student")) return;
    const rows = CONTENT.courses.map((course) => { const p = progressFor(course); return `<div class="result-course-row"><div class="course-mark">${course.id === 1 ? "S" : course.id === 2 ? "M" : "Py"}</div><div><b>${escapeHtml(course.title)}</b><small>${p.done} из ${p.total} шагов</small></div><div class="result-progress"><div class="progress"><span style="width:${p.percent}%"></span></div><strong>${p.percent}%</strong></div><a class="btn secondary" href="../student/course.html?id=${course.id}">Открыть</a></div>`; }).join("");
    page("Результаты", `<div class="container"><section class="page-intro"><span class="eyebrow">Прогресс</span><h1>Результаты обучения</h1><p>Прогресс объясняется через выполненные шаги и статусы работ.</p></section><section class="panel result-panel">${rows}</section><section class="section-block"><div class="section-title"><div><span class="eyebrow">Статусы</span><h2>Что означает каждый статус</h2></div></div><div class="status-grid">${Object.keys(statusMeta).map((key) => `<div>${badge(key)}<p>${key === "done" ? "Шаг успешно пройден." : key === "review" ? "Работа ожидает ручной проверки." : key === "returned" ? "Куратор вернул работу с комментарием." : key === "failed" ? "Автоматическая проверка не пройдена." : key === "progressing" ? "Шаг начат, но ещё не завершён." : "Шаг пока не начинался."}</p></div>`).join("")}</div></section></div>`, studentHeader("results"));
  }

  function historyDate(value) {
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "Дата неизвестна";
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function historyLabel(event) {
    if (event.event_type === "submission") {
      return { accepted: "Работа принята", review: "Работа отправлена на проверку", returned: "Работа возвращена", failed: "Автопроверка не пройдена", in_progress: "Работа начата" }[event.status] || "Работа отправлена";
    }
    return { done: "Шаг зачтён", review: "Шаг отправлен на проверку", returned: "Шаг возвращён", failed: "Шаг не пройден", progressing: "Шаг начат", idle: "Шаг открыт" }[event.status] || "Изменён статус шага";
  }

  function historyEventMarkup(event) {
    const icon = event.status === "done" || event.status === "accepted" ? "✓" : event.status === "failed" ? "×" : event.status === "returned" ? "!" : "→";
    const iconClass = event.status === "failed" || event.status === "returned" ? "amber" : event.status === "review" ? "blue" : "";
    const comment = event.curator_comment ? `<small>Комментарий: ${escapeHtml(event.curator_comment)}</small>` : "";
    return `<div><span class="activity-icon ${iconClass}">${icon}</span><div><b>${escapeHtml(historyLabel(event))}: ${escapeHtml(event.step_title)}</b><small>${escapeHtml(event.step_code)} · ${escapeHtml(event.course_title)} · ${historyDate(event.event_at)}</small>${comment}</div></div>`;
  }

  async function renderStudentHistory() {
    if (!requireRole("student")) return;
    let rows;
    try {
      const data = await api("history.php");
      rows = (data.history || []).map(historyEventMarkup).join("");
      if (!rows) rows = `<div class="history-empty">История пока пуста. Выполненные шаги и отправленные работы появятся здесь.</div>`;
    } catch (error) {
      console.warn("History loading failed", error);
      rows = `<div class="history-empty">Не удалось загрузить историю обучения.</div>`;
    }
    page("История", `<div class="container"><section class="page-intro"><span class="eyebrow">Активность</span><h1>История обучения</h1><p>Здесь сохраняются реальные действия по курсам и заданиям.</p></section><section class="panel activity-list large">${rows}</section></div>`, studentHeader("history"));
  }

  function curatorSidebar(reviewCount = 0, activeStudents = 0, signalCount = 0) {
    return `<aside class="staff-side-card"><span class="eyebrow">Быстрый доступ</span><a href="../curator/submissions.html">Очередь проверки <b>${reviewCount}</b></a><a href="../curator/students.html">Ученики <b>${activeStudents}</b></a><a href="../curator/analytics.html">Сигналы риска <b>${signalCount}</b></a></aside>`;
  }

  async function renderCuratorDashboard() {
    if (!requireRole("curator")) return;
    let metrics = { students: 0, review: 0, returned: 0 };
    let submissions = [];
    try {
      const [analytics, queue] = await Promise.all([api("analytics.php"), api("submissions.php")]);
      metrics = analytics.metrics || metrics;
      submissions = queue.submissions || [];
    } catch (error) {
      console.warn("Curator dashboard data loading failed", error);
    }
    const activeStudents = Number(metrics.students || 0);
    const reviewCount = Number(metrics.review || 0);
    const returnedCount = Number(metrics.returned || 0);
    page("Обзор куратора", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Контур куратора</span><h1>Добрый день, ${escapeHtml(currentUser().name)}</h1><p>Проверьте работы, которые ждут ручной оценки, и посмотрите на сигналы по ученикам.</p></section><div class="metric-grid"><div class="metric-card"><span>На проверке</span><strong>${reviewCount}</strong><small>работы</small></div><div class="metric-card"><span>Ученики</span><strong>${activeStudents}</strong><small>активных</small></div><div class="metric-card"><span>Возвращено</span><strong>${returnedCount}</strong><small>всего</small></div><div class="metric-card warning"><span>Сигналы</span><strong>${returnedCount}</strong><small>требуют внимания</small></div></div><div class="two-column"><section class="panel"><div class="panel-head"><div><span class="eyebrow">Очередь</span><h2>Работы на проверку</h2></div><a href="../curator/submissions.html">Вся очередь →</a></div>${renderCuratorSubmissionRows(submissions, 3)}</section>${curatorSidebar(reviewCount, activeStudents, returnedCount)}</div></div>`, staffHeader("curator", "dashboard"));
  }

  function renderCuratorSubmissionRows(rows, limit = 10) {
    const items = rows.slice(0, limit);
    if (!items.length) return `<div class="history-empty">Работ на проверке нет.</div>`;
    return `<div class="table-list">${items.map((item) => `<a class="table-row" href="../curator/submission.html?id=${encodeURIComponent(item.id)}"><div><b>${escapeHtml(item.step_title)}</b><small>${escapeHtml(item.step_code)} · ${escapeHtml(item.student_name)}</small></div><span>На проверке</span><small>${historyDate(item.submitted_at)}</small><span class="arrow">→</span></a>`).join("")}</div>`;
  }

  async function renderCuratorSubmissions() {
    if (!requireRole("curator")) return;
    let submissions = [];
    try {
      const data = await api("submissions.php");
      submissions = data.submissions || [];
    } catch (error) {
      console.warn("Submissions loading failed", error);
    }
    page("Проверка работ", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Куратор</span><h1>Очередь проверки</h1><p>Ручная проверка проектов и работ, которые не проходят автоматически.</p></section><section class="panel">${renderCuratorSubmissionRows(submissions)}</section></div>`, staffHeader("curator", "submissions"));
  }

  async function renderCuratorSubmission() {
    if (!requireRole("curator")) return;
    const id = new URLSearchParams(location.search).get("id") || "1.3.3";
    let submission;
    try {
      const data = await api("submissions.php");
      submission = (data.submissions || []).find((item) => String(item.id) === id || item.step_code === id);
    } catch (error) {
      console.warn("Submission loading failed", error);
    }
    if (!submission) {
      page("Работа не найдена", `<div class="container narrow staff-container"><section class="panel"><h1>Работа не найдена</h1><p>Эта работа уже проверена или больше недоступна в очереди.</p><a class="btn" href="../curator/submissions.html">Вернуться в очередь</a></section></div>`, staffHeader("curator", "submissions"));
      return;
    }
    const payloadValue = submission.payload?.value || "Ученик не добавил текст или ссылку.";
    page("Проверка работы", `<div class="container narrow staff-container"><div class="breadcrumbs"><a href="../curator/submissions.html">Очередь</a><span>/</span><span>${escapeHtml(submission.step_code)}</span></div><section class="panel review-panel"><div class="review-head"><div><span class="eyebrow">Работа ученика</span><h1>${escapeHtml(submission.step_title)}</h1><p>Шаг ${escapeHtml(submission.step_code)} · ${escapeHtml(submission.student_name)}</p></div>${badge(submission.status === "review" ? "review" : submission.status)}</div><div class="submission-preview"><h3>Ответ ученика</h3><pre class="submission-content">${escapeHtml(payloadValue)}</pre><small>Отправлено: ${historyDate(submission.submitted_at)}</small></div><label class="field-label">Комментарий</label><textarea id="review-comment" class="field textarea" placeholder="Напишите понятный комментарий ученику"></textarea><div class="panel-actions"><button class="btn" onclick="window.KF.reviewSubmission('${submission.id}', true)">Принять работу</button><button class="btn warning-btn" onclick="window.KF.reviewSubmission('${submission.id}', false)">Вернуть на доработку</button></div><div id="review-result" class="result-box" hidden></div></section></div>`, staffHeader("curator", "submissions"));
  }

  async function renderCuratorStudents() {
    if (!requireRole("curator")) return;
    let students = [];
    try {
      const data = await api("students.php");
      students = data.students || [];
    } catch (error) {
      console.warn("Students loading failed", error);
    }
    const rows = students.length
      ? students.map((student) => `<div class="table-row"><div><div class="avatar small">${escapeHtml(student.name.slice(0, 1))}</div></div><div><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.courses || "Курсы не назначены")}</small></div><div class="student-progress"><div class="progress"><span style="width:${student.percent}%"></span></div><small>${student.done_steps} из ${student.total_steps} · ${student.percent}%</small></div>${badge(student.status)}<span class="arrow">→</span></div>`).join("")
      : `<div class="history-empty">Не удалось загрузить учеников.</div>`;
    page("Ученики", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Куратор</span><h1>Ученики</h1><p>Прогресс, статусы и последние действия назначенных учеников.</p></section><section class="panel"><div class="student-table">${rows}</div></section></div>`, staffHeader("curator", "students"));
  }

  async function renderCuratorAnalytics() {
    if (!requireRole("curator")) return;
    let analytics = { metrics: {}, courses: [] };
    let students = [];
    try {
      const [analyticsData, studentsData] = await Promise.all([api("analytics.php"), api("students.php")]);
      analytics = analyticsData;
      students = studentsData.students || [];
    } catch (error) {
      console.warn("Curator analytics loading failed", error);
    }
    const metrics = analytics.metrics || {};
    const averageProgress = students.length ? Math.round(students.reduce((sum, student) => sum + Number(student.percent || 0), 0) / students.length) : 0;
    const riskStudents = students.filter((student) => ["returned", "review"].includes(student.status));
    const courseBars = (analytics.courses || []).map((course) => {
      const totalSteps = Number(course.total_steps || 0) * Math.max(Number(metrics.students || 0), 1);
      const doneItems = Number(course.done_items || 0);
      const percent = totalSteps ? Math.round(doneItems / totalSteps * 100) : 0;
      return `<span title="${escapeHtml(course.title)}: ${percent}%" style="height:${Math.max(percent, 8)}%"></span>`;
    }).join("");
    const courseLabels = (analytics.courses || []).map((course) => `<span>Курс ${course.id}</span>`).join("");
    const signals = riskStudents.length
      ? riskStudents.map((student) => `<div><b>${escapeHtml(student.name)}</b><span>${student.status === "returned" ? "Есть возвращённая работа" : "Есть работа на проверке"}</span>${badge(student.status)}</div>`).join("")
      : `<div><b>Сигналов нет</b><span>Все ученики без текущих проблем</span>${badge("done")}</div>`;
    page("Аналитика куратора", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Куратор</span><h1>Аналитика и сигналы</h1><p>Сигналы помогают заметить отставание, возвраты и зависшие работы.</p></section><div class="metric-grid"><div class="metric-card warning"><span>Риск отставания</span><strong>${riskStudents.length}</strong><small>ученика</small></div><div class="metric-card"><span>Средний прогресс</span><strong>${averageProgress}%</strong><small>по группе</small></div><div class="metric-card"><span>Шагов зачтено</span><strong>${Number(metrics.done || 0)}</strong><small>в системе</small></div><div class="metric-card"><span>На проверке</span><strong>${Number(metrics.review || 0)}</strong><small>работ</small></div></div><section class="panel chart-panel"><h2>Прогресс по курсам</h2><div class="fake-chart">${courseBars}</div><div class="chart-labels">${courseLabels}</div></section><section class="panel signal-list">${signals}</section></div>`, staffHeader("curator", "analytics"));
  }

  function adminLinks() {
    return `
      <div class="admin-quick-grid">
        <a href="../admin/courses.html"><b>Курсы</b><span>3 опубликовано</span>→</a>
        <a href="../admin/builder.html"><b>Конструктор</b><span>Редактирование шагов</span>→</a>
        <a href="../admin/users.html"><b>Пользователи</b><span>Роли и доступы</span>→</a>
      </div>`;
  }

  function renderAdminActivity(submissions) {
    if (!submissions.length) return `<div class="history-empty">Новых работ на проверке нет.</div>`;
    return `<div class="activity-list">${submissions.slice(0, 5).map((submission) => `<div><span class="activity-icon blue">→</span><div><b>${escapeHtml(submission.step_title)}</b><small>${escapeHtml(submission.student_name)} · ${historyDate(submission.submitted_at)}</small></div></div>`).join("")}</div>`;
  }

  async function renderAdminDashboard() {
    if (!requireRole("admin")) return;
    let metrics = {};
    let submissions = [];
    try {
      const [analytics, queue] = await Promise.all([api("analytics.php"), api("submissions.php")]);
      metrics = analytics.metrics || {};
      submissions = queue.submissions || [];
    } catch (error) {
      console.warn("Admin dashboard data loading failed", error);
    }
    page("Обзор администратора", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Администратор</span><h1>Управление платформой</h1><p>Курсы, пользователи, назначения и аналитика собраны в одном контуре.</p></section><div class="metric-grid"><div class="metric-card"><span>Курсы</span><strong>${Number(metrics.courses || 0)}</strong><small>опубликовано</small></div><div class="metric-card"><span>Модули</span><strong>${Number(metrics.modules || 0)}</strong><small>в структуре</small></div><div class="metric-card"><span>Шаги</span><strong>${Number(metrics.total_steps || 0)}</strong><small>учебных единиц</small></div><div class="metric-card"><span>Пользователи</span><strong>${Number(metrics.users || 0)}</strong><small>в системе</small></div></div>${adminLinks()}<section class="panel"><div class="panel-head"><div><span class="eyebrow">Последние изменения</span><h2>Работы на проверке</h2></div><a href="../curator/submissions.html">Открыть очередь →</a></div>${renderAdminActivity(submissions)}</section></div>`, staffHeader("admin", "dashboard"));
  }

  async function createCourse() {
    const value = (field) => document.getElementById(`new-course-${field}`).value.trim();
    try {
      await api("course-admin.php?action=create", {
        method: "POST",
        body: JSON.stringify({
          code: value("code"),
          title: value("title"),
          classes_label: value("classes_label"),
          tool: value("tool"),
          duration_label: value("duration_label"),
          goal: value("goal")
        })
      });
      toast("Курс добавлен в базу данных");
      await renderAdminCourses();
    } catch (error) {
      toast("Не удалось добавить курс");
    }
  }

  function toggleCourseForm() {
    const form = document.getElementById("course-create-form");
    const button = document.getElementById("course-create-toggle");
    if (!form || !button) return;
    form.hidden = !form.hidden;
    button.setAttribute("aria-expanded", String(!form.hidden));
  }

  async function renderAdminCourses() {
    if (!requireRole("admin")) return;
    let courses = [];
    try {
      const data = await api("course-admin.php?action=list");
      courses = data.courses || [];
    } catch (error) {
      console.warn("Admin courses loading failed", error);
    }
    const rows = courses.map((course) => {
      const contentCourse = getCourse(course.id);
      const moduleCount = contentCourse?.modules?.length || 0;
      const stepCount = contentCourse ? getCourseSteps(contentCourse).length : 0;
      return `<div class="admin-course-row"><div class="course-mark">${course.id === 1 ? "S" : course.id === 2 ? "M" : "Py"}</div><div><b>${escapeHtml(course.title)}</b><small>${moduleCount} модуля · ${stepCount} шагов</small></div><span class="publish-status">${escapeHtml(course.status)}</span><a class="btn secondary" href="../admin/builder.html?course=${course.id}">Открыть</a></div>`;
    }).join("");
    page("Курсы администратора", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Контент</span><h1>Курсы · ${courses.length}</h1><p>Курсы загружены из базы данных. Новые курсы можно добавить ниже.</p></section><section class="panel"><div class="admin-course-list">${rows || `<div class="history-empty">Курсов пока нет.</div>`}</div></section><section class="panel form-panel admin-course-create"><div class="panel-head"><div><span class="eyebrow">Новый курс</span><h2>Добавить курс</h2></div><button id="course-create-toggle" class="btn secondary" type="button" aria-expanded="false" onclick="window.KF.toggleCourseForm()">Добавить курс</button></div><div id="course-create-form" class="course-create-fields" hidden><label class="field-label" for="new-course-code">Код курса</label><input id="new-course-code" class="field" placeholder="course-4"><label class="field-label" for="new-course-title">Название</label><input id="new-course-title" class="field" placeholder="Название курса"><label class="field-label" for="new-course-classes_label">Класс</label><input id="new-course-classes_label" class="field" placeholder="5–7 класс"><label class="field-label" for="new-course-tool">Инструмент</label><input id="new-course-tool" class="field" placeholder="Python 3"><label class="field-label" for="new-course-duration_label">Длительность</label><input id="new-course-duration_label" class="field" placeholder="6 занятий по 40 минут"><label class="field-label" for="new-course-goal">Цель курса</label><textarea id="new-course-goal" class="field textarea" placeholder="Чему научится ученик"></textarea><button class="btn" type="button" onclick="window.KF.createCourse()">Сохранить курс</button></div></section></div>`, staffHeader("admin", "courses"));
  }

  async function openAddStepModal(moduleId,moduleCode,position){
    try{
      const data=await api('step-admin.php?action=types'); const types=data.types||[];
      const overlay=document.createElement('div'); overlay.className='modal-overlay'; overlay.id='step-type-modal';
      overlay.innerHTML=`<div class="modal-card"><div class="panel-head"><div><span class="eyebrow">Новый шаг</span><h2>Выберите тип</h2></div><button class="small-button" type="button" data-close>Закрыть</button></div><div class="type-choice-grid">${types.map(t=>`<button class="type-choice" type="button" data-type-id="${t.id}"><span class="type-choice-icon">${escapeHtml(t.icon_code)}</span><b>${escapeHtml(t.title)}</b><small>${t.grading==='auto'?'Автоматическая проверка':t.grading==='read'?'Засчитывается при прочтении':'Проверка куратором'}</small></button>`).join('')}</div></div>`;
      document.body.appendChild(overlay); overlay.querySelector('[data-close]').onclick=()=>overlay.remove(); overlay.addEventListener('click',e=>{const b=e.target.closest('[data-type-id]');if(b){createStep(moduleId,moduleCode,position,Number(b.dataset.typeId));overlay.remove();}});
    }catch(e){toast('Не удалось загрузить типы шагов');}
  }
  async function createStep(moduleId,moduleCode,position,stepTypeId){
    const code=`${moduleCode}.${position}`;
    try{await api('step-admin.php?action=create',{method:'POST',body:JSON.stringify({module_id:moduleId,code,title:'Новый шаг',step_type_id:stepTypeId,position,content:{content:'',preview:''},validation:{answer:null},teacher_only:{}})});window.location.href=`../admin/step.html?id=${encodeURIComponent(code)}`;}catch(e){toast('Не удалось добавить шаг');}
  }

  function renderAdminBuilder() {
    if (!requireRole("admin")) return;
    const courseId = Number(new URLSearchParams(location.search).get("course") || 1);
    const course = getCourse(courseId) || CONTENT.courses[0];
    page("Конструктор курса", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Конструктор</span><h1>${escapeHtml(course.title)}</h1><p>Структура Course → Module → Step. Типы шагов расширяемы без изменения основной логики.</p></section><section class="builder-layout"><div class="panel">${course.modules.map((module) => `<div class="builder-module"><div class="builder-module-head"><b>${escapeHtml(module.title)}</b><button class="small-button" type="button" onclick="window.KF.openAddStepModal(${module.id}, '${escapeHtml(module.code)}', ${module.steps.length + 1})">+ Шаг</button></div>${module.steps.map((id) => { const step = getStep(id); return `<a href="../admin/step.html?id=${id}" class="builder-step"><span>${id}</span><div><b>${escapeHtml(step.title)}</b><small>${typeBadge(step.type)}</small></div><span>→</span></a>`; }).join("")}</div>`).join("")}</div><aside class="staff-side-card"><span class="eyebrow">Публикация</span><b>Версия 1.0</b><p>Все 30 шагов содержатся в учебном пакете.</p><button class="btn full" onclick="window.KF.toast('Изменения сохранены в демо-режиме')">Сохранить</button></aside></section></div>`, staffHeader("admin", "builder"));
  }

  async function saveStep(id) {
    const step=getStep(id); const title=document.getElementById('admin-step-title').value.trim(); const position=Number(document.getElementById('admin-step-position').value)||1; const typeId=Number(document.getElementById('admin-step-type').value)||1; const content=document.getElementById('admin-step-content').value;
    const answerText=document.getElementById('admin-step-answer').value.trim(); const answerLines=answerText.split('\n').map(x=>x.trim()).filter(Boolean);
    try{await api('step-admin.php?action=update',{method:'POST',body:JSON.stringify({id:step.dbId,title,position,step_type_id:typeId,content:{content,preview:content.split('\n')[0]||''},validation:{answer:answerLines.length>1?answerLines:(answerLines[0]||null)},teacher_only:{}})});await hydrateFromServer();renderAdminStep();toast('Изменения шага сохранены в базе данных');}catch(e){toast('Не удалось сохранить шаг');}
  }

  async function renderAdminStep() {
    if(!requireRole('admin')) return; const id=new URLSearchParams(location.search).get('id')||'1.1.1'; const step=getStep(id)||CONTENT.steps[0]; const course=CONTENT.courses.find(item=>getCourseSteps(item).some(s=>s.id===step.id)); const courseId=course?.id||1; const answer=Array.isArray(step.answer)?step.answer.join('\n'):(step.answer||''); let types=[]; try{types=(await api('step-admin.php?action=types')).types||[];}catch(_){types=[];}
    const selectedType=types.find(t=>t.code===step.type);
    page('Редактор шага',`<div class="container narrow staff-container"><div class="breadcrumbs"><a href="../admin/builder.html?course=${courseId}">← Вернуться к курсу</a><span>/</span><span>${escapeHtml(step.id)}</span></div><section class="page-intro"><span class="eyebrow">Конструктор</span><h1>Редактор шага ${escapeHtml(step.id)}</h1><p>Тип, содержание и ответ сохраняются в базе данных.</p></section><section class="panel form-panel"><label class="field-label" for="admin-step-title">Название</label><input id="admin-step-title" class="field" value="${escapeHtml(step.title)}"><label class="field-label" for="admin-step-type">Тип шага</label><select id="admin-step-type" class="field">${types.map(t=>`<option value="${t.id}" ${t.code===step.type?'selected':''}>${escapeHtml(t.title)}</option>`).join('')}</select><label class="field-label" for="admin-step-position">Позиция</label><input id="admin-step-position" class="field" type="number" min="1" value="${step.position}"><label class="field-label" for="admin-step-content">Содержание</label><textarea id="admin-step-content" class="field textarea large-textarea">${escapeHtml(step.content)}</textarea><label class="field-label" for="admin-step-answer">Эталонный ответ</label><textarea id="admin-step-answer" class="field textarea" placeholder="Для нескольких правильных ответов — по одному в строке">${escapeHtml(answer)}</textarea><div class="editor-note">Правильный ответ доступен только системе проверки и администратору.</div><button class="btn" type="button" onclick="window.KF.saveStep('${escapeHtml(step.id)}')">Сохранить изменения</button></section></div>`,staffHeader('admin','builder'));
  }

  function toggleUserForm(id) {
    const form = document.getElementById(`user-edit-${id}`);
    if (form) form.hidden = !form.hidden;
  }

  function toggleNewUserForm() {
    const form = document.getElementById("new-user-form");
    const button = document.getElementById("new-user-toggle");
    if (!form || !button) return;
    form.hidden = !form.hidden;
    button.setAttribute("aria-expanded", String(!form.hidden));
  }

  async function saveUser(id) {
    const value = (field) => document.getElementById(`user-${id}-${field}`).value.trim();
    const password = value("password");
    try {
      await api("users.php", { method: "POST", body: JSON.stringify({ id, login: value("login"), name: value("name"), role: value("role"), grade: value("grade") || null, is_active: document.getElementById(`user-${id}-active`).checked ? 1 : 0, ...(password ? { password, password_changed: true } : {}) }) });
      await renderAdminUsers();
      toast("Пользователь сохранён в базе данных");
    } catch (error) {
      toast("Не удалось сохранить пользователя");
    }
  }

  async function createUser() {
    const value = (field) => document.getElementById(`new-user-${field}`).value.trim();
    try {
      await api("users.php", { method: "POST", body: JSON.stringify({ login: value("login"), name: value("name"), role: value("role"), grade: value("grade") || null, password: value("password") || "1234" }) });
      await renderAdminUsers();
      toast("Пользователь добавлен в базу данных");
    } catch (error) {
      toast("Не удалось добавить пользователя");
    }
  }

  async function renderAdminUsers() {
    if (!requireRole("admin")) return;
    let rows;
    try {
      const data = await api("users.php");
      rows = (data.users || []).map((user) => `<div class="user-entry"><div class="table-row"><div class="avatar small">${escapeHtml(user.name.slice(0, 1))}</div><div><b>${escapeHtml(user.name)}</b><small>${escapeHtml(user.login)}</small></div><span class="role-pill">${user.role === "student" ? "Ученик" : user.role === "curator" ? "Куратор" : "Администратор"}</span><span>${user.is_active ? "Активен" : "Отключён"}</span><button class="small-button" type="button" onclick="window.KF.toggleUserForm(${user.id})">Изменить</button></div><div id="user-edit-${user.id}" class="user-edit-form" hidden><label class="field-label" for="user-${user.id}-name">Имя</label><input id="user-${user.id}-name" class="field" value="${escapeHtml(user.name)}"><label class="field-label" for="user-${user.id}-login">Логин</label><input id="user-${user.id}-login" class="field" value="${escapeHtml(user.login)}"><label class="field-label" for="user-${user.id}-role">Роль</label><select id="user-${user.id}-role" class="field"><option value="student" ${user.role === "student" ? "selected" : ""}>Ученик</option><option value="curator" ${user.role === "curator" ? "selected" : ""}>Куратор</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>Администратор</option></select><label class="field-label" for="user-${user.id}-grade">Класс</label><input id="user-${user.id}-grade" class="field" type="number" min="1" max="11" value="${user.grade ?? ""}"><label class="field-label" for="user-${user.id}-password">Новый пароль</label><input id="user-${user.id}-password" class="field" type="password" placeholder="Оставьте пустым без изменений"><label class="switch-row"><span>Активен</span><input id="user-${user.id}-active" type="checkbox" ${user.is_active ? "checked" : ""}></label><button class="btn" type="button" onclick="window.KF.saveUser(${user.id})">Сохранить пользователя</button></div></div>`).join("");
    } catch (error) {
      console.warn("Users loading failed", error);
      rows = `<div class="empty-state">Не удалось загрузить пользователей.</div>`;
    }
    page("Пользователи", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Доступ</span><h1>Пользователи и роли</h1><p>Пользователи загружаются из базы данных.</p></section><section class="panel"><div class="panel-head"><h2>Список пользователей</h2><button id="new-user-toggle" class="btn" type="button" aria-expanded="false" onclick="window.KF.toggleNewUserForm()">+ Добавить</button></div>${rows}</section><section id="new-user-form" class="panel form-panel" hidden><div class="panel-head"><div><span class="eyebrow">Новая запись</span><h2>Добавить пользователя</h2></div></div><label class="field-label" for="new-user-name">Имя</label><input id="new-user-name" class="field" placeholder="Имя пользователя"><label class="field-label" for="new-user-login">Логин</label><input id="new-user-login" class="field" placeholder="login"><label class="field-label" for="new-user-role">Роль</label><select id="new-user-role" class="field"><option value="student">Ученик</option><option value="curator">Куратор</option><option value="admin">Администратор</option></select><label class="field-label" for="new-user-grade">Класс</label><input id="new-user-grade" class="field" type="number" min="1" max="11" placeholder="5"><label class="field-label" for="new-user-password">Пароль</label><input id="new-user-password" class="field" type="password" placeholder="По умолчанию 1234"><button class="btn" type="button" onclick="window.KF.createUser()">Сохранить пользователя</button></section></div>`, staffHeader("admin", "users"));
  }

  function renderAdminAssignments() {
    if (!requireRole("admin")) return;
    page("Назначения", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Доступ к курсам</span><h1>Назначения</h1><p>Определите, какие курсы доступны конкретным ученикам или группам.</p></section><section class="panel"><div class="table-row"><div><b>Маша К.</b><small>Ученик</small></div><span>Scratch</span><span>Активно</span><button class="small-button" onclick="window.KF.toast('Назначение открыто для редактирования')">Изменить</button></div><div class="table-row"><div><b>Илья П.</b><small>Ученик</small></div><span>Minecraft Education</span><span>Активно</span><button class="small-button" onclick="window.KF.toast('Назначение открыто для редактирования')">Изменить</button></div><div class="table-row"><div><b>Группа 5–7 класс</b><small>Группа</small></div><span>Python</span><span>Активно</span><button class="small-button" onclick="window.KF.toast('Назначение открыто для редактирования')">Изменить</button></div></section></div>`, staffHeader("admin", "assignments"));
  }

  async function renderAdminAnalytics() {
    if (!requireRole("admin")) return;
    let analytics = { metrics: {}, courses: [] };
    try {
      analytics = await api("analytics.php");
    } catch (error) {
      console.warn("Admin analytics loading failed", error);
    }
    const metrics = analytics.metrics || {};
    const students = Number(metrics.students || 0);
    const totalSteps = Number(metrics.total_steps || 0);
    const doneSteps = Number(metrics.done || 0);
    const averageProgress = students && totalSteps ? Math.round(doneSteps / (students * totalSteps) * 100) : 0;
    const courseBars = (analytics.courses || []).map((course) => {
      const total = Number(course.total_steps || 0) * Math.max(students, 1);
      const percent = total ? Math.round(Number(course.done_items || 0) / total * 100) : 0;
      return `<span title="${escapeHtml(course.title)}: ${percent}%" style="height:${Math.max(percent, 8)}%"></span>`;
    }).join("");
    const courseLabels = (analytics.courses || []).map((course) => `<span>Курс ${course.id}</span>`).join("");
    page("Аналитика администратора", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Данные</span><h1>Аналитика платформы</h1><p>Сводка загружается из базы данных.</p></section><div class="metric-grid"><div class="metric-card"><span>Активные ученики</span><strong>${students}</strong><small>в системе</small></div><div class="metric-card"><span>Средний прогресс</span><strong>${averageProgress}%</strong><small>по платформе</small></div><div class="metric-card"><span>Шагов зачтено</span><strong>${doneSteps}</strong><small>всего</small></div><div class="metric-card warning"><span>На проверке</span><strong>${Number(metrics.review || 0)}</strong><small>сейчас</small></div></div><section class="panel chart-panel"><h2>Прогресс по курсам</h2><div class="fake-chart">${courseBars}</div><div class="chart-labels">${courseLabels}</div></section></div>`, staffHeader("admin", "analytics"));
  }

  async function saveSettings() {
    try {
      await api("settings.php", { method: "POST", body: JSON.stringify({ app_name: document.getElementById("admin-setting-app-name").value.trim(), timezone: document.getElementById("admin-setting-timezone").value, auto_save_progress: document.getElementById("admin-setting-auto-save").checked }) });
      toast("Настройки сохранены в базе данных");
    } catch (error) {
      toast("Не удалось сохранить настройки");
    }
  }

  async function renderAdminSettings() {
    if (!requireRole("admin")) return;
    let settings = { app_name: "КодФормула", timezone: "Europe/Prague", auto_save_progress: "1" };
    try {
      const data = await api("settings.php");
      settings = data.settings || settings;
    } catch (error) {
      console.warn("Settings loading failed", error);
    }
    page("Настройки", `<div class="container staff-container"><section class="page-intro"><span class="eyebrow">Система</span><h1>Настройки</h1><p>Параметры загружаются и сохраняются в базе данных.</p></section><section class="panel form-panel"><label class="field-label" for="admin-setting-app-name">Название платформы</label><input id="admin-setting-app-name" class="field" value="${escapeHtml(settings.app_name)}"><label class="field-label" for="admin-setting-timezone">Часовой пояс</label><select id="admin-setting-timezone" class="field"><option value="Europe/Prague" ${settings.timezone === "Europe/Prague" ? "selected" : ""}>Europe/Prague</option><option value="Europe/Moscow" ${settings.timezone === "Europe/Moscow" ? "selected" : ""}>Europe/Moscow</option></select><label class="field-label">Автоматически сохранять прогресс</label><label class="switch-row"><span>Включено</span><input id="admin-setting-auto-save" type="checkbox" ${settings.auto_save_progress === "1" ? "checked" : ""}></label><button class="btn" type="button" onclick="window.KF.saveSettings()">Сохранить</button></section></div>`, staffHeader("admin", "settings"));
  }

  function toast(message) {
    let node = document.querySelector(".toast");
    if (!node) {
      node = document.createElement("div");
      node.className = "toast";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add("show");
    setTimeout(() => node.classList.remove("show"), 2200);
  }

  async function markStepDone(id) {
    const step = getStep(id);
    if (!step?.dbId) return;
    try {
      await api("progress.php", { method: "POST", body: JSON.stringify({ step_id: step.dbId, status: "done" }) });
      state.progress[id] = "done";
      saveState();
      renderStep(id);
    } catch (_) {
      toast("Не удалось сохранить прогресс");
    }
  }

  async function checkAnswer(id) {
    const result=document.getElementById("step-result");
    const choices=[...document.querySelectorAll('input[name="step-choice"]:checked')].map(x=>x.value);
    const input=document.getElementById("step-answer"); const value=choices.length?choices.join('\n'):(input?.value.trim()||'');
    if(!value){result.hidden=false;result.className="result-box error";result.textContent="Выберите или введите ответ.";return;}
    try { const remote=await api("submissions.php",{method:"POST",body:JSON.stringify({step_code:id,type:"answer",value})}); state.progress[id]=remote.status==='accepted'?'done':'failed';saveState();result.hidden=false;result.className=`result-box ${remote.status==='accepted'?'success':'error'}`;result.textContent=remote.comment||''; }
    catch(_){result.hidden=false;result.className="result-box error";result.textContent="Не удалось проверить ответ на сервере.";}
  }

  async function submitCode(id) {
    const code = document.getElementById("code-answer")?.value.trim();
    const result = document.getElementById("step-result");
    if (!code || code.length < 10) { result.hidden=false; result.className="result-box error"; result.textContent="Добавьте решение на Python 3 перед отправкой."; return; }
    try {
      const remote = await api("submissions.php", { method:"POST", body:JSON.stringify({ step_code:id, type:"code", value:code }) });
      state.submissions[id]={type:"code",value:code,submittedAt:new Date().toISOString()}; state.progress[id]=remote.status==='accepted'?'done':remote.status==='failed'?'failed':'review'; saveState();
      result.hidden=false; result.className=`result-box ${remote.status==='accepted'?'success':remote.status==='failed'?'error':''}`; result.textContent=remote.comment || "Решение отправлено.";
    } catch (_) { result.hidden=false; result.className="result-box error"; result.textContent="Не удалось отправить решение на сервер."; }
  }

  async function submitWork(id) {
    const value = document.getElementById("work-answer")?.value.trim(); const result=document.getElementById("step-result");
    if(!value){result.hidden=false;result.className="result-box error";result.textContent="Добавьте ссылку или комментарий к работе.";return;}
    try { await api("submissions.php",{method:"POST",body:JSON.stringify({step_code:id,type:"manual",value})}); state.submissions[id]={type:"manual",value,submittedAt:new Date().toISOString()};state.progress[id]="review";saveState();result.hidden=false;result.className="result-box success";result.textContent="Работа отправлена куратору на проверку."; }
    catch(_){result.hidden=false;result.className="result-box error";result.textContent="Не удалось отправить работу на сервер.";}
  }

  async function reviewSubmission(id, accepted) {
    const result=document.getElementById("review-result");const comment=document.getElementById("review-comment")?.value.trim();
    if(!accepted&&!comment){result.hidden=false;result.className="result-box error";result.textContent="Для возврата работы добавьте комментарий ученику.";return;}
    try {
      const list=await api("submissions.php"); const sub=list.submissions.find(x=>String(x.id)===String(id)||x.step_code===id); if(!sub) throw new Error("NOT_FOUND");
      await api("review.php",{method:"POST",body:JSON.stringify({submission_id:sub.id,accepted,comment,score:accepted?100:0})});
      state.progress[id]=accepted?"done":"returned";if(comment)state.feedback[id]=comment;saveState();result.hidden=false;result.className="result-box success";result.textContent=accepted?"Работа принята.":"Работа возвращена ученику.";
    } catch(_){result.hidden=false;result.className="result-box error";result.textContent="Не удалось сохранить решение куратора.";}
  }

  async function init() {
    window.KF = {
      logout,
      toast,
      markStepDone,
      checkAnswer,
      submitCode,
      submitWork,
      reviewSubmission,
      openAddStepModal,
      createStep,
      saveStep,
      createCourse,
      toggleCourseForm,
      toggleUserForm,
      toggleNewUserForm,
      saveUser,
      createUser,
      saveSettings
    };

    await hydrateFromServer();

    const pageName = document.body.dataset.page;
    if (pageName === "student-dashboard") renderStudentDashboard();
    else if (pageName === "student-courses") renderStudentCourses();
    else if (pageName === "student-results") renderStudentResults();
    else if (pageName === "student-history") renderStudentHistory();
    else if (pageName === "course") renderCourse(Number(document.body.dataset.course || new URLSearchParams(location.search).get("id")));
    else if (pageName === "step") renderStep(document.body.dataset.step || new URLSearchParams(location.search).get("id"));
    else if (pageName === "curator-dashboard") renderCuratorDashboard();
    else if (pageName === "curator-submissions") renderCuratorSubmissions();
    else if (pageName === "curator-submission") renderCuratorSubmission();
    else if (pageName === "curator-students") renderCuratorStudents();
    else if (pageName === "curator-analytics") renderCuratorAnalytics();
    else if (pageName === "admin-dashboard") renderAdminDashboard();
    else if (pageName === "admin-courses") renderAdminCourses();
    else if (pageName === "admin-builder") renderAdminBuilder();
    else if (pageName === "admin-step") renderAdminStep();
    else if (pageName === "admin-users") renderAdminUsers();
    else if (pageName === "admin-analytics") renderAdminAnalytics();
    else if (pageName === "admin-settings") renderAdminSettings();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
