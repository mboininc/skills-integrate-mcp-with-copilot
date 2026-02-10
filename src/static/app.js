document.addEventListener("DOMContentLoaded", () => {
  const loginModal = document.getElementById("login-modal");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const closeBtn = document.querySelector(".close");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const userMenu = document.getElementById("user-menu");
  const userInfo = document.getElementById("user-info");
  const mainContent = document.getElementById("main-content");
  const pleaseLogin = document.getElementById("please-login");
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  let currentUser = null;

  // Modal management
  loginBtn.addEventListener("click", () => {
    loginModal.style.display = "block";
  });

  closeBtn.addEventListener("click", () => {
    loginModal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.style.display = "none";
    }
  });

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
      });
      document.getElementById(tabName).classList.add("active");
      
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Login handler
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch(`/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, {
        method: "POST",
        credentials: "include"
      });

      const result = await response.json();

      if (response.ok) {
        currentUser = result.user;
        updateAuthUI();
        loginModal.style.display = "none";
        loginForm.reset();
        document.getElementById("login-email").value = "";
        document.getElementById("login-password").value = "";
        fetchActivities();
      } else {
        alert(result.detail || "Login failed");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert("Failed to login. Please try again.");
    }
  });

  // Register handler
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    try {
      const response = await fetch(`/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&full_name=${encodeURIComponent(fullName)}`, {
        method: "POST"
      });

      const result = await response.json();

      if (response.ok) {
        alert("Registration successful! Please login with your credentials.");
        registerForm.reset();
        // Switch to login tab
        document.querySelector('[data-tab="login-tab"]').click();
      } else {
        alert(result.detail || "Registration failed");
      }
    } catch (error) {
      console.error("Error registering:", error);
      alert("Failed to register. Please try again.");
    }
  });

  // Logout handler
  logoutBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include"
      });

      if (response.ok) {
        currentUser = null;
        updateAuthUI();
        activitiesList.innerHTML = "";
        activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  });

  // Check if user is already logged in
  async function checkAuth() {
    try {
      const response = await fetch("/auth/me", {
        credentials: "include"
      });

      if (response.ok) {
        const user = await response.json();
        currentUser = user;
        updateAuthUI();
        fetchActivities();
      }
    } catch (error) {
      // User not authenticated
      updateAuthUI();
    }
  }

  // Update UI based on auth state
  function updateAuthUI() {
    if (currentUser) {
      loginBtn.classList.add("hidden");
      userMenu.classList.remove("hidden");
      userInfo.textContent = `${currentUser.full_name} (${currentUser.role})`;
      mainContent.classList.remove("hidden");
      pleaseLogin.classList.add("hidden");
    } else {
      loginBtn.classList.remove("hidden");
      userMenu.classList.add("hidden");
      mainContent.classList.add("hidden");
      pleaseLogin.classList.remove("hidden");
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities", {
        credentials: "include"
      });
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}" ${currentUser && (currentUser.role === "faculty" || currentUser.role === "admin") ? "" : "style='display:none'"}>❯</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          credentials: "include"
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuth();
});