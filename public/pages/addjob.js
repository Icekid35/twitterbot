document.addEventListener("DOMContentLoaded", async () => {
  // const accountSlider = document.getElementById("accountSlider");
  const accountCount = document.getElementById("accountCount");
  const commentCheckbox = document.getElementById("comment");
  const commentFieldsContainer = document.getElementById("commentFields");
  const submitButton = document.getElementById("submitButton");

  const response = await fetch("/api/accounts");
  const accounts = await response.json();
  const numAccounts = accounts.length;
  accountCount.textContent = numAccounts;

  // Update account count label
  // accountSlider.addEventListener("input", () => {
  //   updateCommentFields();
  // });

  // Show/hide comment fields when comment checkbox is toggled
  commentCheckbox.addEventListener("change", async () => {
    await updateCommentFields();
  });
  async function toBase64(file) {
    const mod = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
    console.log(mod);
    return mod;
  }
  // Function to update comment fields based on the slider value
  async function updateCommentFields() {
    commentFieldsContainer.innerHTML = ""; // Clear existing fields

    if (commentCheckbox.checked) {
      for (let i = 1; i <= numAccounts; i++) {
        const commentGroup = document.createElement("div");
        commentGroup.className = "comment-group";

        const commentLabel = document.createElement("label");
        commentLabel.textContent = `Comment Text for Account ${i}`;

        const commentInput = document.createElement("input");
        commentInput.type = "text";
        commentInput.placeholder = "Enter comment text";
        commentInput.required = true;
        commentInput.minLength = 5;

        const mediaCheckbox = document.createElement("input");
        mediaCheckbox.type = "checkbox";
        mediaCheckbox.id = `mediaCheckbox${i}`;

        const mediaLabel = document.createElement("label");
        mediaLabel.textContent = "Include Media";

        const mediaFileInput = document.createElement("input");
        mediaFileInput.type = "file";
        mediaFileInput.accept = "image/*";
        mediaFileInput.style.display = "none"; // Hide initially

        // Show file picker when "Include Media" is checked
        mediaCheckbox.addEventListener("change", () => {
          mediaFileInput.style.display = mediaCheckbox.checked
            ? "block"
            : "none";
        });

        // Append elements
        commentGroup.appendChild(commentLabel);
        commentGroup.appendChild(commentInput);
        commentGroup.appendChild(mediaLabel);
        commentGroup.appendChild(mediaCheckbox);
        commentGroup.appendChild(mediaFileInput);

        commentFieldsContainer.appendChild(commentGroup);
      }
    }
  }
  await updateCommentFields();

  // Handle form submission
  submitButton.addEventListener("click", async () => {
    function isUrlValid(userInput) {
      const twitterRegex =
        /^https?:\/\/(www\.)?x\.com\/[A-Za-z0-9_]+\/status\/\d+$/;
      return twitterRegex.test(userInput);
    }

    if (!isUrlValid(document.getElementById("twitterLink").value.trim()))
      return alert("Please enter a valid URL");

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    // Initialize FormData
    const formData = new FormData();

    // Append the main job data to FormData
    formData.append(
      "link",
      document.getElementById("twitterLink").value.trim()
    );
    formData.append("like", document.getElementById("like").checked);
    formData.append("retweet", document.getElementById("retweet").checked);
    formData.append("bookmark", document.getElementById("bookmark").checked);
    formData.append("comment", commentCheckbox.checked);

    // Handle comment data if commentCheckbox is checked
    if (commentCheckbox.checked) {
      const commentInputs =
        commentFieldsContainer.querySelectorAll(".comment-group");

      commentInputs.forEach((group, index) => {
        const text = group.querySelector("input[type='text']").value.trim();
        const includeMedia = group.querySelector(
          "input[type='checkbox']"
        ).checked;
        const mediaFile = group.querySelector("input[type='file']")?.files;
        if ((text == " " || text == "") && (!mediaFile || mediaFile.length < 1))
          return;

        formData.append(`comments[${index}][account]`, index + 1);
        formData.append(`comments[${index}][text]`, text);
        formData.append(`comments[${index}][includeMedia]`, includeMedia);

        if (includeMedia) {
          if (mediaFile[0]) {
            formData.append(`comments[${index}][mediaFile]`, mediaFile[0]); // Add media file directly
          }
        }
      });
    }

    // Ensure at least one action is selected
    if (
      !document.getElementById("like").checked &&
      !document.getElementById("retweet").checked &&
      !document.getElementById("bookmark").checked &&
      !commentCheckbox.checked
    ) {
      submitButton.disabled = false;
      submitButton.textContent = "Add Job";
      return alert("Please select at least one job action");
    }

    try {
      // Submit the form data via fetch
      const response = await fetch("/api/addjob", {
        method: "POST",
        body: formData, // Send FormData object directly
      });

      const result = await response.json();

      if (response.ok) {
        alert("Job added successfully!");
        window.location.href = "/pages/viewjobs.html";
      } else {
        alert("Error adding job: " + result.message);
      }
    } catch (error) {
      alert("Error adding job: " + error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Add Job";
    }
  });
});
