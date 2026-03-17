# 🚀 TaskFlow Manager

A modern, fast, and feature-rich personal task management web application. Built with vanilla HTML, CSS, and JavaScript, it runs entirely in the browser and offers a seamless experience with offline support, local storage, and optional cloud synchronization via Google Sheets.

## ✨ Features

- **📊 Analytical Dashboard:** Interactive charts showing task status, priority, and category distribution.
- **🗂️ Profile Management:** Create multiple workspaces (Profiles) to separate tasks (e.g., Work, Personal, 2024 Projects).
- **🏷️ Smart Tagging & Categories:** Organize tasks with customizable categories and color-coded priority labels.
- **📅 Progress Logs:** Add timestamped progress notes to track the history of individual tasks.
- **🔗 Source Linking:** Attach external URLs or document paths directly to tasks for quick access.
- **💾 Import/Export JSON:** Easily backup your entire workspace or share tasks using JSON files.
- **☁️ Google Sheets Cloud Sync:** (Optional) Seamlessly sync all your profiles and tasks to a Google Sheet to access them across different devices in real-time.

---

## 🛠️ How to Use (Locally)

Since this is a static web application, you don't need any complex server setup to start using it.

1. Clone or download this repository to your computer.
2. Open the folder containing the project files.
3. Simply double-click on `index.html` to open it in your web browser.
4. Start adding profiles and tasks! Your data will be saved securely in your browser's Local Storage.

---

## 🌐 How to Host Online (Free)

To access your TaskFlow from anywhere (mobile, tablet, other PCs), you can host it for free.

### Option A: GitHub Pages (Recommended if you cloned this repo)
1. Go to your GitHub repository **Settings**.
2. Navigate to **Pages** on the left sidebar.
3. Under "Build and deployment", select the **main** branch and click **Save**.
4. Within a few minutes, your site will be live at `https://your-username.github.io/your-repository-name`.

### Option B: Vercel / Netlify
1. Go to [Vercel](https://vercel.com) or [Netlify](https://netlify.com) and sign in.
2. Click "Add New Project" -> "Import from Git" and select this repository.
3. Click **Deploy**. You'll get a public URL instantly.

---

## ☁️ How to Set Up Google Sheets Database (Cloud Sync)

If you want your tasks to sync across devices, you can turn a Google Sheet into your personal, free cloud database.

### Step 1: Prepare the Google Sheet
1. Create a new, blank [Google Sheet](https://sheets.new/).
2. On the top menu, click **Extensions** > **Apps Script**.
3. Delete any existing code in the editor.
4. Copy and paste the following code:

```javascript
// --- Google Apps Script (TaskFlow Database V2.0) ---

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var action = e.parameter.action;
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Type', 'ProfileID', 'TaskID', 'DataJSON']); 
  }

  if (action == 'getData') {
    var data = sheet.getDataRange().getValues();
    var result = { profiles: [], tasks: {} };
    for (var i = 1; i < data.length; i++) {
        var type = data[i][0];
        var profId = data[i][1];
        var taskStr = data[i][3];
        try {
            var obj = JSON.parse(taskStr);
            if (type == 'PROFILES') {
                result.profiles = obj;
            } else if (type == 'TASK') {
                if (!result.tasks[profId]) result.tasks[profId] = [];
                result.tasks[profId].push(obj);
            }
        } catch(e) {}
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("Invalid Action").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Type', 'ProfileID', 'TaskID', 'DataJSON']); 
  }
  
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action == 'saveData') {
      sheet.clearContents();
      sheet.appendRow(['Type', 'ProfileID', 'TaskID', 'DataJSON']); 
      
      var newRows = [];
      newRows.push(['PROFILES', '', '', JSON.stringify(body.profiles)]);
      
      for (var profId in body.tasks) {
         var arr = body.tasks[profId];
         for (var k = 0; k < arr.length; k++) {
             newRows.push(['TASK', profId, arr[k].id, JSON.stringify(arr[k])]);
         }
      }
      
      if (newRows.length > 0) {
          sheet.getRange(2, 1, newRows.length, 4).setValues(newRows);
      }

      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({status: 'error'})).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Step 2: Deploy the API
1. In the Apps Script editor, click the blue **Deploy** button on the top right.
2. Select **New deployment**.
3. Under "Select type" (the gear icon), choose **Web app**.
4. *Important:* Under "Who has access", you **MUST** select **Anyone**.
5. Click **Deploy**. (Authorize permissions if prompted).
6. **Copy the "Web app URL"** provided at the end.

### Step 3: Connect TaskFlow
1. Open your TaskFlow web app.
2. Click the **Cloud Setup (☁️)** icon in the top right corner.
3. Paste the *Web app URL* you copied into the input field.
4. Click **Save & Sync**. 
5. Your app is now connected! Any changes made will automatically upload to your Google Sheet, and switching profiles will fetch the latest data.

---

## 🤝 Contributing
Feel free to fork this project, submit pull requests, or use the code as inspiration for your own organizational tools!
