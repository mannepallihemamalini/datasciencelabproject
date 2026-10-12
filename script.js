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
    const homePage = document.getElementById("homePage");
    const toolsPage = document.getElementById("toolsPage");
    const isToolsPage = page === "tools";

    homePage.hidden = isToolsPage;
    toolsPage.hidden = !isToolsPage;

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
                    View
                </button>

                <button class="edit-btn"
                        onclick="openEditModuleModal(${index})">
                    Edit
                </button>

                <button class="delete-btn"
                        onclick="deleteModule(${index})">
                    Delete
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
    document.getElementById("readModuleEditButton").hidden = false;
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

    document.getElementById("readModuleTitle").textContent =
        "PDF Flipbook";
    document.getElementById("readModuleSubtitle").textContent =
        "Upload and read your own PDF";
    document.getElementById("readModuleDescriptionBox").hidden = true;
    document.getElementById("readModuleTopicsBox").hidden = true;
    document.getElementById("readModuleEditButton").hidden = true;
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
    document.getElementById("readModuleTitle").textContent =
        sub.title + " PDF";
    document.getElementById("readModuleSubtitle").textContent =
        "Sub experiment document";
    document.getElementById("readModuleDescriptionBox").hidden = true;
    document.getElementById("readModuleTopicsBox").hidden = true;
    document.getElementById("readModuleEditButton").hidden = true;
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
    const fitScale = Math.min(1.35, availableWidth / page.getViewport({ scale: 1 }).width);
    const viewport = page.getViewport({ scale: fitScale * pdfZoom });
    const outputScale = window.devicePixelRatio || 1;

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


/* ---------- Render Main Experiments ---------- */

function toAlphabeticLabel(index) {
    let label = "";
    let value = index + 1;

    while (value > 0) {
        value -= 1;
        label = String.fromCharCode(97 + (value % 26)) + label;
        value = Math.floor(value / 26);
    }

    return label;
}

function getSubExperimentSerial(index) {
    const sub = subExperiments[index];
    const mainIndex = mainExperiments.findIndex(
        exp => exp.id === sub.mainExperimentId
    );
    const subIndex = subExperiments
        .slice(0, index + 1)
        .filter(item => item.mainExperimentId === sub.mainExperimentId)
        .length - 1;

    return `${mainIndex === -1 ? "?" : mainIndex + 1}${toAlphabeticLabel(subIndex)}`;
}

function renderMainExperiments() {

    const list =
        document.getElementById("mainExpList");

    const count =
        document.getElementById("mainExpCount");

    if (!list) return;

    list.innerHTML = "";

    if (count) {
        count.textContent = mainExperiments.length;
    }


    if (mainExperiments.length === 0) {

        list.innerHTML = `
            <div class="empty-message">
                No experiments added.
            </div>
        `;

        return;
    }


    mainExperiments.forEach((exp, index) => {

        const item =
            document.createElement("div");

        item.className = "exp-item";

        item.innerHTML = `

            <div class="exp-item-title">
                ${index + 1}. ${escapeHTML(exp.title)}
            </div>

            <div class="exp-item-desc">
                ${escapeHTML(exp.description || "")}
            </div>

            <div class="item-actions">

                <button
                    class="edit-btn"
                    onclick="event.stopPropagation();
                    openMainExperimentModal(${index})">
                    Edit
                </button>

                <button
                    class="delete-btn"
                    onclick="event.stopPropagation();
                    deleteMainExperiment(${index})">
                    Delete
                </button>

            </div>
        `;

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

    showToast(editIndex !== ""
        ? "Sub experiment updated."
        : "Sub experiment added.");
    renderExperiments();

    renderCodePanel();

    closeSubExperimentModal();
}


/* ---------- Render Sub Experiments ---------- */

function renderSubExperiments() {

    const list =
        document.getElementById("subExpList");

    const count =
        document.getElementById("subExpCount");

    if (!list) return;

    list.innerHTML = "";

    if (count) {
        count.textContent = subExperiments.length;
    }


    if (subExperiments.length === 0) {

        list.innerHTML = `
            <div class="empty-message">
                No sub experiments.
            </div>
        `;

        return;
    }


    subExperiments.forEach((sub, index) => {

        const parent =
            mainExperiments.find(
                exp =>
                    exp.id === sub.mainExperimentId
            );


        const item =
            document.createElement("div");

        item.className =
            "exp-item" +
            (
                selectedSubExperimentId === sub.id
                    ? " active"
                    : ""
            );


        item.onclick = () => {

            selectedSubExperimentId =
                sub.id;

            renderExperiments();

            renderCodePanel();
        };


        item.innerHTML = `

            <div class="exp-item-title">
                ${getSubExperimentSerial(index)}. ${escapeHTML(sub.title)}
            </div>

            <div class="exp-item-desc">
                ${escapeHTML(
                    parent
                        ? `Main Experiment ${mainExperiments.indexOf(parent) + 1}: ${parent.title}`
                        : "Unknown Experiment"
                )}
            </div>

            <div class="item-actions">

                <button
                    class="edit-btn"
                    onclick="event.stopPropagation();
                    openSubExperimentModal(${index})">
                    Edit
                </button>

                <button
                    class="delete-btn"
                    onclick="event.stopPropagation();
                    deleteSubExperiment(${index})">
                    Delete
                </button>

            </div>
        `;

        list.appendChild(item);
    });
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


    const sub =
        subExperiments.find(
            item =>
                item.id ===
                selectedSubExperimentId
        );


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
    if (code) code.value = sub.code || "";
    if (output) renderPythonOutput(output, sub.output || "", sub.outputImages || []);
    if (editBtn) editBtn.disabled = false;


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
    outputViewer.replaceChildren();

    if (text) {
        const textOutput = document.createElement("pre");
        textOutput.className = "output-text";
        textOutput.textContent = text;
        outputViewer.appendChild(textOutput);
    }

    images.forEach((image, index) => {
        const imageElement = document.createElement("img");
        imageElement.src = `data:image/png;base64,${image}`;
        imageElement.alt = `Python plot ${index + 1}`;
        outputViewer.appendChild(imageElement);
    });
}


/* ---------- Code Tab ---------- */

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


/* ---------- Run Python ---------- */

// Global variable to cache Pyodide instance
let pyodideInstance = null;

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
    renderPythonOutput(outputViewer, "Loading Python environment and plotting support... Please wait...");
    showOutputTab();

    try {
        // Initialize Pyodide once
        if (!pyodideInstance) {
            outputViewer.textContent = "Initializing Pyodide (WebAssembly)...";
            pyodideInstance = await loadPyodide();
            
            renderPythonOutput(outputViewer, "Loading Pandas and Matplotlib packages...");
            await pyodideInstance.loadPackage(["micropip", "matplotlib"]);
            const micropip = pyodideInstance.pyimport("micropip");
            await micropip.install("pandas");
        }

        pyodideInstance.runPython(`
            import sys
            import io
            import json
            import base64
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            sys.stdout = io.StringIO()
        `);

        await pyodideInstance.runPythonAsync(code);

        const result = JSON.parse(pyodideInstance.runPython(`
            _captured_images = []
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
    renderSubExperiments();
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

        try {
            [profile, modules, mainExperiments, subExperiments] = await Promise.all([
                loadData(PROFILE_KEY, defaultProfile),
                loadData(MODULE_KEY, []),
                loadData(MAIN_EXP_KEY, []),
                loadData(SUB_EXP_KEY, [])
            ]);
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