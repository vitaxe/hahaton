(() => {
  "use strict";

  const STORAGE_KEY = "kodformula_demo_state_v5";
  const users = {
    student: { login: "masha", password: "1234", name: "Маша К.", role: "student", grade: 4 },
    curator: { login: "anna", password: "1234", name: "Анна Сергеевна", role: "curator" },
    admin: { login: "admin", password: "1234", name: "Администратор", role: "admin" }
  };

  const form = document.getElementById("login-form");
  const loginInput = document.getElementById("login-input");
  const passwordInput = document.getElementById("password-input");
  const error = document.getElementById("auth-error");
  const context = document.getElementById("login-context");

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async function login(loginValue, passwordValue) {
    const loginName = String(loginValue || "").trim().toLowerCase();
    const password = String(passwordValue || "");
    try {
      const response = await fetch("api/auth.php?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ login: loginName, password })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        error.hidden = false;
        loginInput.focus();
        return;
      }
      const state = loadState();
      state.user = data.user;
      state.csrf = data.csrf || null;
      state.route = data.user.role === "student" ? "dashboard" : "staff";
      state.staffView = "dashboard";
      state.adminView = "dashboard";
      saveState(state);
      window.location.href = data.user.role === "student" ? "pages/student/dashboard.html" : data.user.role === "curator" ? "pages/curator/dashboard.html" : "pages/admin/dashboard.html";
    } catch (e) {
      error.hidden = false;
      error.textContent = "Сервер базы данных недоступен. Проверьте запуск PHP и MySQL.";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.hidden = true;
    login(loginInput.value, passwordInput.value);
  });

  document.querySelectorAll("[data-demo-role]").forEach((button) => {
    button.addEventListener("click", () => {
      const user = users[button.dataset.demoRole];
      if (!user) return;
      loginInput.value = user.login;
      passwordInput.value = user.password;
      error.hidden = true;
      loginInput.focus();
    });
  });

  const from = new URLSearchParams(window.location.search).get("from");
  if (from === "training") {
    context.textContent = "Войдите, чтобы начать обучение.";
  } else if (from && from.startsWith("course-")) {
    context.textContent = "Войдите, чтобы открыть выбранный курс.";
  }

  loginInput.focus();
})();
