document
  .getElementById("loginForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault(); // Prevent form from submitting traditionally

    const loginButton = document.getElementById("loginButton");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    // Disable the button and change text to "Verifying..."
    loginButton.disabled = true;
    loginButton.textContent = "Verifying...";

    try {
      const response = await fetch("/api/addaccount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      // Check if the login was successful
      if (result.message == "Account added successfully" || result.success) {
        alert("Login successful! new account added");
        window.location.href = "/pages/viewaccounts.html";
      } else {
        alert("Login failed: " + (result.message || "Invalid credentials"));
      }
    } catch (error) {
      alert("An error occurred: " + error.message);
    } finally {
      // Re-enable the button and reset text
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  });
