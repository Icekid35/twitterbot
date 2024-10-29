document.addEventListener("DOMContentLoaded", async () => {
  const accountsList = document.getElementById("accountsList");

  // Fetch and display accounts
  async function fetchAccounts() {
    try {
      const response = await fetch("/api/accounts");
      const accounts = await response.json();
      //   let accounts=[{
      //     username:'habib',
      //     active:true
      //   },{
      //     username:'icekid',
      //     active:true
      //   },{
      //     username:'junior',
      //     active:false
      //   },{
      //     username:'smart',
      //     active:true
      //   },{
      //     username:'ibro',
      //     active:false
      //   },
      // ]
      if (accounts.length < 1) {
        accountsList.innerHTML =
          "<h3>NO Active Accounts, Please Add An Account</h3>";
      } else {
        accounts.forEach((account) => {
          const accountItem = createAccountItem(account);
          accountsList.appendChild(accountItem);
        });
      }
    } catch (error) {
      alert("Error fetching accounts: " + error.message);
    }
  }

  // Create account item element
  function createAccountItem(account) {
    const accountItem = document.createElement("li");
    accountItem.className = "account-item";
    accountItem.setAttribute("data-id", account.id);

    const accountInfo = document.createElement("div");
    accountInfo.className = "account-info";

    // Status dot
    const statusDot = document.createElement("span");
    statusDot.className =
      "status-dot " + (account.active ? "status-active" : "status-inactive");

    // Account username and status
    const username = document.createElement("span");
    username.textContent = account.username;

    accountInfo.appendChild(statusDot);
    accountInfo.appendChild(username);

    // Remove button
    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.onclick = () =>
      removeAccount(account.username, accountItem, removeButton);

    accountItem.appendChild(accountInfo);
    accountItem.appendChild(removeButton);

    return accountItem;
  }

  // Remove account
  async function removeAccount(accountId, accountItem, button) {
    button.disabled = true;
    button.textContent = "Removing...";

    try {
      // Replace with your actual API endpoint
      const response = await fetch(`/api/account/${accountId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Animate and remove the item from the DOM
        accountItem.classList.add("removing");
        setTimeout(() => accountItem.remove(), 300);
        alert("Account removed successfully");
      } else {
        const result = await response.json();
        alert(
          "Failed to remove account: " + (result.message || "Unknown error")
        );
      }
    } catch (error) {
      alert("Error removing account: " + error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Remove";
    }
  }

  // Initialize
  fetchAccounts();
});
