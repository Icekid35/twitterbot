document.addEventListener("DOMContentLoaded", () => {
  const activeJobSection = document.getElementById("activeJob");
  const activeJobLink = document.getElementById("activeJobLink");
  const activeLikes = document.getElementById("activeLikes");
  const activeRetweets = document.getElementById("activeRetweets");
  const activeBookmarks = document.getElementById("activeBookmarks");
  const activeComments = document.getElementById("activeComments");
  const jobHistoryContainer = document.getElementById("jobHistory");
  const jobHistoryBody = document.getElementById("jobHistoryBody");
  jobHistoryBody.innerHTML = "<h2>Loading...</h2>";
  // Fetch job data from API every minute
  async function fetchJobs() {
    try {
      // Replace with your API endpoint
      const response = await fetch("/api/jobs");
      const data = await response.json();

      // let data={
      //   "activeJob": {
      //     "link": "https://twitter.com/someuser/status/1234567890",
      //     "likes": 45,
      //     "retweets": 20,
      //     "bookmarks": 12,
      //     "comments": 8
      //   },
      //   "jobHistory": [
      //     {
      //       "link": "https://twitter.com/anotheruser/status/0987654321",
      //       "likes": 120,
      //       "retweets": 50,
      //       "bookmarks": 30,
      //       "comments": 25
      //     },
      //     {
      //       "link": "https://twitter.com/exampleuser/status/1122334455",
      //       "likes": 75,
      //       "retweets": 40,
      //       "bookmarks": 20,
      //       "comments": 10
      //     },
      //     {
      //       "link": "https://twitter.com/randomuser/status/5566778899",
      //       "likes": 200,
      //       "retweets": 80,
      //       "bookmarks": 60,
      //       "comments": 45
      //     }
      //   ]
      // }

      // Process active job
      if (data.activeJob) {
        activeJobLink.href = data.activeJob.link;
        activeJobLink.textContent = data.activeJob.link;
        activeLikes.textContent = data.activeJob.likes;
        activeRetweets.textContent = data.activeJob.retweets;
        activeBookmarks.textContent = data.activeJob.bookmarks;
        activeComments.textContent = data.activeJob.comments;
        activeJobSection.style.display = "block";
      } else {
        activeJobSection.style.display = "none";
      }

      // Populate job history
      jobHistoryBody.innerHTML = ""; // Clear existing history
      if (data.jobHistory.length < 1)
        jobHistoryBody.innerHTML = "<h3>No completed jobs yet</h3>";
      data.jobHistory.forEach((job) => {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td><a href="${job.link}" target="_blank">${job.link}</a></td>
          <td>${job.likes}</td>
          <td>${job.retweets}</td>
          <td>${job.bookmarks}</td>
          <td>${job.comments}</td>
        `;

        jobHistoryBody.appendChild(row);
      });
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  }

  // Initial fetch and set interval for periodic fetch
  fetchJobs();
  setInterval(fetchJobs, 5000); // Fetch every 60 seconds
});
