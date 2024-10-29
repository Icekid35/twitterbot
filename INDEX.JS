// Import required libraries
const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs").promises;
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// Puppeteer and other setup
const chromiumPath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const cookiesFilePath =  path.join(__dirname, "cookies");;
let browser = null;
let accounts = [];
let jobs = [];

// Set up storage for multer to save images to '/images' folder
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const imagesFolder = path.join(__dirname, "images");

    // Function to ensure folder exists
    async function ensureFolderExists(folderPath) {
      try {
        await fs.access(folderPath);
      } catch (error) {
        // If the folder does not exist, create it
        await fs.mkdir(folderPath, { recursive: true });
        console.log("Folder created:", folderPath);
      }
    }

    // Call this function to check or create the folder
    await ensureFolderExists(imagesFolder);
    cb(null, imagesFolder);
  },
  filename: (req, file, cb) => {
    // Save the file with a unique name to avoid collisions
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Use the Puppeteer stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Static file serving for Express
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Serve the `index.html` file at the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Account Management APIs
async function saveState() {
  await fs.writeFile(`jobs.json`, JSON.stringify(jobs, null, 2));
  if (accounts.length < 1) return console.log("no account again");
  await fs.writeFile(`accounts.json`, JSON.stringify(accounts, null, 2));
}
async function loadState() {
  try {
    try {
      const savedAcc = await fs.readFile("accounts.json");
      if (savedAcc) accounts = JSON.parse(savedAcc);
    } catch (error) {}
    try {
      const savedjobs = await fs.readFile("jobs.json");

      if (savedjobs) jobs = JSON.parse(savedjobs);

      let activeAvalaible = jobs.filter((jb) => jb.status == "active");
      // console.log(activeAvalaible)
      // console.log('uncompleted job Available')
      if (activeAvalaible?.length >= 1) {
        startJob(activeAvalaible[0]);
      }
    } catch (error) {}
    return true;
  } catch {
    return false;
  }
}
let activeWorker = false;
async function startJob(job) {
  if (activeWorker) return;
  activeWorker = true;
  let comcount = 0;
  for (let i = 0; i <= accounts.length - 1; i++) {
    if (
      !job.actions.like &&
      !job.actions.bookmark &&
      !job.actions.retweet &&
      !job.actions.comments[comcount]
    )
      return;
    let acc = accounts[i];
    let cj = jobs.find((jb) => jb.link == job.link);
    if (cj?.completedUsers?.includes?.(acc.username)) continue;
    await generatePage(
      browser,
      acc.username,
      job.link,
      job.actions.like,
      job.actions.bookmark,
      job.actions.retweet,
      job.actions.comments[comcount]
    );
    try {
      if(jobs.find((jb) => jb.link == job.link).actions.comments[comcount]) jobs.find((jb) => jb.link == job.link).actions.comments[comcount].done = true
     
    } catch (error) {
      console.log(error)
    }
    comcount += 1;
  }
  jobs.find((jb) => jb.link == job.link).status = "inactive";

  await saveState();
  activeWorker = false;
  let activeAvalaible = jobs.filter((jb) => jb.status == "active");

  if (activeAvalaible?.length >= 1) {
    startJob(activeAvalaible[0].link);
  }
  return true;
}
// Add Account
app.post("/api/addAccount", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  const existingAccount = accounts.find(
    (account) => account.username === username
  );
  if (existingAccount) {
    return res.status(400).json({ message: "Account already exists" });
  }
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();

  const goodlogin = await performLogin(page, username, password);
  context.close();
  if (goodlogin.sucess) {
    accounts.push({ username, password, active: true });
    await saveState();
    res.json({ message: "Account added successfully", sucess: true });
  } else {
    res.json({ message: goodlogin.err });
  }
});

// View Accounts
app.get("/api/accounts", (req, res) => {
  res.json(accounts);
});

// Delete Account
app.delete("/api/account/:username", async (req, res) => {
  const username = req.params.username;
  const accountIndex = accounts.findIndex(
    (account) => account.username === username
  );

  if (accountIndex === -1) {
    return res.status(404).json({ message: "Account not found" });
  }

  accounts.splice(accountIndex, 1);
  await saveState();

  res.json({ message: "Account removed successfully" });
});

// Job Management APIs

// Add Job
app.post("/api/addjob", upload.any(), async (req, res) => {
  console.log("new job recieved..");
  // Access non-file form data fields
  const { link, like, retweet, bookmark, comment } = req.body;
  let actions = {
    like: like === "true",
    retweet: retweet === "true",
    bookmark: bookmark === "true",
    comment: comment === "true",
    comments: [],
  };
  if (!link) {
    return res.status(400).json({ message: "Incomplete job details" });
  }
  let goodLink = await testLink(link);
  if (!goodLink) {
    return res.status(400).json({ message: "link is invalid" });
  }
  // Parse comments with multiple fields and files
  const comments = [];
  // console.log(req.body);

  for (let i = 0; i < req.body.comments.length; i++) {
    const comment = req.body.comments[i];

    const account = parseInt(comment.account);
    const text = comment.text;
    const includeMedia = comment.includeMedia === "true";

    // Find associated media file if it exists
    let mediaFile = null;
    if (includeMedia) {
      const file = req.files.find(
        (f) => f.fieldname === `comments[${i}][mediaFile]`
      );
      if (file) {
        mediaFile = `/images/${file.filename}`; // Path to saved file
      }
    }

    comments.push({ account, text, includeMedia, mediaFile });
  }
  // Add parsed comments to jobData
  actions.comments = comments;

  // console.log("Parsed jobData:", actions); // For debugging

  const newJob = {
    id: link,
    link,
    actions,
    likes: 0,
    retweets: 0,
    bookmarks: 0,
    comments: 0,
    status: "active",
    completedUsers: [],
  };
  console.log(newJob);
  let linkAvail = jobs.find((j) => j.link == link);
  if (linkAvail) {
    linkAvail.actions = actions;
    linkAvail.status = "active";
  } else {
    jobs.push(newJob);
  }
  await saveState();
  startJob(newJob);
  if (activeWorker) {
    res.json({ message: "Job added to que sucessfully", job: newJob });
  } else {
    res.json({ message: "Job added successfully", job: newJob });
  }
});

// View Jobs
app.get("/api/jobs", (req, res) => {
  const activeJob = jobs.find((job) => job.status === "active");
  const jobHistory = jobs.filter(
    (job) => job.status === "completed" || job.status === "inactive"
  );
  res.json({ activeJob, jobHistory });
});

// Remove Job (marks as inactive)
app.delete("/api/removeJob/:id", (req, res) => {
  const jobId = parseInt(req.params.id);
  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  job.status = "inactive";
  res.json({ message: "Job marked as inactive", job });
});

// Start the Express server and launch Puppeteer
try {
  app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(__dirname)
  try {
      const open = await import("open");
       await open.default(`http://localhost:${PORT}/`);
  } catch (error) {
   console.log("error from opening new page"+error) 
  }
  try {
      browser = await puppeteer.launch({
        executablePath: chromiumPath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    
      await loadState();
    
      // Close the browser on exit
      process.on("exit", async () => await browser.close());
  } catch (error) {
    console.log('error from opening browser'+error)
  }
  });
} catch (error) {
 console.log("error from opening server"+error) 
}

// Puppeteer helper functions
async function saveCookies(page, username = String) {
  const cookies = await page.cookies();
  await fs.writeFile(
    `${cookiesFilePath+"/"+username}-cookies.json`,
    JSON.stringify(cookies, null, 2)
  );
}

async function loadCookies(page, username) {
  try {
    const cookiesString = await fs.readFile(cookiesFilePath+"/"+username + "-cookies.json");
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    return true;
  } catch {
    return false;
  }
}

async function performLogin(page, username, password) {
  try {
    await page.goto("https://x.com/login", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    await page.waitForSelector('[autocomplete="username"]');
    await page.type('[autocomplete="username"]', username);
    await page.evaluate(() => {
      let btns = document.querySelectorAll("button");
      btns.forEach((btn) => {
        if (btn.innerText == "Next") btn.click();
        return;
      });
    });
    try {
      await page.waitForSelector('[autocomplete="current-password"]', {
        timeout: 10000,
      });
    } catch (err) {
      await page.close();

      return { sucess: false, err: "Username not correct" };
    }
    try {
      await page.type('[autocomplete="current-password"]', password);
      await page.click('[data-testid="LoginForm_Login_Button"]');
      await Promise.race([
        page.waitForNavigation({ waitUntil: "load", timeout: 30000 }),
        new Promise((resolve, reject) => {
          let isNavigating = false;
          page.on("framenavigated", (frame) => {
            if (frame === page.mainFrame()) {
              isNavigating = true;
            }
          });
          setTimeout(() => {
            if (!isNavigating) reject(new Error("password incorrect"));
          }, 5000);
        }),
      ]);
    } catch (err) {
      await page.close();

      return { sucess: false, err: "passcode not correct" };
    }

    await saveCookies(page, username);
    await page.close();
    return { sucess: true };
  } catch (err) {
    console.log(err);
    return { sucess: false, err: "unexpected error occured" };
  }
}

async function likeTweet(page) {
  try {
    const unlikeButton = await page.$('[data-testid="unlike"]');
    if (unlikeButton) {
      console.log("Tweet already liked. Skipping...");
      return false;
    }
    const likeButton = await page.$('[data-testid="like"]');
    await likeButton.click();
    console.log("Tweet liked!");
    return true;
  } catch (error) {
    console.error("Error liking tweet:", error);
    return false;
  }
}

async function retweetTweet(page) {
  try {
    const unretweetButton = await page.$('[data-testid="unretweet"]');
    if (unretweetButton) {
      console.log("Tweet already retweeted. Skipping...");
      return false;
    }
    const retweetButton = await page.$('[data-testid="retweet"]');
    await retweetButton.click();
    await page.waitForSelector('[data-testid="retweetConfirm"]');
    await page.click('[data-testid="retweetConfirm"]');
    console.log("Tweet retweeted!");
    return true;
  } catch (error) {
    console.error("Error retweeting tweet:", error);
    return false;
  }
}

async function bookmarkTweet(page) {
  try {
    const unbookmarkButton = await page.$('[data-testid="removeBookmark"]');
    if (unbookmarkButton) {
      console.log("Tweet already bookmarked. Skipping...");
      return false;
    }
    await page.click('[data-testid="bookmark"]');
    console.log("Tweet bookmarked!");
    return true;
  } catch (error) {
    console.error("Error bookmarking tweet:", error);
    return false;
  }
}

async function commentOnTweet(page, text = String, mediaUrl = null) {
  try {
    const replyButton = await page.$('[data-testid="reply"]');
    if (!replyButton) {
      console.log("Already replied to this tweet. Skipping...");
      return false;
    }
    // await replyButton.click();

    await page.waitForSelector('[data-testid="tweetTextarea_0"]', {
      timeout: 60000,
    });
    if(!text) text="  "
    await page.click('[data-testid="tweetTextarea_0"]');
    if (text) {
      await page.keyboard.type(text);
      const disableed = await page.$eval(
        '[data-testid="tweetButtonInline"]',
        (el) => el.disabled
        );
        if (disableed) {
        await page.click('[data-testid="tweetTextarea_0"]');
        console.log("commenting is still disabled");
        await page.keyboard.type(text);
      
      }
    }

    if (mediaUrl) {

      await page.waitForSelector('[data-testid="fileInput"]', {
        timeout: 60000,
      });
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.$eval('[data-testid="fileInput"]', (el) => el.click()),
      ]);
      await fileChooser.accept([path.join(__dirname, mediaUrl)]);
      await new Promise((r) => setTimeout(r, 15000));
    }

    await page.waitForSelector('[data-testid="tweetButtonInline"]', {
      timeout: 60000,
    });
    const disabled = await page.$eval(
      '[data-testid="tweetButtonInline"]',
      (el) => el.disabled
    );
    if (disabled) {
      console.log("commenting is still disabled");
      await page.click('[data-testid="tweetTextarea_0"]');
      await page.keyboard.type(text);
    }
    await page.click('[data-testid="tweetButtonInline"]');
    try {
      if (mediaUrl) {
        await page.waitForSelector('[data-testid="confirmationSheetCancel"]', {
          timeout: 5000,
        });
        await page.click('[data-testid="confirmationSheetCancel"]');
      }
    } catch (err) {}
    try {
      await page.waitForFunction(
        () => {
          return document.querySelector('[data-testid="tweetButtonInline"]')
            .disabled;
        },
        { timeout: 10000 }
      );
    } catch (err) {}
    console.log("Comment posted!");

    return true;
  } catch (error) {
    console.error("Error posting comment:", error);
    return false;
  }
}

async function testLink(adsLink) {
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  // Enable request interception
  await page.setRequestInterception(true);

  // Listen for intercepted requests and block specific resource types
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (["image", "stylesheet", "media"].includes(resourceType)) {
      // Block images, CSS, and video requests
      request.abort();
    } else {
      request.continue();
    }
  });
  try {
    await page.goto(adsLink, { timeout: 60000 });
    await page.waitForSelector('[data-testid="reply"]', { timeout: 60000 });

    page.close();
    context.close();
    return true;
  } catch (error) {
    page.close();
    context.close();
    return false;
  }
}

async function generatePage(
  browser,
  username,
  adsLink,
  like,
  bookmark,
  retweet,
  comment
) {
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  // Enable request interception
  await page.setRequestInterception(true);

  // Listen for intercepted requests and block specific resource types
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (["image", "stylesheet", "media"].includes(resourceType)) {
      // Block images, CSS, and video requests
      request.abort();
    } else {
      request.continue();
    }
  });
  try {
    if (!(await loadCookies(page, username)))
      await performLogin(page, username);

    await page.goto(adsLink, { timeout: 0 });
    await page.waitForSelector('[data-testid="reply"]', { timeout: 60000 });
    if (like) {
      let liked = await likeTweet(page);
      if (liked) jobs.find((jb) => jb.link == adsLink).likes += 1;
    }
    if (bookmark) {
      let bookmarkd = await bookmarkTweet(page);
      if (bookmarkd) jobs.find((jb) => jb.link == adsLink).bookmarks += 1;
    }
    if (retweet) {
      let retweetd = await retweetTweet(page);
      if (retweetd) jobs.find((jb) => jb.link == adsLink).retweets += 1;
    }
    if (comment && !comment?.done) {
      
      let commentd = await commentOnTweet(
        page,
        comment.text,
        comment.mediaFile
      );
      if (commentd) jobs.find((jb) => jb.link == adsLink).comments += 1;
      if (commentd) jobs.find((jb) => jb.link == adsLink)?.completedUsers?.push?.(username);
    }
    await new Promise((r) => setTimeout(r, 1000));

    page.close();
    context.close();
    await saveState();
  } catch (error) {
    page.close();
    context.close();

    console.log(error);
  }
}
