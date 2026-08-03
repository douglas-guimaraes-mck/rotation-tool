// ─── State ──────────────────────────────────────────────────────────────────
var currentContext = null; // 'alpha' | 'beta' | 'all' | 'support'

// ─── History (URL Hash Storage) ─────────────────────────────────────────────
// History is serialised into the page URL hash so any team member who opens
// the same link gets the same rotation state — no server or database needed.

function _encodeHistory(history) {
    var json = JSON.stringify(history);
    var bytes = new TextEncoder().encode(json);
    var binary = Array.from(bytes, function (b) { return String.fromCharCode(b); }).join('');
    return btoa(binary);
}

function _decodeHistory(encoded) {
    var binary = atob(encoded);
    var bytes = Uint8Array.from(binary, function (c) { return c.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes));
}

function loadHistory() {
    try {
        var hash = window.location.hash;
        if (hash && hash.startsWith('#data=')) {
            return _decodeHistory(hash.slice(6));
        }
    } catch (e) { /* corrupt hash — start fresh */ }
    return { alpha: [], beta: [], all: [], supportAlpha: [], supportBeta: [] };
}

function saveHistory(history) {
    var scrollY = window.scrollY;
    window.location.hash = 'data=' + _encodeHistory(history);
    window.scrollTo(0, scrollY);
}

function addToHistory(context, name) {
    if (!context) return;
    var history = loadHistory();
    if (!history[context]) history[context] = [];
    if (history[context].indexOf(name) === -1) {
        history[context].push(name);
        saveHistory(history);
    }
}

function resetContextHistory(context) {
    if (!context) return;
    var history = loadHistory();
    history[context] = [];
    saveHistory(history);
}

function updateHistoryDisplay() {
    var label = document.getElementById('historyContextLabel');
    var historyList = document.getElementById('historyList');
    var selectedDisplay = document.getElementById('selectedDisplay');
    var clearBtn = document.getElementById('clearHistoryBtn');

    var contextLabels = { alpha: 'Alpha', beta: 'Beta', all: 'All', support: 'Support Champion' };
    label.textContent = currentContext ? (contextLabels[currentContext] || currentContext) : '\u2014';

    var buttons = getAllButtons();
    var selected = [];
    buttons.forEach(function (item) {
        if ($(item).hasClass('btn-primary')) selected.push(escapeHtml($(item).text()));
    });
    selectedDisplay.innerHTML = selected.length > 0
        ? selected.map(function (n) { return '<span class="badge bg-primary me-1">' + n + '</span>'; }).join('')
        : '<span class="text-muted">none</span>';

    if (!currentContext) {
        historyList.innerHTML = '<span class="text-muted">&mdash;</span>';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }

    if (clearBtn) clearBtn.style.display = '';

    var history = loadHistory();
    if (currentContext === 'support') {
        var aH = history.supportAlpha || [];
        var bH = history.supportBeta || [];
        historyList.innerHTML =
            '<span class="text-muted me-1">Alpha:</span>'
            + (aH.length > 0 ? aH.map(function (n) { return '<span class="badge bg-secondary me-1">' + escapeHtml(n) + '</span>'; }).join('') : '<span class="text-muted me-2">none yet</span>')
            + ' <span class="text-muted me-1">Beta:</span>'
            + (bH.length > 0 ? bH.map(function (n) { return '<span class="badge bg-secondary me-1">' + escapeHtml(n) + '</span>'; }).join('') : '<span class="text-muted">none yet</span>');
    } else {
        var contextHistory = history[currentContext] || [];
        historyList.innerHTML = contextHistory.length > 0
            ? contextHistory.map(function (n) { return '<span class="badge bg-secondary me-1">' + escapeHtml(n) + '</span>'; }).join('')
            : '<span class="text-muted">none yet</span>';
    }
}

function clearCurrentHistory() {
    if (!currentContext) return;
    if (currentContext === 'support') {
        resetContextHistory('supportAlpha');
        resetContextHistory('supportBeta');
    } else {
        resetContextHistory(currentContext);
    }
    updateHistoryDisplay();
}

function copyShareLink() {
    var url = window.location.href;
    var msg = { title: 'Link copied!', html: 'Share this URL with your team to keep everyone in sync.', icon: 'info', timer: 2500, showConfirmButton: false };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { Swal.fire(msg); });
    } else {
        var input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        Swal.fire(msg);
    }
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Load Page ───────────────────────────────────────────────────────────────
function init() {
    let facilitatorsList = [
        { Name: "Alex", Role: "tl", Team: "all" },
        { Name: "Stephan", Role: "tl", Team: "all" },
        { Name: "Jo&atilde;o", Role: "dev", Team: "beta" },
        { Name: "JD", Role: "dev", Team: "beta" },
        { Name: "Adam", Role: "pm", Team: "beta" },
        { Name: "Zhipeng", Role: "dev", Team: "alpha" },
        { Name: "Douglas", Role: "dev", Team: "alpha" },
        { Name: "Bruno", Role: "dev", Team: "alpha" },
        { Name: "Pavel", Role: "pm", Team: "alpha" },
        { Name: "Luis", Role: "dev", Team: "alpha" },
        { Name: "Louren&ccedil;o", Role: "dev", Team: "beta" },
        { Name: "Vencel", Role: "pm", Team: "alpha" },
    ];

    facilitatorsList.sort(SortByName);

    let facilitatorsDiv = document.getElementById("facilitatorsList");
    facilitatorsList.forEach((item, index) => {

        //input checkbox
        let button = document.createElement('button');
        $(button).css("width", 100);
        $(button).css("margin-bottom", 20);
        $(button).css("cursor", "pointer");
        $(button).addClass("btn btn-primary");
        $(button).html(item.Name);
        $(button).prop("role", item.Role);
        $(button).prop("team", item.Team);
        $(button).click(btnFacilitatorButtonClick);

        //div
        let div = document.createElement('div');
        $(div).addClass("col col-md-3");
        div.appendChild(button);

        // final div
        facilitatorsDiv.appendChild(div);

    });

    updateHistoryDisplay();
}

function getSupportChampions() {
    var buttons = getAllButtons();
    var allAlphaDevs = [];
    var allBetaDevs  = [];
    var alphaPool    = [];
    var betaPool     = [];

    buttons.forEach(function (item) {
        var role = $(item).prop('role');
        var team = $(item).prop('team');
        var name = $(item).text();
        if (role && (role.toLowerCase() === 'dev' || role.toLowerCase() === 'pm')) {
            if (team && team.toLowerCase() === 'alpha') {
                allAlphaDevs.push(name);
                if ($(item).hasClass('btn-primary')) alphaPool.push(name);
            } else if (team && team.toLowerCase() === 'beta') {
                allBetaDevs.push(name);
                if ($(item).hasClass('btn-primary')) betaPool.push(name);
            }
        }
    });

    if (allAlphaDevs.length === 0 && allBetaDevs.length === 0) {
        unloadSpinner();
        Swal.fire("It's cold here... :(", "Is anyone there?", 'question');
        return;
    }

    var alphaReset = false, betaReset = false;

    // When the enabled pool for a squad is empty but the squad has devs,
    // the cycle is exhausted — fall back to the full squad list and start fresh.
    if (alphaPool.length === 0 && allAlphaDevs.length > 0) {
        alphaReset = true;
        resetContextHistory('supportAlpha');
        alphaPool = allAlphaDevs.slice();
    }
    if (betaPool.length === 0 && allBetaDevs.length > 0) {
        betaReset = true;
        resetContextHistory('supportBeta');
        betaPool = allBetaDevs.slice();
    }

    // Re-read history after potential resets above
    var history = loadHistory();

    var eligibleAlpha = alphaPool.filter(function (n) { return (history.supportAlpha || []).indexOf(n) === -1; });
    var eligibleBeta  = betaPool.filter(function (n)  { return (history.supportBeta  || []).indexOf(n) === -1; });

    // Secondary reset: pool has members but all are already in history
    if (!alphaReset && eligibleAlpha.length === 0 && alphaPool.length > 0) {
        alphaReset = true;
        resetContextHistory('supportAlpha');
        eligibleAlpha = alphaPool.slice();
    }
    if (!betaReset && eligibleBeta.length === 0 && betaPool.length > 0) {
        betaReset = true;
        resetContextHistory('supportBeta');
        eligibleBeta = betaPool.slice();
    }

    var resultParts = [];
    var resetNotes  = [];

    if (eligibleAlpha.length > 0) {
        var alphaChamp = eligibleAlpha[Math.floor(Math.random() * eligibleAlpha.length)];
        addToHistory('supportAlpha', alphaChamp);
        disableButtonByName(alphaChamp);
        resultParts.push('<b>Alpha:</b> ' + escapeHtml(alphaChamp));
        if (alphaReset) resetNotes.push('Alpha cycle was reset.');
    }

    if (eligibleBeta.length > 0) {
        var betaChamp = eligibleBeta[Math.floor(Math.random() * eligibleBeta.length)];
        addToHistory('supportBeta', betaChamp);
        disableButtonByName(betaChamp);
        resultParts.push('<b>Beta:</b> ' + escapeHtml(betaChamp));
        if (betaReset) resetNotes.push('Beta cycle was reset.');
    }

    if (resultParts.length === 0) {
        unloadSpinner();
        Swal.fire("It's cold here... :(", "Is anyone there?", 'question');
        return;
    }

    refreshContext();

    var message = resultParts.join('<br>');
    if (resetNotes.length > 0) {
        message += '<br><br><small class="text-muted">' + resetNotes.join(' ') + '</small>';
    }

    Swal.fire({ title: 'Support Champions!', html: message, icon: 'success', confirmButtonText: 'Cool!' });
    unloadSpinner();
}

// Main Functionality: define facilitator based on the configuration
// Called in the btnDefineFacilitator click event
function getFacilitator() {
    if (currentContext === 'support') {
        getSupportChampions();
        return;
    }

    let buttons = getAllButtons();
    let facilitatorsArray = [];

    buttons.forEach((item) => {
        if ($(item).hasClass("btn-primary"))
            facilitatorsArray.push($(item).text());
    });

    if (facilitatorsArray.length === 0) {
        unloadSpinner();
        Swal.fire("It's cold here... :(", "Is anyone there?", 'question');
        return;
    }

    // Exclude members already picked in this context's rotation cycle
    var history = loadHistory();
    var contextHistory = currentContext ? (history[currentContext] || []) : [];
    var eligible = facilitatorsArray.filter(function (name) {
        return contextHistory.indexOf(name) === -1;
    });

    var cycleReset = false;
    if (eligible.length === 0) {
        // Everyone in the pool has been picked — reset and start a new cycle
        cycleReset = true;
        resetContextHistory(currentContext);
        eligible = facilitatorsArray.slice();
    }

    var randomIndex = Math.floor(Math.random() * eligible.length);
    var facilitator = eligible[randomIndex];

    addToHistory(currentContext, facilitator);
    disableButtonByName(facilitator);
    refreshContext();

    var title = 'Congratulations, ' + facilitator + '!';
    var message = 'You are the chosen one!';

    if (cycleReset && currentContext) {
        message += '<br><br><small class="text-muted">Everyone in the pool had been picked — history was reset for a new cycle.</small>';
    }

    Swal.fire({ title: title, html: message, icon: 'success', confirmButtonText: 'Cool!' });
    unloadSpinner();
}

// Events / Clicks

function refreshContext() {
    if (currentContext === 'alpha')        btnAlpha_Click();
    else if (currentContext === 'beta')   btnBeta_Click();
    else if (currentContext === 'all')    btnAll_Click();
    else if (currentContext === 'support') btnSupportChampion_Click();
    else updateHistoryDisplay();
}

function setActiveContext(context, buttonId) {
    currentContext = context;
    ['btnAlpha', 'btnBeta', 'btnAll', 'btnSupportChampion'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active-context');
    });
    if (buttonId) {
        var active = document.getElementById(buttonId);
        if (active) active.classList.add('active-context');
    }
}

function btnAll_Click() {
    setActiveContext('all', 'btnAll');
    var alreadyPicked = loadHistory().all || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        if (alreadyPicked.indexOf($(item).text()) === -1) {
            enabledButton(item);
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnSupportChampion_Click() {
    setActiveContext('support', 'btnSupportChampion');
    var history = loadHistory();
    var alphaHistory = history.supportAlpha || [];
    var betaHistory  = history.supportBeta  || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var role = $(item).prop("role");
        if (role.toLowerCase() === "dev") {
            var team = $(item).prop("team");
            var picked = (team && team.toLowerCase() === 'alpha') ? alphaHistory : betaHistory;
            if (picked.indexOf($(item).text()) === -1) {
                enabledButton(item);
            } else {
                disabledButton(item);
            }
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnOnlyDevs_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var role = $(item).prop("role");
        if (role.toLowerCase() == "dev") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnOnlyNonDevs_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        let role = $(item).prop("role");
        if (role.toLowerCase() != "dev") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnAlpha_Click() {
    setActiveContext('alpha', 'btnAlpha');
    var alreadyPicked = loadHistory().alpha || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        let team = $(item).prop("team");
        if (team.toLowerCase() == "alpha") {
            if (alreadyPicked.indexOf($(item).text()) === -1) {
                enabledButton(item);
            } else {
                disabledButton(item);
            }
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnBeta_Click() {
    setActiveContext('beta', 'btnBeta');
    var alreadyPicked = loadHistory().beta || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var team = $(item).prop("team");
        if (team.toLowerCase() == "beta") {
            if (alreadyPicked.indexOf($(item).text()) === -1) {
                enabledButton(item);
            } else {
                disabledButton(item);
            }
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnFacilitatorButtonClick() {
    let isEnabled = $(this).hasClass("btn-primary");

    if (isEnabled) {
        disabledButton(this);
    }
    else {
        enabledButton(this);
    }
    updateHistoryDisplay();
}

function btnDefineFacilitator_Click() {

    loadSpinner();

    window.setTimeout(getFacilitator, 500);


}

// Sort Array
function SortByName(a, b) {
    let aName = a.Name.toLowerCase();
    let bName = b.Name.toLowerCase();
    return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

// Get All Buttons
function getAllButtons() {
    let buttons = document
        .getElementById("facilitatorsList")
        .querySelectorAll('button');
    return buttons;
}

// Spinner Functions
function loadSpinner() {
    document.getElementById("btnDefineFacilitator").setAttribute("disabled", true);
    document.getElementById("spinner").style.display = "inline-flex";
}

function unloadSpinner() {
    document.getElementById("btnDefineFacilitator").removeAttribute("disabled");
    document.getElementById("spinner").style.display = "none";
}

function enabledButton(button) {
    $(button).removeClass("btn-default");
    $(button).addClass("btn-primary");
    $(button).css("cursor", "pointer");
}

function disabledButton(button) {
    $(button).removeClass("btn-primary");
    $(button).addClass("btn-default");
    $(button).css("cursor", "not-allowed");
}

function disableButtonByName(name) {
    getAllButtons().forEach(function (item) {
        if ($(item).text() === name) disabledButton(item);
    });
}



