/* =====================================================
   DATASCIENCE DIGITAL LIBRARY
   ===================================================== */


/* ================= STORAGE KEYS ================= */

const PROFILE_KEY = "ds_library_profile_v2";
const MODULE_KEY = "ds_library_modules_v2";
const MAIN_EXP_KEY = "ds_library_main_experiments_v2";
const SUB_EXP_KEY = "ds_library_sub_experiments_v2";


/* ================= DEFAULT PROFILE ================= */

const defaultProfile = {
    name: "M. Hemamalini",
    roll: "24102A030060",
    branch: "DS",
    faculty: "Bose Babu",
    photo: ""
};


/* ================= DATA ================= */

let profile = defaultProfile;
let modules = [];
let mainExperiments = [];
let subExperiments = [];

let selectedSubExperimentId = null;
let expandedMainExperimentId = null;
let selectedReadModuleIndex = null;
let selectedReadModulePdfUrl = null;
let pdfDocument = null;
let pdfRenderTask = null;
let pdfRenderVersion = 0;
let pdfCurrentPage = 1;
let pdfZoom = 1;
let pdfTurning = false;
let pdfResizeTimer = null;


/* ================= BASIC FUNCTIONS ================= */

const STORAGE_DB_NAME = "ds_library_storage";
const STORAGE_STORE_NAME = "items";
let storageDatabasePromise;

function openStorageDatabase() {
    if (!storageDatabasePromise) {
        storageDatabasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(STORAGE_DB_NAME, 1);

            request.onupgradeneeded = () => {
                request.result.createObjectStore(STORAGE_STORE_NAME, {
                    keyPath: "key"
                });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    return storageDatabasePromise;
}

async function readStoredData(key) {
    const database = await openStorageDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORAGE_STORE_NAME, "readonly");
        const request = transaction.objectStore(STORAGE_STORE_NAME).get(key);

        request.onsuccess = () => resolve(request.result?.value);
        request.onerror = () => reject(request.error);
    });
}

async function writeStoredData(key, data) {
    const database = await openStorageDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORAGE_STORE_NAME, "readwrite");
        transaction.objectStore(STORAGE_STORE_NAME).put({ key, value: data });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

async function loadData(key, defaultValue) {
    try {
        const data = await readStoredData(key);
        if (data !== undefined) {
            if (Array.isArray(data) && data.length === 0 && Array.isArray(defaultValue) && defaultValue.length > 0) {
                return defaultValue;
            }
            return data;
        }
    } catch (error) {
        console.error("Unable to read IndexedDB storage:", error);
    }

    try {
        const legacyData = localStorage.getItem(key);
        if (legacyData === null) {
            return defaultValue;
        }

        const data = JSON.parse(legacyData);
        if (Array.isArray(data) && data.length === 0 && Array.isArray(defaultValue) && defaultValue.length > 0) {
            return defaultValue;
        }
        try {
            await writeStoredData(key, data);
        } catch (error) {
            console.error("Unable to migrate browser storage data:", error);
        }

        return data;
    } catch (error) {
        console.error("Unable to read browser storage:", error);
        return defaultValue;
    }
}

async function saveData(key, data) {
    try {
        await writeStoredData(key, data);
        return true;
    } catch (error) {
        console.error("Unable to save to IndexedDB; trying browser storage:", error);

        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (fallbackError) {
            console.error("Unable to save to browser storage:", fallbackError);
            showToast("Unable to save changes. Browser storage is unavailable or full.");
            return false;
        }
    }
}

function createId() {
    return Date.now().toString() + Math.random()
        .toString(36)
        .substring(2, 8);
}


function escapeHTML(value) {

    if (value === undefined || value === null) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getModuleColor(color) {
    return typeof color === "string" && /^#[\da-f]{6}$/i.test(color)
        ? color
        : "#e8eef4";
}

function getModuleColorTint(color) {
    const hex = getModuleColor(color).slice(1);
    const channels = [0, 2, 4].map((offset) =>
        parseInt(hex.slice(offset, offset + 2), 16)
    );
    const tintedChannels = channels.map((channel) =>
        Math.round(channel * 0.14 + 255 * 0.86)
    );

    return `rgb(${tintedChannels.join(", ")})`;
}

function showPage(page) {
    document.querySelectorAll("[data-page-content]").forEach((content) => {
        content.hidden = content.dataset.pageContent !== page;
    });

    document.querySelectorAll(".page-nav-link").forEach((button) => {
        const isActive = button.dataset.page === page;
        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetLibrarySearch() {
    document.querySelectorAll(".module-card, .exp-item, .resource-card").forEach((item) => {
        item.hidden = false;
    });
}

function searchLibrary(event) {
    event.preventDefault();

    const input = document.getElementById("librarySearch");
    const query = input.value.trim().toLocaleLowerCase();
    resetLibrarySearch();

    if (!query) {
        showToast("Enter a search term.");
        return;
    }

    const items = Array.from(
        document.querySelectorAll(".module-card, .exp-item, .resource-card")
    );
    const matches = items.filter((item) =>
        item.textContent.toLocaleLowerCase().includes(query)
    );

    if (!matches.length) {
        const navMatch = Array.from(document.querySelectorAll(".page-nav-link"))
            .find((button) => button.textContent.trim().toLocaleLowerCase() === query);

        if (navMatch) {
            showPage(navMatch.dataset.page);
            return;
        }

        showToast(`No results found for "${input.value.trim()}".`);
        return;
    }

    const matchingItems = new Set(matches);
    items.forEach((item) => {
        item.hidden = !matchingItems.has(item);
    });

    const page = matches[0].closest("[data-page-content]");
    if (page) {
        showPage(page.dataset.pageContent);
    }
    showToast(`Found ${matches.length} result${matches.length === 1 ? "" : "s"}.`);
}


/* ================= TOAST ================= */

function showToast(message) {

    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.hidden = false;

    setTimeout(() => {
        toast.hidden = true;
    }, 2200);
}


/* =====================================================
   PROFILE
   ===================================================== */

function getDefaultAvatar() {

    return "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="150"
             height="150"
             viewBox="0 0 150 150">

            <rect width="150"
                  height="150"
                  fill="#dbeafe"/>

            <circle cx="75"
                    cy="55"
                    r="28"
                    fill="#93c5fd"/>

            <path d="M25 140
                     C30 105 50 90 75 90
                     C100 90 120 105 125 140Z"
                  fill="#60a5fa"/>

        </svg>
        `);
}


function renderProfile() {

    document.getElementById("profileName").textContent =
        profile.name || "";

    document.getElementById("profileRoll").textContent =
        profile.roll || "";

    document.getElementById("profileBranch").textContent =
        profile.branch || "";

    document.getElementById("profileFaculty").textContent =
        profile.faculty || "";

    const photo =
        profile.photo || getDefaultAvatar();

    document.getElementById("profilePhoto").src = photo;
    document.getElementById("profilePreview").src = photo;
}


/* ---------- Profile Modal ---------- */

function openProfileModal() {

    document.getElementById("editName").value =
        profile.name || "";

    document.getElementById("editRoll").value =
        profile.roll || "";

    document.getElementById("editBranch").value =
        profile.branch || "";

    document.getElementById("editFaculty").value =
        profile.faculty || "";

    document.getElementById("profilePreview").src =
        profile.photo || getDefaultAvatar();

    document.getElementById("profileModal").hidden = false;
}


function closeProfileModal() {
    document.getElementById("profileModal").hidden = true;
}


async function saveProfile() {

    const name =
        document.getElementById("editName").value.trim();

    const roll =
        document.getElementById("editRoll").value.trim();

    const branch =
        document.getElementById("editBranch").value.trim();

    const faculty =
        document.getElementById("editFaculty").value.trim();

    if (!name || !roll || !branch || !faculty) {

        showToast("Please fill all profile fields.");
        return;
    }

    profile.name = name;
    profile.roll = roll;
    profile.branch = branch;
    profile.faculty = faculty;

    if (!(await saveData(PROFILE_KEY, profile))) {
        return;
    }

    renderProfile();
    closeProfileModal();

    showToast("Profile updated successfully.");
}


/* ================= PROFILE PHOTO ================= */

function handleProfilePhoto(file) {

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {

        showToast("Please select an image file.");
        return;
    }

    const reader = new FileReader();

    reader.onload = async function(event) {

        profile.photo = event.target.result;

        if (!(await saveData(PROFILE_KEY, profile))) {
            return;
        }

        renderProfile();

        document.getElementById("profilePreview").src =
            profile.photo;

        showToast("ID photo updated.");
    };

    reader.readAsDataURL(file);
}


document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("librarySearch");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            if (!searchInput.value.trim()) {
                resetLibrarySearch();
            }
        });
    }

    const photoInput = document.getElementById("profilePhotoInput");
    if (photoInput) {
        photoInput.addEventListener("change", function () {
            handleProfilePhoto(this.files[0]);
        });
    }

    const photoInputModal = document.getElementById("profilePhotoInputModal");
    if (photoInputModal) {
        photoInputModal.addEventListener("change", function () {
            handleProfilePhoto(this.files[0]);
        });
    }

});


/* =====================================================
   MODULES
   ===================================================== */

function openAddModuleModal() {

    document.getElementById("moduleModalTitle").textContent =
        "Add Module";

    document.getElementById("moduleEditIndex").value = "";

    document.getElementById("moduleTitle").value = "";
    document.getElementById("moduleDescription").value = "";
    document.getElementById("moduleTopics").value = "";
    document.getElementById("moduleColor").value = "#e8eef4";

    document.getElementById("modulePdf").value = "";

    document.getElementById("modulePdfName").textContent =
        "";

    document.getElementById("moduleModal").hidden = false;
}


function openEditModuleModal(index) {

    const module = modules[index];

    if (!module) {
        return;
    }

    document.getElementById("moduleModalTitle").textContent =
        "Edit Module";

    document.getElementById("moduleEditIndex").value =
        index;

    document.getElementById("moduleTitle").value =
        module.title || "";

    document.getElementById("moduleDescription").value =
        module.description || "";

    document.getElementById("moduleTopics").value =
        module.topics || "";

    document.getElementById("moduleColor").value =
        getModuleColor(module.color);

    document.getElementById("modulePdf").value = "";

    document.getElementById("modulePdfName").textContent =
        module.pdfName
            ? "Current PDF: " + module.pdfName
            : "No PDF selected";

    document.getElementById("moduleModal").hidden = false;
}


function closeModuleModal() {
    document.getElementById("moduleModal").hidden = true;
}


/* ---------- Read PDF ---------- */

function readFileAsDataURL(file) {

    return new Promise((resolve, reject) => {

        if (!file) {
            resolve(null);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.onerror = () =>
            reject(reader.error);

        reader.readAsDataURL(file);
    });
}


/* ---------- Save Module ---------- */

/* ---------- Save Module ---------- */

async function saveModule() {

    const titleInput = document.getElementById("moduleTitle");
    const descInput = document.getElementById("moduleDescription");
    const topicsInput = document.getElementById("moduleTopics");
    const colorInput = document.getElementById("moduleColor");
    const editIndexInput = document.getElementById("moduleEditIndex");
    const pdfInput = document.getElementById("modulePdf");

    if (!titleInput || !descInput || !topicsInput || !colorInput || !editIndexInput) {
        showToast("Form elements missing.");
        return;
    }

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const topics = topicsInput.value;
    const color = colorInput.value;
    const editIndex = editIndexInput.value;

    if (!title) {
        showToast("Please enter module title.");
        return;
    }

    if (!description) {
        showToast("Please enter module description.");
        return;
    }

    if (topics === "") {
        showToast("Please enter number of topics.");
        return;
    }

    let pdfData = null;
    let pdfName = "";

    if (pdfInput && pdfInput.files && pdfInput.files.length > 0) {
        try {
            pdfData = await readFileAsDataURL(pdfInput.files[0]);
            pdfName = pdfInput.files[0].name;
        } catch (e) {
            console.error("PDF read error:", e);
            showToast("Unable to read the selected PDF.");
            return;
        }
    }

    const moduleData = {
        title,
        description,
        topics: Number(topics),
        color,
        pdf: pdfData,
        pdfName
    };

    /* EDIT */
    if (editIndex !== "") {
        const index = Number(editIndex);

        if (!moduleData.pdf) {
            moduleData.pdf = modules[index].pdf || "";
            moduleData.pdfName = modules[index].pdfName || "";
        }

        modules[index] = {
            ...modules[index],
            ...moduleData
        };

    }
    /* ADD */
    else {
        modules.push({
            id: createId(),
            ...moduleData
        });

    }

    if (!(await saveData(MODULE_KEY, modules))) {
        return;
    }

    showToast(editIndex !== ""
        ? "Module updated successfully."
        : "Module added successfully.");
    renderModules();
    closeModuleModal();
}

/* ---------- Render Modules ---------- */

function renderModules() {

    const list =
        document.getElementById("moduleList");

    const empty =
        document.getElementById("moduleEmpty");

    if (!list) return;

    list.innerHTML = "";

    if (modules.length === 0) {
        if (empty) empty.hidden = false;
        return;
    }

    if (empty) empty.hidden = true;

    modules.forEach((module, index) => {

        const card =
            document.createElement("div");

        card.className = "module-card";
        card.style.setProperty("--module-color", getModuleColor(module.color));
        card.style.setProperty("--module-tint", getModuleColorTint(module.color));

        card.innerHTML = `

            <div class="module-number">
                MODULE ${index + 1}
            </div>

            <h3>${escapeHTML(module.title)}</h3>

            <p>
                ${escapeHTML(module.description)}
            </p>

            <div class="module-topics">
                📚 ${module.topics} Topics
            </div>

            <div class="module-actions">

                <button class="read-btn"
                        onclick="openReadModuleModal(${index})">
                    View Module
                </button>

            </div>
        `;

        list.appendChild(card);
    });
}


/* ---------- Read Module ---------- */

function openReadModuleModal(index) {
    const module = modules[index];

    if (!module) {
        return;
    }

    closeReadModuleModal();
    selectedReadModuleIndex = index;
    document.getElementById("readModuleModal").classList.remove("pdf-viewer-full-width");
    document.getElementById("readModuleModal").classList.add("module-pdf-only");

    document.getElementById("readModuleTitle").textContent =
        module.title;
    document.getElementById("readModuleSubtitle").textContent =
        "Module details";

    document.getElementById("readModuleDescription")
        .textContent =
        module.description;

    document.getElementById("readModuleTopics")
        .textContent =
        module.topics + " Topics";

    document.getElementById("readModuleDescriptionBox").hidden = false;
    document.getElementById("readModuleTopicsBox").hidden = false;
    document.getElementById("readModuleInfo").hidden = false;
    const readModEditBtn = document.getElementById("readModuleEditButton");
    if (readModEditBtn) readModEditBtn.hidden = true;
    document.getElementById("readModulePdfBox").innerHTML =
        createPdfViewerMarkup();

    document.getElementById("readModuleModal").hidden =
        false;

    initializePdfViewer();

    if (module.pdf) {
        loadPdfDataUrl(module.pdf, module.pdfName || "Module Document");
    } else {
        updatePdfViewer();
    }
}

function openPdfFlipbook() {
    closeReadModuleModal();
    selectedReadModuleIndex = null;
    document.getElementById("readModuleModal").classList.remove("module-pdf-only");
    document.getElementById("readModuleModal").classList.add("pdf-viewer-full-width");

    document.getElementById("readModuleTitle").textContent =
        "PDF Flipbook";
    document.getElementById("readModuleSubtitle").textContent =
        "Upload and read your own PDF";
    document.getElementById("readModuleDescriptionBox").hidden = true;
    document.getElementById("readModuleTopicsBox").hidden = true;
    document.getElementById("readModuleInfo").hidden = true;
    const rmeb1 = document.getElementById("readModuleEditButton");
    if (rmeb1) rmeb1.hidden = true;
    document.getElementById("readModulePdfBox").innerHTML =
        createPdfViewerMarkup();
    document.getElementById("readModuleModal").hidden = false;

    initializePdfViewer();
    updatePdfViewer();
}

function openSubExperimentPdf(index) {
    const sub = subExperiments[index];
    if (!sub || !sub.pdf) {
        showToast("This sub experiment has no PDF attached.");
        return;
    }

    closeReadModuleModal();
    selectedReadModuleIndex = null;
    document.getElementById("readModuleModal").classList.remove("module-pdf-only");
    document.getElementById("readModuleModal").classList.add("pdf-viewer-full-width");
    document.getElementById("readModuleTitle").textContent =
        sub.title + " PDF";
    document.getElementById("readModuleSubtitle").textContent =
        "Sub experiment document";
    document.getElementById("readModuleDescriptionBox").hidden = true;
    document.getElementById("readModuleTopicsBox").hidden = true;
    document.getElementById("readModuleInfo").hidden = true;
    const rmeb1 = document.getElementById("readModuleEditButton");
    if (rmeb1) rmeb1.hidden = true;
    document.getElementById("readModulePdfBox").innerHTML =
        createPdfViewerMarkup();
    document.getElementById("readModuleModal").hidden = false;

    initializePdfViewer();
    loadPdfDataUrl(sub.pdf, sub.pdfName || "Experiment Document");
}

function createPdfViewerMarkup() {
    return `
        <h4>PDF Flipbook</h4>
        <div class="pdf-viewer-box">
            <span class="pdf-file-icon" aria-hidden="true">📄</span>
            <div class="pdf-file-info">
                <strong id="pdfViewerName">No PDF loaded</strong>
                <small>Use the controls to turn pages, change zoom, or upload a PDF.</small>
            </div>
        </div>
        <div class="flipbook-toolbar" aria-label="PDF flipbook controls">
            <button id="pdfPreviousButton" type="button" onclick="turnPdfPage(-1)" disabled>← Previous</button>
            <span id="pdfPageCount" class="flipbook-page-count" aria-live="polite">0 / 0</span>
            <button id="pdfNextButton" type="button" onclick="turnPdfPage(1)" disabled>Next →</button>
            <button id="pdfZoomOutButton" type="button" onclick="zoomPdf(-1)" disabled aria-label="Zoom out">−</button>
            <button id="pdfZoomInButton" type="button" onclick="zoomPdf(1)" disabled aria-label="Zoom in">+</button>
            <label class="flipbook-upload-label">
                Upload PDF
                <input id="customPdfInput" type="file" accept="application/pdf,.pdf">
            </label>
            <span id="pdfViewerFileName" class="flipbook-file-name">Choose a PDF to get started.</span>
        </div>
        <div id="pdfStage" class="flipbook-stage">
            <div id="flipbookPage" class="flipbook-page" hidden>
                <canvas id="pdfCanvas" aria-label="PDF page"></canvas>
            </div>
            <p id="pdfEmpty" class="flipbook-empty">Upload a PDF to view it as a flipbook.</p>
        </div>
        <div id="pdfViewerActions" class="flipbook-actions" hidden>
            <a id="pdfOpenLink" class="primary-btn pdf-open-btn" target="_blank" rel="noopener noreferrer">Open PDF in new tab</a>
            <a id="pdfDownloadLink" class="secondary-btn pdf-open-btn">Download</a>
        </div>
    `;
}

function initializePdfViewer() {
    const fileInput = document.getElementById("customPdfInput");
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            showToast("Please select a PDF file.");
            fileInput.value = "";
            return;
        }

        try {
            await loadPdfDocument(await file.arrayBuffer(), file.name);
        } catch (error) {
            console.error("PDF load error:", error);
            showToast("Unable to load this PDF.");
            document.getElementById("pdfViewerFileName").textContent =
                "Unable to load " + file.name;
        }
    });
}

async function loadPdfDataUrl(dataUrl, fileName) {
    try {
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error("Unable to read saved PDF.");
        }
        await loadPdfDocument(await response.arrayBuffer(), fileName);
    } catch (error) {
        console.error("PDF load error:", error);
        showToast("Unable to load this PDF. You can upload another PDF to view.");
        updatePdfViewer();
    }
}

async function loadPdfDocument(data, fileName) {
    if (!window.pdfjsLib) {
        throw new Error("PDF.js did not load.");
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const loadedDocument = await window.pdfjsLib.getDocument({
        data: new Uint8Array(data)
    }).promise;

    if (pdfRenderTask) {
        pdfRenderTask.cancel();
        pdfRenderTask = null;
    }
    pdfRenderVersion++;
    if (pdfDocument) {
        await pdfDocument.destroy();
    }
    if (selectedReadModulePdfUrl) {
        URL.revokeObjectURL(selectedReadModulePdfUrl);
    }

    pdfDocument = loadedDocument;
    pdfCurrentPage = 1;
    pdfZoom = 1;
    pdfTurning = false;
    selectedReadModulePdfUrl = URL.createObjectURL(
        new Blob([data], { type: "application/pdf" })
    );

    document.getElementById("pdfViewerName").textContent = fileName;
    document.getElementById("pdfViewerFileName").textContent = fileName;
    document.getElementById("pdfViewerActions").hidden = false;
    document.getElementById("pdfOpenLink").href = selectedReadModulePdfUrl;
    document.getElementById("pdfDownloadLink").href = selectedReadModulePdfUrl;
    document.getElementById("pdfDownloadLink").download = fileName;

    updatePdfViewer();
    await renderPdfPage();
}

function updatePdfViewer() {
    const hasPdf = Boolean(pdfDocument);
    const empty = document.getElementById("pdfEmpty");
    const page = document.getElementById("flipbookPage");
    const count = document.getElementById("pdfPageCount");

    if (!empty || !page || !count) return;

    empty.hidden = hasPdf;
    page.hidden = !hasPdf;
    count.textContent = hasPdf
        ? `${pdfCurrentPage} / ${pdfDocument.numPages}`
        : "0 / 0";

    document.getElementById("pdfPreviousButton").disabled =
        !hasPdf || pdfCurrentPage <= 1 || pdfTurning;
    document.getElementById("pdfNextButton").disabled =
        !hasPdf || pdfCurrentPage >= pdfDocument.numPages || pdfTurning;
    document.getElementById("pdfZoomOutButton").disabled =
        !hasPdf || pdfZoom <= 0.5;
    document.getElementById("pdfZoomInButton").disabled =
        !hasPdf || pdfZoom >= 2.5;
}

async function renderPdfPage() {
    if (!pdfDocument) return;

    const renderVersion = ++pdfRenderVersion;
    const activeDocument = pdfDocument;
    const previousRenderTask = pdfRenderTask;
    if (previousRenderTask) {
        previousRenderTask.cancel();
        try {
            await previousRenderTask.promise;
        } catch (error) {
            if (error.name !== "RenderingCancelledException") throw error;
        }
        if (pdfRenderTask === previousRenderTask) {
            pdfRenderTask = null;
        }
    }

    if (renderVersion !== pdfRenderVersion || activeDocument !== pdfDocument) return;

    const page = await activeDocument.getPage(pdfCurrentPage);
    if (renderVersion !== pdfRenderVersion || activeDocument !== pdfDocument) return;

    const stage = document.getElementById("pdfStage");
    const canvas = document.getElementById("pdfCanvas");
    const context = canvas.getContext("2d");
    const availableWidth = Math.max(160, stage.clientWidth - 36);
    const baseViewport = page.getViewport({ scale: 1 });
    const modal = document.getElementById("readModuleModal");
    const fitToScreen = modal.classList.contains("module-pdf-only") ||
        modal.classList.contains("pdf-viewer-full-width");
    const availableHeight = Math.max(160, stage.clientHeight - 36);
    const fitScale = Math.min(
        1.35,
        availableWidth / baseViewport.width,
        fitToScreen ? availableHeight / baseViewport.height : 1.35
    );
    const viewport = page.getViewport({ scale: fitScale * pdfZoom });
    const outputScale = Math.min(3, Math.max(window.devicePixelRatio || 1, 2));

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

    const task = page.render({ canvasContext: context, viewport });
    pdfRenderTask = task;
    try {
        await task.promise;
    } catch (error) {
        if (error.name !== "RenderingCancelledException") throw error;
    } finally {
        if (pdfRenderTask === task) {
            pdfRenderTask = null;
        }
    }
    updatePdfViewer();
}

function turnPdfPage(direction) {
    if (!pdfDocument || pdfTurning) return;

    const nextPage = pdfCurrentPage + direction;
    if (nextPage < 1 || nextPage > pdfDocument.numPages) return;

    const page = document.getElementById("flipbookPage");
    pdfTurning = true;
    updatePdfViewer();
    page.classList.add(direction > 0 ? "turn-next" : "turn-previous");
    page.addEventListener("animationend", async () => {
        page.classList.remove("turn-next", "turn-previous");
        pdfCurrentPage = nextPage;
        pdfTurning = false;
        updatePdfViewer();
        try {
            await renderPdfPage();
        } catch (error) {
            console.error("PDF page render error:", error);
            showToast("Unable to render this PDF page.");
        }
    }, { once: true });
}

function zoomPdf(direction) {
    if (!pdfDocument) return;

    pdfZoom = Math.min(2.5, Math.max(0.5, pdfZoom + direction * 0.2));
    updatePdfViewer();
    renderPdfPage().catch((error) => {
        console.error("PDF zoom render error:", error);
        showToast("Unable to zoom this PDF page.");
    });
}

window.addEventListener("resize", () => {
    if (!pdfDocument || document.getElementById("readModuleModal").hidden) return;

    clearTimeout(pdfResizeTimer);
    pdfResizeTimer = setTimeout(() => {
        renderPdfPage().catch((error) => {
            console.error("PDF resize render error:", error);
            showToast("Unable to resize this PDF page.");
        });
    }, 120);
});

function closeReadModuleModal() {
    document.getElementById("readModuleModal").hidden = true;
    selectedReadModuleIndex = null;
    if (selectedReadModulePdfUrl) {
        URL.revokeObjectURL(selectedReadModulePdfUrl);
        selectedReadModulePdfUrl = null;
    }
    if (pdfDocument) {
        pdfDocument.destroy().catch((error) => {
            console.error("PDF cleanup error:", error);
        });
        pdfDocument = null;
    }
    pdfRenderVersion++;
    if (pdfRenderTask) {
        pdfRenderTask.cancel();
        pdfRenderTask = null;
    }
    pdfTurning = false;
}

function editReadModule() {
    if (selectedReadModuleIndex === null) {
        return;
    }

    const index = selectedReadModuleIndex;
    closeReadModuleModal();
    openEditModuleModal(index);
}

/* ---------- Delete Module ---------- */

async function deleteModule(index) {

    if (!confirm("Delete this module?")) {
        return;
    }

    modules.splice(index, 1);

    if (!(await saveData(MODULE_KEY, modules))) {
        return;
    }

    renderModules();

    showToast("Module deleted.");
}


/* =====================================================
   MAIN EXPERIMENTS
   ===================================================== */

function openMainExperimentModal(index = null) {

    document.getElementById("mainExperimentModal")
        .hidden = false;

    document.getElementById("mainExperimentEditIndex")
        .value =
        index === null ? "" : index;


    if (index === null) {

        document.getElementById(
            "mainExperimentModalTitle"
        ).textContent =
            "Add Main Experiment";

        document.getElementById(
            "mainExperimentTitle"
        ).value = "";

        document.getElementById(
            "mainExperimentDescription"
        ).value = "";

    } else {

        const exp = mainExperiments[index];

        document.getElementById(
            "mainExperimentModalTitle"
        ).textContent =
            "Edit Main Experiment";

        document.getElementById(
            "mainExperimentTitle"
        ).value =
            exp.title;

        document.getElementById(
            "mainExperimentDescription"
        ).value =
            exp.description;
    }
}


function closeMainExperimentModal() {

    document.getElementById(
        "mainExperimentModal"
    ).hidden = true;
}


async function saveMainExperiment() {

    const title =
        document.getElementById(
            "mainExperimentTitle"
        ).value.trim();

    const description =
        document.getElementById(
            "mainExperimentDescription"
        ).value.trim();

    const editIndex =
        document.getElementById(
            "mainExperimentEditIndex"
        ).value;


    if (!title) {

        showToast("Enter experiment title.");
        return;
    }


    if (editIndex !== "") {

        const index = Number(editIndex);

        mainExperiments[index].title = title;

        mainExperiments[index].description =
            description;

    } else {

        mainExperiments.push({
            id: createId(),
            title,
            description
        });

    }

    if (!(await saveData(
        MAIN_EXP_KEY,
        mainExperiments
    ))) {
        return;
    }

    showToast(editIndex !== "" ? "Experiment updated." : "Main experiment added.");
    renderExperiments();

    closeMainExperimentModal();
}

async function handleMainExperimentPhoto(experimentId, file) {
    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        showToast("Please select an image file.");
        return;
    }

    const experiment = mainExperiments.find(exp => exp.id === experimentId);
    if (!experiment) {
        showToast("Unable to find this main experiment.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
        if (typeof reader.result !== "string") {
            showToast("Unable to read the selected image.");
            return;
        }

        const previousPhoto = experiment.photo;
        experiment.photo = reader.result;

        if (!(await saveData(MAIN_EXP_KEY, mainExperiments))) {
            experiment.photo = previousPhoto;
            return;
        }

        renderMainExperiments();
        showToast("Experiment photo updated.");
    };
    reader.onerror = () => {
        showToast("Unable to read the selected image.");
    };
    reader.readAsDataURL(file);
}


/* ---------- Render Main Experiments ---------- */

function getSubExperimentSerial(index) {
    const sub = subExperiments[index];
    const mainIndex = mainExperiments.findIndex(
        exp => exp.id === sub.mainExperimentId
    );
    const subIndex = subExperiments
        .slice(0, index + 1)
        .filter(item => item.mainExperimentId === sub.mainExperimentId)
        .length - 1;

    return `${mainIndex === -1 ? "?" : mainIndex + 1}.${subIndex + 1}`;
}

function renderMainExperiments() {

    const list =
        document.getElementById("mainExpList");

    const count =
        document.getElementById("mainExpCount");

    if (!list) return;

    list.innerHTML = "";

    if (
        expandedMainExperimentId &&
        !mainExperiments.some(exp => exp.id === expandedMainExperimentId)
    ) {
        expandedMainExperimentId = null;
    }

    if (count) {
        count.textContent = mainExperiments.length;
    }

    const addMainButton = document.getElementById("addMainExperimentButton");
    const addSubButton = document.getElementById("addSubExperimentButton");
    if (addMainButton) addMainButton.hidden = Boolean(expandedMainExperimentId);
    if (addSubButton) addSubButton.hidden = !expandedMainExperimentId;

    if (expandedMainExperimentId) {
        const backButton = document.createElement("button");
        backButton.type = "button";
        backButton.className = "main-exp-back";
        backButton.textContent = "← All main experiments";
        backButton.addEventListener("click", () => {
            expandedMainExperimentId = null;
            selectedSubExperimentId = null;
            renderExperiments();
            renderCodePanel();
        });
        list.appendChild(backButton);
        list.classList.add("focused-main-experiment");
    } else {
        list.classList.remove("focused-main-experiment");
    }


    if (mainExperiments.length === 0) {

        list.innerHTML = `
            <div class="empty-message experiment-empty">
                No experiments added.
            </div>
        `;

        return;
    }


    const visibleExperiments = expandedMainExperimentId
        ? mainExperiments.filter(exp => exp.id === expandedMainExperimentId)
        : mainExperiments;

    visibleExperiments.forEach(exp => {
        const index = mainExperiments.indexOf(exp);
        const subItems = subExperiments
            .map((sub, subIndex) => ({ sub, subIndex }))
            .filter(({ sub }) => sub.mainExperimentId === exp.id);
        const isExpanded = expandedMainExperimentId === exp.id;
        const item = document.createElement("article");
        item.className = "main-exp-card" + (isExpanded ? " expanded" : "");

        const picture = document.createElement("div");
        picture.className = "main-exp-picture";
        if (exp.photo) {
            const image = document.createElement("img");
            image.src = exp.photo;
            image.alt = `${exp.title} photo`;
            picture.appendChild(image);
        } else {
            picture.innerHTML = `
                <svg viewBox="0 0 64 64" focusable="false">
                    <rect x="10" y="10" width="44" height="44" rx="10"></rect>
                    <path d="M20 42V32M30 42V23M40 42V28M50 42V18"></path>
                </svg>
            `;
        }

        const details = document.createElement("div");
        details.className = "main-exp-details";
        details.innerHTML = `
            <span class="main-exp-number">Experiment ${index + 1}</span>
            <span class="main-exp-title">${escapeHTML(exp.title)}</span>
            <span class="main-exp-sub-count">${subItems.length}
                ${subItems.length === 1 ? "sub experiment" : "sub experiments"}
            </span>
        `;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "main-exp-toggle";
        toggle.setAttribute("aria-expanded", String(isExpanded));
        toggle.setAttribute("aria-label", `${isExpanded ? "Collapse" : "Open"} experiment ${index + 1}`);
        toggle.append(details);
        toggle.addEventListener("click", () => {
            expandedMainExperimentId = isExpanded ? null : exp.id;
            selectedSubExperimentId = null;
            renderMainExperiments();
            renderCodePanel();
        });

        const head = document.createElement("div");
        head.className = "main-exp-card-head";
        head.append(picture, toggle);
        item.appendChild(head);

        if (exp.description) {
            const description = document.createElement("p");
            description.className = "main-exp-description";
            description.textContent = exp.description;
            item.appendChild(description);
        }

        const nested = document.createElement("div");
        nested.className = "nested-sub-experiments";
        nested.hidden = !isExpanded;

        if (subItems.length === 0) {
            const empty = document.createElement("p");
            empty.className = "nested-sub-empty";
            empty.textContent = "No sub experiments yet.";
            nested.appendChild(empty);
        } else {
            subItems.forEach(({ sub, subIndex }) => {
                const row = document.createElement("div");
                row.className = "nested-sub-row" +
                    (selectedSubExperimentId === sub.id ? " active" : "");

                const select = document.createElement("button");
                select.type = "button";
                select.className = "nested-sub-select";
                select.addEventListener("click", () => {
                    selectedSubExperimentId = sub.id;
                    expandedMainExperimentId = exp.id;
                    renderExperiments();
                    renderCodePanel();
                });

                if (Array.isArray(sub.outputImages) && sub.outputImages.length > 0) {
                    const thumbnail = document.createElement("img");
                    const source = sub.outputImages[0];
                    thumbnail.src = source.startsWith("data:image/")
                        ? source
                        : `data:image/png;base64,${source}`;
                    thumbnail.alt = "";
                    thumbnail.className = "nested-sub-picture";
                    select.appendChild(thumbnail);
                } else {
                    const thumbnail = document.createElement("span");
                    thumbnail.className = "nested-sub-picture nested-sub-picture-placeholder";
                    thumbnail.setAttribute("aria-hidden", "true");
                    select.appendChild(thumbnail);
                }

                const subDetails = document.createElement("span");
                subDetails.className = "nested-sub-details";
                subDetails.innerHTML = `
                    <span class="nested-sub-title">
                        ${getSubExperimentSerial(subIndex)}. ${escapeHTML(sub.title)}
                    </span>
                    <span class="nested-sub-meta">${sub.pdf ? "PDF attached" : "Code and output"}</span>
                `;
                select.appendChild(subDetails);
                row.appendChild(select);
                nested.appendChild(row);
            });
        }

        item.appendChild(nested);
        list.appendChild(item);
    });
}


async function deleteMainExperiment(index) {

    if (!confirm(
        "Delete this main experiment and its sub experiments?"
    )) {
        return;
    }

    const mainId =
        mainExperiments[index].id;

    mainExperiments.splice(index, 1);

    subExperiments =
        subExperiments.filter(
            sub => sub.mainExperimentId !== mainId
        );
    if (expandedMainExperimentId === mainId) {
        expandedMainExperimentId = null;
    }

    const mainSaved = await saveData(
        MAIN_EXP_KEY,
        mainExperiments
    );

    const subSaved = await saveData(
        SUB_EXP_KEY,
        subExperiments
    );

    if (!mainSaved || !subSaved) {
        return;
    }

    selectedSubExperimentId = null;

    renderExperiments();

    renderCodePanel();

    showToast("Experiment deleted.");
}


/* =====================================================
   SUB EXPERIMENTS
   ===================================================== */

function openSubExperimentModal(
    editIndex = null
) {

    if (mainExperiments.length === 0) {

        showToast(
            "First add a Main Experiment."
        );

        return;
    }


    const select =
        document.getElementById(
            "subExperimentMain"
        );

    if (select) {
        select.innerHTML = "";

        mainExperiments.forEach(exp => {

            const option =
                document.createElement("option");

            option.value = exp.id;
            option.textContent = exp.title;

            select.appendChild(option);
        });
    }


    const modal = document.getElementById("subExperimentModal");
    if (modal) modal.hidden = false;


    const editInput = document.getElementById("subExperimentEditIndex");
    if (editInput) {
        editInput.value = editIndex === null ? "" : editIndex;
    }


    if (editIndex === null) {
        if (select && expandedMainExperimentId) {
            select.value = expandedMainExperimentId;
        }

        document.getElementById(
            "subExperimentModalTitle"
        ).textContent =
            "Add Sub Experiment";

        document.getElementById(
            "subExperimentTitle"
        ).value = "";

        document.getElementById(
            "subExperimentCode"
        ).value = "";

        document.getElementById(
            "subExperimentOutput"
        ).value = "";

        document.getElementById(
            "subExperimentPdf"
        ).value = "";

        document.getElementById(
            "subExperimentPdfName"
        ).textContent = "";

    } else {

        const sub =
            subExperiments[editIndex];

        if (sub) {
            document.getElementById(
                "subExperimentModalTitle"
            ).textContent =
                "Edit Sub Experiment";

            if (select) select.value = sub.mainExperimentId;

            document.getElementById(
                "subExperimentTitle"
            ).value =
                sub.title;

            document.getElementById(
                "subExperimentCode"
            ).value =
                sub.code || "";

            document.getElementById(
                "subExperimentOutput"
            ).value =
                sub.output || "";

            document.getElementById(
                "subExperimentPdfName"
            ).textContent =
                sub.pdfName
                    ? "Current PDF: " + sub.pdfName
                    : "";
        }
    }
}


function closeSubExperimentModal() {

    const modal = document.getElementById("subExperimentModal");
    if (modal) modal.hidden = true;
}


/* ---------- Save Sub Experiment ---------- */

async function saveSubExperiment() {

    const mainId =
        document.getElementById(
            "subExperimentMain"
        ).value;

    const title =
        document.getElementById(
            "subExperimentTitle"
        ).value.trim();

    const code =
        document.getElementById(
            "subExperimentCode"
        ).value;

    const output =
        document.getElementById(
            "subExperimentOutput"
        ).value;

    const editIndex =
        document.getElementById(
            "subExperimentEditIndex"
        ).value;

    const pdfInput =
        document.getElementById(
            "subExperimentPdf"
        );


    if (!mainId) {

        showToast(
            "Select a main experiment."
        );

        return;
    }


    if (!title) {

        showToast(
            "Enter sub experiment title."
        );

        return;
    }


    let pdf = null;
    let pdfName = "";


    if (pdfInput && pdfInput.files && pdfInput.files.length > 0) {

        try {
            pdf = await readFileAsDataURL(pdfInput.files[0]);
            pdfName = pdfInput.files[0].name;
        } catch (e) {
            console.error(e);
        }
    }


    const subData = {
        mainExperimentId: mainId,
        title,
        code,
        output,
        pdf,
        pdfName
    };


    if (editIndex !== "") {

        const index =
            Number(editIndex);

        if (!subData.pdf) {

            subData.pdf =
                subExperiments[index].pdf || "";

            subData.pdfName =
                subExperiments[index].pdfName || "";
        }

        subExperiments[index] = {
            ...subExperiments[index],
            ...subData
        };

        selectedSubExperimentId =
            subExperiments[index].id;

    } else {

        const newSub = {
            id: createId(),
            ...subData
        };

        subExperiments.push(newSub);

        selectedSubExperimentId =
            newSub.id;

    }


    if (!(await saveData(
        SUB_EXP_KEY,
        subExperiments
    ))) {
        return;
    }

    expandedMainExperimentId = mainId;
    showToast(editIndex !== ""
        ? "Sub experiment updated."
        : "Sub experiment added.");
    renderExperiments();

    renderCodePanel();

    closeSubExperimentModal();
}


/* ---------- Delete Sub Experiment ---------- */

async function deleteSubExperiment(index) {

    if (!confirm(
        "Delete this sub experiment?"
    )) {
        return;
    }

    const deletedId =
        subExperiments[index].id;

    subExperiments.splice(index, 1);

    if (
        selectedSubExperimentId ===
        deletedId
    ) {

        selectedSubExperimentId =
            null;
    }

    if (!(await saveData(
        SUB_EXP_KEY,
        subExperiments
    ))) {
        return;
    }

    renderExperiments();

    renderCodePanel();

    showToast(
        "Sub experiment deleted."
    );
}


/* ---------- Edit Selected Sub ---------- */

function editSelectedSubExperiment() {

    if (!selectedSubExperimentId) {

        showToast(
            "Select a sub experiment first."
        );

        return;
    }

    const index =
        subExperiments.findIndex(
            sub =>
                sub.id ===
                selectedSubExperimentId
        );


    if (index === -1) {
        return;
    }

    openSubExperimentModal(index);
}


/* =====================================================
   CODE PANEL
   ===================================================== */

function renderCodePanel() {
    const panel = document.querySelector(".experiments-section .code-panel");
    const layout = document.querySelector(".experiments-section .experiment-layout");

    const title =
        document.getElementById(
            "selectedExperimentTitle"
        );

    const code =
        document.getElementById(
            "codeEditor"
        );

    const output =
        document.getElementById(
            "outputViewer"
        );

    const editBtn =
        document.getElementById(
            "editSubBtn"
        );

    const pdfArea =
        document.getElementById(
            "selectedPdfArea"
        );

    const selectedSub = subExperiments.find(
        item =>
            item.id === selectedSubExperimentId &&
            item.mainExperimentId === expandedMainExperimentId
    );

    clearHtmlPreview();

    if (panel) panel.hidden = !selectedSub;
    if (layout) {
        layout.classList.toggle(
            "has-selected-sub-experiment",
            Boolean(selectedSub)
        );
    }

    const sub = selectedSub;


    if (!sub) {

        if (title) title.textContent = "Select a Sub Experiment";
        if (code) code.value = "";
        if (output) output.replaceChildren();
        if (editBtn) editBtn.disabled = true;
        if (pdfArea) pdfArea.innerHTML = "";

        return;
    }


    if (title) {
        const subIndex = subExperiments.indexOf(sub);
        title.textContent = `${getSubExperimentSerial(subIndex)}. ${sub.title}`;
    }
    if (code) {
        code.value = sub.code || "";
        code.readOnly = true;
    }
    if (output) renderPythonOutput(output, sub.output || "", sub.outputImages || []);
    if (editBtn) editBtn.disabled = true;


    if (pdfArea) {
        if (sub.pdf) {

            pdfArea.innerHTML = `
                <a href="#"
                   onclick="event.preventDefault();
                   openSubExperimentPdf(${subExperiments.indexOf(sub)})">
                   📄 ${escapeHTML(
                       sub.pdfName || "Open PDF"
                   )}
                </a>
            `;

        } else {

            pdfArea.innerHTML = "";
        }
    }
}

function renderPythonOutput(outputViewer, text, images = []) {
    clearHtmlPreview();
    outputViewer.classList.remove("html-output");
    outputViewer.replaceChildren();

    if (text) {
        const textOutput = document.createElement("pre");
        textOutput.className = "output-text";
        textOutput.textContent = text;
        outputViewer.appendChild(textOutput);
    }

    if (Array.isArray(images)) {
        images.forEach((image, index) => {
            const imageElement = document.createElement("img");
            imageElement.src = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
            imageElement.alt = `Python plot ${index + 1}`;
            outputViewer.appendChild(imageElement);
        });
    }
}


/* ---------- Code Tab ---------- */

let htmlPreviewUrl = null;

function clearHtmlPreview() {
    if (htmlPreviewUrl) {
        URL.revokeObjectURL(htmlPreviewUrl);
        htmlPreviewUrl = null;
    }
}

function renderHtmlPreview(outputViewer, html) {
    clearHtmlPreview();
    outputViewer.replaceChildren();
    outputViewer.classList.add("html-output");

    const htmlFile = new Blob([html], { type: "text/html" });
    htmlPreviewUrl = URL.createObjectURL(htmlFile);

    const preview = document.createElement("iframe");
    preview.className = "html-preview";
    preview.title = "HTML experiment preview";
    preview.setAttribute("sandbox", "allow-scripts allow-forms");
    preview.src = htmlPreviewUrl;
    outputViewer.appendChild(preview);
}

function showCodeTab() {

    const cEditor = document.getElementById("codeEditor");
    const oViewer = document.getElementById("outputViewer");
    const cTabBtn = document.getElementById("codeTabButton");
    const oTabBtn = document.getElementById("outputTabButton");

    if (cEditor) cEditor.hidden = false;
    if (oViewer) oViewer.hidden = true;
    if (cTabBtn) cTabBtn.classList.add("active");
    if (oTabBtn) oTabBtn.classList.remove("active");
}


function showOutputTab() {

    const cEditor = document.getElementById("codeEditor");
    const oViewer = document.getElementById("outputViewer");
    const cTabBtn = document.getElementById("codeTabButton");
    const oTabBtn = document.getElementById("outputTabButton");

    if (cEditor) cEditor.hidden = true;
    if (oViewer) oViewer.hidden = false;
    if (cTabBtn) cTabBtn.classList.remove("active");
    if (oTabBtn) oTabBtn.classList.add("active");
}


/* ---------- Copy Code ---------- */

async function copyCode() {

    const code =
        document.getElementById(
            "codeEditor"
        ).value;

    if (!code) {

        showToast(
            "No code to copy."
        );

        return;
    }


    try {

        await navigator.clipboard.writeText(
            code
        );

        showToast(
            "Code copied."
        );

    } catch {

        showToast(
            "Copy failed."
        );
    }
}


/* ---------- Run Python or HTML ---------- */

// Global variable to cache Pyodide instance and loaded packages
let pyodideInstance = null;
let pyodideLoadedPackages = new Set();

async function runCode() {
    if (!selectedSubExperimentId) {
        showToast("Select a sub experiment first.");
        return;
    }

    const code = document.getElementById("codeEditor").value;

    if (!code.trim()) {
        showToast("There is no code to run.");
        return;
    }

    const outputViewer = document.getElementById("outputViewer");
    if (/^\s*</.test(code)) {
        try {
            renderHtmlPreview(outputViewer, code);
            showOutputTab();
            showToast("HTML experiment opened.");
        } catch (error) {
            renderPythonOutput(
                outputViewer,
                "HTML preview error:\n" + error.message
            );
            showOutputTab();
            showToast("HTML preview failed.");
        }
        return;
    }

    renderPythonOutput(outputViewer, "Loading Python environment and plotting support... Please wait...");
    showOutputTab();

    try {
        // Initialize Pyodide once
        if (!pyodideInstance) {
            outputViewer.textContent = "Initializing Pyodide (WebAssembly)...";
            pyodideInstance = await loadPyodide();
            pyodideLoadedPackages = new Set();
        }

        // Determine needed standard Pyodide packages
        const standardPackagesToLoad = [];
        if (!pyodideLoadedPackages.has("pandas")) standardPackagesToLoad.push("pandas");
        if (!pyodideLoadedPackages.has("matplotlib")) standardPackagesToLoad.push("matplotlib");
        if (!pyodideLoadedPackages.has("micropip")) standardPackagesToLoad.push("micropip");

        if (/sklearn|scikit-learn/i.test(code) && !pyodideLoadedPackages.has("scikit-learn")) {
            standardPackagesToLoad.push("scikit-learn");
        }
        if (/bs4|BeautifulSoup/i.test(code) && !pyodideLoadedPackages.has("beautifulsoup4")) {
            standardPackagesToLoad.push("beautifulsoup4");
        }

        if (standardPackagesToLoad.length > 0) {
            renderPythonOutput(outputViewer, `Loading packages (${standardPackagesToLoad.join(", ")})... Please wait...`);
            await pyodideInstance.loadPackage(standardPackagesToLoad);
            standardPackagesToLoad.forEach(p => pyodideLoadedPackages.add(p));
        }

        // Determine needed micropip packages
        const micropipPackagesToInstall = [];
        if (/seaborn|sns\./i.test(code) && !pyodideLoadedPackages.has("seaborn")) {
            micropipPackagesToInstall.push("seaborn");
        }
        if (/wordcloud|WordCloud/i.test(code) && !pyodideLoadedPackages.has("wordcloud")) {
            micropipPackagesToInstall.push("wordcloud");
        }
        if (/vaderSentiment/i.test(code) && !pyodideLoadedPackages.has("vaderSentiment")) {
            micropipPackagesToInstall.push("vaderSentiment");
        }
        if (/nltk/i.test(code) && !pyodideLoadedPackages.has("nltk")) {
            micropipPackagesToInstall.push("nltk");
        }

        if (micropipPackagesToInstall.length > 0) {
            renderPythonOutput(outputViewer, `Installing packages (${micropipPackagesToInstall.join(", ")})... Please wait...`);
            const micropip = pyodideInstance.pyimport("micropip");
            await micropip.install(micropipPackagesToInstall);
            micropipPackagesToInstall.forEach(p => pyodideLoadedPackages.add(p));
        }

        renderPythonOutput(outputViewer, "Executing Python code...");

        // Setup Virtual Filesystem, mocked NLTK data & Custom Figure Capturing
        pyodideInstance.runPython(`
import sys
import io
import json
import base64
import os
import zipfile
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

__file__ = "experiment.py"

_captured_images = []
def _custom_show(*args, **kwargs):
    for _fig in plt.get_fignums():
        _buf = io.BytesIO()
        plt.figure(_fig).savefig(_buf, format="png", bbox_inches="tight")
        _captured_images.append(base64.b64encode(_buf.getvalue()).decode("ascii"))
    plt.close("all")

plt.show = _custom_show

# 1. Setup reviews.html
if not os.path.exists("reviews.html"):
    with open("reviews.html", "w", encoding="utf-8") as f:
        f.write('''<!DOCTYPE html><html><body>
<div class="review"><div class="review-title">Great product</div><div class="review-text">Excellent quality and performance.</div><div class="rating">5 out of 5</div></div>
<div class="review"><div class="review-title">Not satisfied</div><div class="review-text">The product is terrible and disappointing.</div><div class="rating">2 out of 5</div></div>
<div class="review"><div class="review-title">Worth buying</div><div class="review-text">Good performance and useful features.</div><div class="rating">4 out of 5</div></div>
</body></html>''')

# 2. Setup product_reviews.csv
if not os.path.exists("product_reviews.csv"):
    with open("product_reviews.csv", "w", encoding="utf-8") as f:
        f.write("title,review,rating\\nGreat product,Excellent quality and performance.,5 out of 5\\nNot satisfied,The product is terrible and disappointing.,2 out of 5\\nWorth buying,Good performance and useful features.,4 out of 5\\n")

# 3. Setup sentiment_analysis_results.csv
if not os.path.exists("sentiment_analysis_results.csv"):
    with open("sentiment_analysis_results.csv", "w", encoding="utf-8") as f:
        f.write("review,nltk_compound,nltk_sentiment,vader_compound,vader_sentiment\\nExcellent quality and performance.,0.8225,Positive,0.8225,Positive\\nThe product is terrible and disappointing.,-0.7579,Negative,-0.7579,Negative\\nGood performance and useful features.,0.6908,Positive,0.6908,Positive\\n")

# 4. Setup marketing_campaign.csv
if not os.path.exists("marketing_campaign.csv"):
    import numpy as np
    import pandas as pd
    np.random.seed(42)
    n = 100
    df_m = pd.DataFrame({
        "Income": np.random.normal(55000, 15000, n).clip(15000, 120000).round(2),
        "MntWines": np.random.exponential(250, n).clip(5, 1500).round(2),
        "MntFruits": np.random.exponential(30, n).clip(1, 200).round(2),
        "MntMeatProducts": np.random.exponential(180, n).clip(5, 1000).round(2),
        "MntFishProducts": np.random.exponential(40, n).clip(1, 250).round(2),
        "MntSweetProducts": np.random.exponential(30, n).clip(1, 250).round(2),
        "MntGoldProds": np.random.exponential(50, n).clip(2, 300).round(2)
    })
    df_m.to_csv("marketing_campaign.csv", sep="\\t", index=False)

# 5. Setup NLTK data & mock download if nltk is loaded
if "nltk" in sys.modules:
    import nltk
    def _mock_download(*args, **kwargs):
        return True
    nltk.download = _mock_download

    nltk_stopwords_dir = Path("/home/pyodide/nltk_data/corpora/stopwords")
    nltk_stopwords_dir.mkdir(parents=True, exist_ok=True)
    nltk_stopwords_file = nltk_stopwords_dir / "english"
    if not nltk_stopwords_file.exists():
        _sw = "\\n".join(["i", "me", "my", "myself", "we", "our", "ours", "you", "your", "he", "him", "his", "she", "her", "it", "its", "they", "them", "what", "which", "who", "this", "that", "am", "is", "are", "was", "were", "be", "have", "has", "had", "do", "does", "did", "a", "an", "the", "and", "but", "if", "or", "because", "as", "of", "at", "by", "for", "with", "about", "to", "from", "in", "out", "on", "off", "then", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "should", "now"])
        nltk_stopwords_file.write_text(_sw, encoding="utf-8")

if "vaderSentiment" in sys.modules:
    import vaderSentiment
    vader_src = Path(vaderSentiment.__file__).parent / "vader_lexicon.txt"
    vader_zip_path = Path("/home/pyodide/nltk_data/sentiment/vader_lexicon.zip")
    vader_zip_path.parent.mkdir(parents=True, exist_ok=True)
    if not vader_zip_path.exists() and vader_src.exists():
        with zipfile.ZipFile(vader_zip_path, "w") as zf:
            zf.writestr("vader_lexicon/vader_lexicon.txt", vader_src.read_text(encoding="utf-8"))

sys.stdout = io.StringIO()
_captured_images = []
plt.close("all")
        `);

        await pyodideInstance.runPythonAsync(code);

        const result = JSON.parse(pyodideInstance.runPython(`
for _figure_number in plt.get_fignums():
    _buffer = io.BytesIO()
    plt.figure(_figure_number).savefig(_buffer, format="png", bbox_inches="tight")
    _captured_images.append(base64.b64encode(_buffer.getvalue()).decode("ascii"))
plt.close("all")

json.dumps({
    "text": sys.stdout.getvalue(),
    "images": _captured_images
})
        `));

        let output = result.text;
        const outputImages = result.images;

        if (!output.trim() && outputImages.length === 0) {
            output = "Python code executed successfully.\n";
        }

        renderPythonOutput(outputViewer, output, outputImages);

        const index = subExperiments.findIndex(item => item.id === selectedSubExperimentId);
        if (index !== -1) {
            subExperiments[index].output = output;
            subExperiments[index].outputImages = outputImages;
            if (!(await saveData(SUB_EXP_KEY, subExperiments))) {
                showToast("Python ran, but its output could not be saved.");
                return;
            }
        }

        showToast("Python code executed.");

    } catch (error) {
        const errorMsg = "Execution Error:\n" + error.message;
        renderPythonOutput(outputViewer, errorMsg);
        showToast("Python execution failed.");
    }
}

/* =====================================================
   GENERAL RENDER
   ===================================================== */

function renderExperiments() {

    renderMainExperiments();
}


/* =====================================================
   MODAL BACKGROUND CLOSE
   ===================================================== */

document.addEventListener(
    "click",
    function (event) {

        if (event.target.classList.contains("modal")) {
            if (event.target.id === "readModuleModal") {
                closeReadModuleModal();
            } else {
                event.target.hidden = true;
            }
        }
    }
);


/* =====================================================
   FILE NAME DISPLAY
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const modulePdf =
            document.getElementById(
                "modulePdf"
            );

        if (modulePdf) {
            modulePdf.addEventListener(
                "change",
                function () {
                    const modulePdfName = document.getElementById("modulePdfName");
                    if (modulePdfName) {
                        modulePdfName.textContent =
                            this.files.length
                                ? this.files[0].name
                                : "";
                    }
                }
            );
        }


        const subPdf =
            document.getElementById(
                "subExperimentPdf"
            );

        if (subPdf) {
            subPdf.addEventListener(
                "change",
                function () {
                    const subExperimentPdfName = document.getElementById("subExperimentPdfName");
                    if (subExperimentPdfName) {
                        subExperimentPdfName.textContent =
                            this.files.length
                                ? this.files[0].name
                                : "";
                    }
                }
            );
        }

    }
);


/* =====================================================
   INITIALIZATION
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        document.body.inert = true;
        document.body.setAttribute("aria-busy", "true");

        const initial = window.INITIAL_DATA || {};

        try {
            if (initial && initial.mainExperiments && initial.mainExperiments.length > 0) {
                profile = initial.profile || defaultProfile;
                modules = initial.modules || [];
                mainExperiments = initial.mainExperiments || [];
                subExperiments = initial.subExperiments || [];
                try {
                    await Promise.all([
                        saveData(PROFILE_KEY, profile),
                        saveData(MODULE_KEY, modules),
                        saveData(MAIN_EXP_KEY, mainExperiments),
                        saveData(SUB_EXP_KEY, subExperiments)
                    ]);
                } catch (storageError) {
                    console.warn("Storage sync:", storageError);
                }
            } else {
                [profile, modules, mainExperiments, subExperiments] = await Promise.all([
                    loadData(PROFILE_KEY, initial.profile || defaultProfile),
                    loadData(MODULE_KEY, initial.modules || []),
                    loadData(MAIN_EXP_KEY, initial.mainExperiments || []),
                    loadData(SUB_EXP_KEY, initial.subExperiments || [])
                ]);
            }
        } finally {
            document.body.inert = false;
            document.body.removeAttribute("aria-busy");

            renderProfile();
            renderModules();
            renderExperiments();
            renderCodePanel();
            showCodeTab();
        }
    }
);