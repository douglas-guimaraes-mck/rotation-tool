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
    return { alpha: [], beta: [], all: [], support: [] };
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
    var section = document.getElementById('historySection');
    var label = document.getElementById('historyContextLabel');
    var list = document.getElementById('historyList');

    if (!currentContext) {
        section.style.display = 'none';
        return;
    }

    var history = loadHistory();
    var contextHistory = history[currentContext] || [];
    var labels = { alpha: 'Alpha', beta: 'Beta', all: 'All', support: 'Support Champion' };

    section.style.display = 'block';
    label.textContent = labels[currentContext] || currentContext;

    if (contextHistory.length === 0) {
        list.textContent = 'none yet';
    } else {
        list.innerHTML = contextHistory.map(function (name) {
            return '<span class="badge bg-secondary me-1">'
                + name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                + '</span>';
        }).join('');
    }
}

function clearCurrentHistory() {
    if (!currentContext) return;
    resetContextHistory(currentContext);
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

// Main Functionality: define facilitator based on the configuration
// Called in the btnDefineFacilitator click event
function getFacilitator() {
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
    updateHistoryDisplay();

    var isSupport = currentContext === 'support';
    var title = 'Congratulations, ' + facilitator + '!';
    var message = isSupport
        ? 'You are the <b>Support Champion</b> this week!'
        : 'You are the chosen one!';

    if (cycleReset && currentContext) {
        message += '<br><br><small class="text-muted">Everyone in the pool had been picked — history was reset for a new cycle.</small>';
    }

    Swal.fire({ title: title, html: message, icon: 'success', confirmButtonText: 'Cool!' });
    unloadSpinner();
}

// Events / Clicks

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
    updateHistoryDisplay();
}

function btnAll_Click() {
    setActiveContext('all', 'btnAll');
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        enabledButton(item);
    });
}

function btnSupportChampion_Click() {
    setActiveContext('support', 'btnSupportChampion');
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var role = $(item).prop("role");
        if (role.toLowerCase() === "dev") {
            enabledButton(item);
        } else {
            disabledButton(item);
        }
    });
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
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        let team = $(item).prop("team");
        if (team.toLowerCase() == "alpha") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnBeta_Click() {
    setActiveContext('beta', 'btnBeta');
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var team = $(item).prop("team");
        if (team.toLowerCase() == "beta") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnFacilitatorButtonClick() {
    let isEnabled = $(this).hasClass("btn-primary");

    if (isEnabled) {
        disabledButton(this);
    }
    else {
        enabledButton(this);
    }
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



