# _NovExtractor_ 

**NovExtractor** is a lightweight, clean, and efficient Chrome extension designed for web novel readers. It allows you to extract chapter content cleanly from web novel platforms and export them instantly into **Markdown (.md)**, **EPUB**, or **PDF** format.

---

## ✨ Features

* ** Clean Floating Widget:** Injects a subtle, beautifully styled menu button directly into your reading pages without cluttering the screen.
* ** Markdown Export (`.md`):** Instantly extracts the chapter title and paragraphs into a clean Markdown text file for note-taking apps or personal archiving.
* ** EPUB Export:** Packages the extracted chapter into a structured HTML/EPUB structure.
* ** PDF Export:** Opens a clean print-optimized preview layout with shortcut instructions to effortlessly save your chapters as a physical PDF.
* ** Custom Theme:** Styled with a sleek deep blue interface (`#014bb9`) matching a modern aesthetic.

---

## 🛠️ Installation & Setup (For Local / GitHub Use)

Since this extension is loaded locally, you can easily install it on Chrome in less than a minute:

1. Download or clone this repository to your computer.
2. Unzip the folder if you downloaded it as a `.zip`.
3. Open Google Chrome and type `chrome://extensions/` in the address bar.
4. Enable **Developer mode** using the toggle switch in the top-right corner.
5. Click the **Load unpacked** button in the top-left corner.
6. Select your unzipped **NovExtractor** folder. 
7. Open any web novel chapter page, and the **NovExtractor** button will appear in the bottom-right corner!

---

## 🚀 How to Use

1. Navigate to your favorite web novel chapter.
2. Click the **📥 NovExtractor ▼** floating button in the bottom right corner.
3. Choose your preferred export format from the dropdown menu:
   * **Download .md:** Downloads an immediate Markdown text file.
   * **Save as PDF:** Opens a clean distraction-free print layout with an on-screen guide banner:
     * If the print dialog box doesn't pop up automatically, press **Ctrl + P** (Windows) or **Cmd + P** (Mac).
     * Change your Destination to **"Save as PDF"** and click **Save**.
   * **Download EPUB:** Packages and downloads the EPUB file format instantly.

---

## 📂 Project Structure

```text
NovExtractor/
├── manifest.json   # Chrome extension configuration manifest
└── content.js      # Core extraction logic and UI layout controller
